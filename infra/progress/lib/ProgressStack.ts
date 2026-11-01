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
  Table,
  TableClass,
  type Attribute,
} from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
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
 * CDK stack for the progress service.
 *
 * Mirrors `infra/logging/lib/LoggingStack.ts`: HTTP API Gateway v2
 * for the data plane, DynamoDB on-demand tables, a shared
 * `gym-events` EventBridge bus for both consuming `workout.logged.v1`
 * and emitting progress-side events, SSM standard parameters for
 * configuration. Every zero-cost rule in `docs/architecture.md`
 * applies: no Cognito, SES, WAF, NAT, VPC, provisioned concurrency,
 * or KMS customer-managed keys.
 */
export class ProgressStack extends Stack {
  private static readonly SSM_PARAM_PREFIX = '/gym/progress/';
  private static readonly SHARED_EVENT_BUS_NAME = 'gym-events';

  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const stateTable = this.buildStateTable();
    const processedEventTable = this.buildProcessedEventTable();
    const eventBus = EventBus.fromEventBusName(
      this,
      'SharedEventBus',
      ProgressStack.SHARED_EVENT_BUS_NAME
    );

    const appOrigins = this.resolveAppOrigins();

    const commonEnvironment: Record<string, string> = {
      STATE_TABLE_NAME: stateTable.tableName,
      PROCESSED_EVENT_TABLE_NAME: processedEventTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      SSM_PARAM_PREFIX: ProgressStack.SSM_PARAM_PREFIX,
    };

    const serviceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../services/progress'
    );

    const getProgress = this.buildLambda(
      'GetProgressLambda',
      'getProgressLambda',
      commonEnvironment,
      serviceRoot
    );
    const setTimeZone = this.buildLambda(
      'SetTimeZoneLambda',
      'setTimeZoneLambda',
      commonEnvironment,
      serviceRoot
    );
    const setDailyTarget = this.buildLambda(
      'SetDailyTargetLambda',
      'setDailyTargetLambda',
      commonEnvironment,
      serviceRoot
    );
    const workoutLoggedConsumer = this.buildLambda(
      'WorkoutLoggedConsumerLambda',
      'workoutLoggedConsumerLambda',
      commonEnvironment,
      serviceRoot
    );
    const health = this.buildLambda('HealthLambda', 'healthLambda', {}, serviceRoot);

    stateTable.grantReadWriteData(getProgress);
    stateTable.grantReadWriteData(setTimeZone);
    stateTable.grantReadWriteData(setDailyTarget);
    stateTable.grantReadWriteData(workoutLoggedConsumer);
    processedEventTable.grantReadWriteData(workoutLoggedConsumer);

    const ssmReaders: readonly IFunction[] = [
      getProgress,
      setTimeZone,
      setDailyTarget,
      workoutLoggedConsumer,
    ];
    for (const fn of ssmReaders) {
      this.grantSsmReadAccess(fn, 'gym/progress/*');
      this.grantSsmReadAccess(fn, 'gym/auth/public/*');
    }

    eventBus.grantPutEventsTo(workoutLoggedConsumer);

    new Rule(this, 'WorkoutLoggedRule', {
      eventBus,
      eventPattern: {
        detailType: ['workout.logged.v1'],
      },
      targets: [new LambdaFunction(workoutLoggedConsumer, { retryAttempts: 2 })],
    });

    const api = this.buildHttpApi(appOrigins);

    const integration = (fn: IFunction, name: string): HttpLambdaIntegration =>
      new HttpLambdaIntegration(`${name}Integration`, fn);

    api.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: integration(health, 'Health'),
    });
    api.addRoutes({
      path: '/progress',
      methods: [HttpMethod.GET, HttpMethod.OPTIONS],
      integration: integration(getProgress, 'GetProgress'),
    });
    api.addRoutes({
      path: '/progress/timezone',
      methods: [HttpMethod.PUT, HttpMethod.OPTIONS],
      integration: integration(setTimeZone, 'SetTimeZone'),
    });
    api.addRoutes({
      path: '/progress/daily-target',
      methods: [HttpMethod.POST, HttpMethod.OPTIONS],
      integration: integration(setDailyTarget, 'SetDailyTarget'),
    });

    this.applyStageThrottling(api.defaultStage as HttpStage);

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'StateTableName', { value: stateTable.tableName });
    new CfnOutput(this, 'ProcessedEventTableName', { value: processedEventTable.tableName });

    this.publishApiUrlToSsm(api.apiEndpoint);
  }

  private buildStateTable(): Table {
    return new Table(this, 'StateTable', {
      partitionKey: this.stringKey('pk'),
      sortKey: this.stringKey('sk'),
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  private buildProcessedEventTable(): Table {
    return new Table(this, 'ProcessedEventTable', {
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
    return new HttpApi(this, 'ProgressHttpApi', {
      apiName: 'gym-progress',
      corsPreflight: {
        allowOrigins: list,
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: Duration.minutes(10),
      },
    });
  }

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
      logGroupName: `/aws/lambda/gym-progress-${moduleName}`,
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
      parameterName: `${ProgressStack.SSM_PARAM_PREFIX}public/api-url`,
      stringValue: apiUrl,
    });
  }

  private resolveAppOrigins(): string {
    const raw = process.env['APP_ORIGINS'];
    if (raw === undefined || raw.length === 0) {
      throw new Error('APP_ORIGINS must be set in services/progress/.env before deploying');
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
