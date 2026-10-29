import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  type CfnStage,
  type HttpStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AttributeType,
  BillingMode,
  Table,
  TableClass,
  type Attribute,
} from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, type IFunction } from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  OutputFormat,
  type NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

/**
 * CDK stack for the auth service.
 *
 * Deliberately kept in a single file: the stage 2 scope is small
 * enough that splitting it would hide the shape of the deployed
 * topology. A future refactor can group Lambdas and routes into L3
 * constructs; for now, inline is clearer.
 *
 * Zero-cost choices driven by the project's zero-cost rule:
 *   - DynamoDB on-demand (PAY_PER_REQUEST, Standard class). No
 *     provisioned capacity; no fixed monthly charge.
 *   - API Gateway v2 (HTTP API). No fixed cost; stage-level throttling
 *     applied to every route and tighter per-route limits on the
 *     sensitive endpoints.
 *   - EventBridge named bus. Pay per million events.
 *   - Lambda on ARM64 (Graviton2) for cheaper invocations.
 *   - CloudWatch log retention 14 days, well below the free tier.
 *   - No Cognito, SES, WAF, NAT gateway, VPC, provisioned concurrency,
 *     or KMS customer-managed key. Secrets live in SSM standard
 *     parameters, which have no monthly fee.
 */
export class AuthStack extends Stack {
  private static readonly SSM_PARAM_PREFIX = '/gym/auth/';
  private static readonly JWT_KEY_ID = 'v1';
  private static readonly VERIFY_URL_PATH = 'verify';
  private static readonly RESET_URL_PATH = 'reset';

  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const usersTable = this.buildUsersTable();
    const sessionsTable = this.buildSessionsTable();
    const eventBus = new EventBus(this, 'EventBus', { eventBusName: 'gym-events' });

    const audience = 'gym-api';
    const issuer = `https://auth.gym.local/${this.region}`;

    const appOrigin = this.resolveFirstAppOrigin();
    const verifyUrl = `${appOrigin}/${AuthStack.VERIFY_URL_PATH}`;
    const resetUrl = `${appOrigin}/${AuthStack.RESET_URL_PATH}`;

    const commonEnvironment: Record<string, string> = {
      USERS_TABLE: usersTable.tableName,
      SESSIONS_TABLE: sessionsTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      SSM_PARAM_PREFIX: AuthStack.SSM_PARAM_PREFIX,
      JWT_ISSUER: issuer,
      JWT_AUDIENCE: audience,
      JWT_KEY_ID: AuthStack.JWT_KEY_ID,
      APP_VERIFY_URL: verifyUrl,
      APP_RESET_URL: resetUrl,
      ALLOWED_ORIGINS: appOrigin,
    };

