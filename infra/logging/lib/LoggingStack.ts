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
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
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
 * CDK stack for the logging service.
 *
 * Deliberately kept in a single file to match `infra/auth`: the
 * Stage 2 scope is small enough that splitting it would hide the
 * shape of the deployed topology. A future refactor can group
 * Lambdas and routes into L3 constructs; for now, inline is
 * clearer.
 *
 * Zero-cost choices driven by the project's zero-cost rule:
 *   - DynamoDB on-demand (PAY_PER_REQUEST, Standard class). No
 *     provisioned capacity.
 *   - API Gateway v2 (HTTP API). No fixed cost; stage-level
 *     throttling applied to every route.
 *   - Shared `gym-events` EventBridge bus (created by the auth
 *     stack); logging imports it by name, so there is no second
 *     bus to pay for.
 *   - Lambda on X86_64, Node.js 20. CloudWatch log retention 14
 *     days, well below the free tier.
 *   - No Cognito, SES, WAF, NAT gateway, VPC, provisioned
 *     concurrency, or KMS customer-managed key. Non-secret config
 *     lives in SSM standard parameters.
 */
export class LoggingStack extends Stack {
  private static readonly SSM_PARAM_PREFIX = '/gym/logging/';
  private static readonly AUTH_SSM_PREFIX = '/gym/auth/';
  private static readonly SHARED_EVENT_BUS_NAME = 'gym-events';

  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const workoutsTable = this.buildWorkoutsTable();
    const idempotencyTable = this.buildIdempotencyTable();
    const eventBus = EventBus.fromEventBusName(
      this,
      'SharedEventBus',
      LoggingStack.SHARED_EVENT_BUS_NAME
    );

    const appOrigins = this.resolveAppOrigins();

    const commonEnvironment: Record<string, string> = {
      WORKOUTS_TABLE: workoutsTable.tableName,
      IDEMPOTENCY_TABLE: idempotencyTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      SSM_PARAM_PREFIX: LoggingStack.SSM_PARAM_PREFIX,
      AUTH_SSM_PREFIX: LoggingStack.AUTH_SSM_PREFIX,
      ALLOWED_ORIGINS: appOrigins,
    };

    const serviceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../services/logging'
    );

    const logWorkout = this.buildLambda(
      'LogWorkoutLambda',
      'logWorkoutLambda',
      commonEnvironment,
      serviceRoot
    );
    const getWorkout = this.buildLambda(
      'GetWorkoutLambda',
      'getWorkoutLambda',
      commonEnvironment,
      serviceRoot
    );
    const listWorkouts = this.buildLambda(
      'ListWorkoutsLambda',
      'listWorkoutsLambda',
      commonEnvironment,
      serviceRoot
    );
    const health = this.buildLambda('HealthLambda', 'healthLambda', {}, serviceRoot);

    workoutsTable.grantReadWriteData(logWorkout);
    idempotencyTable.grantReadWriteData(logWorkout);
    workoutsTable.grantReadData(getWorkout);
    workoutsTable.grantReadData(listWorkouts);

    const ssmReaders: readonly IFunction[] = [logWorkout, getWorkout, listWorkouts];
    for (const fn of ssmReaders) {
      this.grantSsmReadAccess(fn, 'gym/logging/*');
      this.grantSsmReadAccess(fn, 'gym/auth/public/*');
    }
    // Health intentionally gets no SSM, Dynamo, or EventBridge
    // grant; it must not depend on any backing service being
    // reachable.

    eventBus.grantPutEventsTo(logWorkout);

    const api = this.buildHttpApi(appOrigins);

    const integration = (fn: IFunction, name: string): HttpLambdaIntegration =>
      new HttpLambdaIntegration(`${name}Integration`, fn);

    api.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: integration(health, 'Health'),
    });
    api.addRoutes({
      path: '/workouts',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(logWorkout, 'LogWorkout'),
    });
    api.addRoutes({
      path: '/workouts',
      methods: [HttpMethod.GET],
      integration: integration(listWorkouts, 'ListWorkouts'),
    });
    api.addRoutes({
      path: '/workouts/{workoutId}',
      methods: [HttpMethod.GET, HttpMethod.OPTIONS],
      integration: integration(getWorkout, 'GetWorkout'),
    });

    this.applyStageThrottling(api.defaultStage as HttpStage);

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'WorkoutsTableName', { value: workoutsTable.tableName });
    new CfnOutput(this, 'IdempotencyTableName', { value: idempotencyTable.tableName });
    new CfnOutput(this, 'EventBusName', { value: eventBus.eventBusName });

    this.publishApiUrlToSsm(api.apiEndpoint);
  }

  private buildWorkoutsTable(): Table {
    const table = new Table(this, 'WorkoutsTable', {
      partitionKey: this.stringKey('pk'),
      sortKey: this.stringKey('sk'),
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'by-workout',
      partitionKey: this.stringKey('workoutId'),
      projectionType: ProjectionType.ALL,
    });
    return table;
  }

  private buildIdempotencyTable(): Table {
    return new Table(this, 'IdempotencyTable', {
      partitionKey: this.stringKey('pk'),
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'expiresAt',
    });
  }

  private buildHttpApi(appOrigins: string): HttpApi {
    const list = appOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    return new HttpApi(this, 'LoggingHttpApi', {
      apiName: 'gym-logging',
      corsPreflight: {
        allowOrigins: list,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['content-type', 'authorization', 'idempotency-key'],
        maxAge: Duration.minutes(10),
      },
    });
  }

  /**
   * Apply stage-level throttling. The 20 req/s with burst 40
   * default from auth is already restrictive enough to protect
   * the free tier for a single-user workload.
   */
  private applyStageThrottling(stage: HttpStage): void {
    const cfnStage = stage.node.defaultChild as CfnStage;
    cfnStage.addPropertyOverride('DefaultRouteSettings', {
      ThrottlingRateLimit: 20,
      ThrottlingBurstLimit: 40,
    });
  }

  private buildLambda(
    constructId: string,
    moduleName: string,
    environment: Record<string, string>,
    serviceRoot: string
  ): IFunction {
    const entry = path.join(serviceRoot, 'src', 'lambdas', `${moduleName}.ts`);
    const logGroup = new LogGroup(this, `${constructId}LogGroup`, {
      logGroupName: `/aws/lambda/gym-logging-${moduleName}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const props: NodejsFunctionProps = {
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.X86_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment,
      logGroup,
      bundling: {
        format: OutputFormat.ESM,
        target: 'node20',
        minify: true,
        sourceMap: true,
      },
    };
    return new NodejsFunction(this, constructId, props);
  }

  private grantSsmReadAccess(fn: IFunction, resourceName: string): void {
    const parameterArn = Stack.of(fn).formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName,
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [parameterArn],
      })
    );
  }

  private publishApiUrlToSsm(apiUrl: string): void {
    new StringParameter(this, 'ApiUrlParam', {
      parameterName: `${LoggingStack.SSM_PARAM_PREFIX}public/api-url`,
      stringValue: apiUrl,
    });
  }

  private resolveAppOrigins(): string {
    const raw = process.env['APP_ORIGINS'];
    if (raw === undefined || raw.length === 0) {
      throw new Error('APP_ORIGINS must be set in services/logging/.env before deploying');
    }
    const list = raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (list.length === 0) {
      throw new Error('APP_ORIGINS must contain at least one origin');
    }
    return list.join(',');
  }

  private stringKey(name: string): Attribute {
    return { name, type: AttributeType.STRING };
  }
}