    const serviceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../services/auth'
    );

    const register = this.buildLambda(
      'RegisterLambda',
      'registerLambda',
      commonEnvironment,
      serviceRoot
    );
    const verify = this.buildLambda(
      'VerifyEmailLambda',
      'verifyEmailLambda',
      commonEnvironment,
      serviceRoot
    );
    const resend = this.buildLambda(
      'ResendVerificationLambda',
      'resendVerificationLambda',
      commonEnvironment,
      serviceRoot
    );
    const login = this.buildLambda('LoginLambda', 'loginLambda', commonEnvironment, serviceRoot);
    const refresh = this.buildLambda(
      'RefreshLambda',
      'refreshLambda',
      commonEnvironment,
      serviceRoot
    );
    const logout = this.buildLambda('LogoutLambda', 'logoutLambda', commonEnvironment, serviceRoot);
    const forgot = this.buildLambda(
      'ForgotPasswordLambda',
      'forgotPasswordLambda',
      commonEnvironment,
      serviceRoot
    );
    const reset = this.buildLambda(
      'ResetPasswordLambda',
      'resetPasswordLambda',
      commonEnvironment,
      serviceRoot
    );
    const me = this.buildLambda('MeLambda', 'meLambda', commonEnvironment, serviceRoot);
    const jwks = this.buildLambda('JwksLambda', 'jwksLambda', commonEnvironment, serviceRoot);

    const writeAccess: readonly IFunction[] = [
      register,
      verify,
      resend,
      login,
      refresh,
      logout,
      forgot,
      reset,
    ];
    for (const fn of writeAccess) {
      usersTable.grantReadWriteData(fn);
      sessionsTable.grantReadWriteData(fn);
    }
    usersTable.grantReadData(me);
    sessionsTable.grantReadData(me);

    const allLambdas: readonly IFunction[] = [
      register,
      verify,
      resend,
      login,
      refresh,
      logout,
      forgot,
      reset,
      me,
      jwks,
    ];
    for (const fn of allLambdas) {
      this.grantSsmReadAccess(fn);
    }

    eventBus.grantPutEventsTo(register);

    const api = this.buildHttpApi(appOrigin);
    const jwksUrl = `${api.apiEndpoint}/.well-known/jwks.json`;
    const authorizer = new HttpJwtAuthorizer('AuthJwtAuthorizer', jwksUrl, {
      jwtAudience: [audience],
      identitySource: ['$request.header.Authorization'],
    });

    const integration = (fn: IFunction, name: string): HttpLambdaIntegration =>
      new HttpLambdaIntegration(`${name}Integration`, fn);

    api.addRoutes({
      path: '/auth/register',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(register, 'Register'),
    });
    api.addRoutes({
      path: '/auth/verify-email',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(verify, 'VerifyEmail'),
    });
    api.addRoutes({
      path: '/auth/resend-verification',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(resend, 'ResendVerification'),
    });
    api.addRoutes({
      path: '/auth/login',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(login, 'Login'),
    });
    api.addRoutes({
      path: '/auth/refresh',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(refresh, 'Refresh'),
    });
    api.addRoutes({
      path: '/auth/logout',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(logout, 'Logout'),
    });
    api.addRoutes({
      path: '/auth/forgot-password',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(forgot, 'ForgotPassword'),
    });
    api.addRoutes({
      path: '/auth/reset-password',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(reset, 'ResetPassword'),
    });
    api.addRoutes({
      path: '/auth/me',
      methods: [HttpMethod.GET, HttpMethod.OPTIONS],
      integration: integration(me, 'Me'),
      authorizer,
    });
    api.addRoutes({
      path: '/.well-known/jwks.json',
      methods: [HttpMethod.GET],
      integration: integration(jwks, 'Jwks'),
    });

    this.applyPerRouteThrottling(api.defaultStage as HttpStage);

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'JwtIssuer', { value: issuer });
    new CfnOutput(this, 'JwtAudience', { value: audience });
    new CfnOutput(this, 'JwksUrl', { value: jwksUrl });
    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName });

    this.publishSharedOutputsToSsm(issuer, audience, jwksUrl);
  }

  private buildUsersTable(): Table {
    const table = new Table(this, 'UsersTable', {
      partitionKey: this.stringKey('id'),
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'by-email',
      partitionKey: this.stringKey('email'),
    });
    return table;
  }

  private buildSessionsTable(): Table {
    const table = new Table(this, 'SessionsTable', {
      partitionKey: this.stringKey('tokenHashId'),
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt',
    });
    table.addGlobalSecondaryIndex({
      indexName: 'by-family',
      partitionKey: this.stringKey('familyId'),
    });
    table.addGlobalSecondaryIndex({
      indexName: 'by-user',
      partitionKey: this.stringKey('userId'),
    });
    table.addGlobalSecondaryIndex({
      indexName: 'by-email-kind',
      partitionKey: this.stringKey('emailKind'),
      sortKey: { name: 'createdAtSeconds', type: AttributeType.NUMBER },
    });
    return table;
  }

  private buildHttpApi(appOrigin: string): HttpApi {
    return new HttpApi(this, 'AuthHttpApi', {
      apiName: 'gym-auth',
      corsPreflight: {
        allowOrigins: [appOrigin],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: Duration.minutes(10),
      },
    });
  }

  private applyPerRouteThrottling(stage: HttpStage): void {
    const cfnStage = stage.node.defaultChild as CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingRateLimit: 20,
      throttlingBurstLimit: 40,
    };
    const tight = { throttlingRateLimit: 2, throttlingBurstLimit: 5 };
    cfnStage.routeSettings = {
      'POST /auth/register': tight,
      'POST /auth/login': tight,
      'POST /auth/refresh': tight,
      'POST /auth/forgot-password': tight,
      'POST /auth/resend-verification': tight,
    };
  }

  private buildLambda(
    constructId: string,
    moduleName: string,
    environment: Record<string, string>,
    serviceRoot: string
  ): IFunction {
    const entry = path.join(serviceRoot, 'src', 'lambdas', `${moduleName}.ts`);
    const logGroup = new LogGroup(this, `${constructId}LogGroup`, {
      logGroupName: `/aws/lambda/gym-auth-${moduleName}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const props: NodejsFunctionProps = {
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      reservedConcurrentExecutions: 10,
      environment,
      logGroup,
      bundling: {
        format: OutputFormat.ESM,
        target: 'node20',
        minify: true,
        sourceMap: true,
        externalModules: ['@node-rs/argon2'],
        nodeModules: ['@node-rs/argon2'],
      },
    };
    return new NodejsFunction(this, constructId, props);
  }

  private grantSsmReadAccess(fn: IFunction): void {
    const parameterArn = Stack.of(fn).formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: 'gym/auth/*',
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [parameterArn],
      })
    );
  }

  private publishSharedOutputsToSsm(issuer: string, audience: string, jwksUrl: string): void {
    new StringParameter(this, 'IssuerParam', {
      parameterName: `${AuthStack.SSM_PARAM_PREFIX}public/issuer`,
      stringValue: issuer,
    });
    new StringParameter(this, 'AudienceParam', {
      parameterName: `${AuthStack.SSM_PARAM_PREFIX}public/audience`,
      stringValue: audience,
    });
    new StringParameter(this, 'JwksUrlParam', {
      parameterName: `${AuthStack.SSM_PARAM_PREFIX}public/jwks-url`,
      stringValue: jwksUrl,
    });
  }

  private resolveFirstAppOrigin(): string {
    const raw = process.env['APP_ORIGINS'];
    if (raw === undefined || raw.length === 0) {
      throw new Error('APP_ORIGINS must be set in services/auth/.env before deploying');
    }
    const first = raw
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.length > 0);
    if (first === undefined) {
      throw new Error('APP_ORIGINS must contain at least one origin');
    }
    return first;
  }

  private stringKey(name: string): Attribute {
    return { name, type: AttributeType.STRING };
  }
}
