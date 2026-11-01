#!/usr/bin/env node
/**
 * CDK app entry for the progress service.
 *
 * Reads the AWS account and region from standard environment
 * variables (`CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`), which
 * CDK populates from local credentials. No account id or region is
 * hardcoded.
 */
import { App } from 'aws-cdk-lib';

import { ProgressStack } from '../lib/ProgressStack.js';

const app = new App();

const account = process.env['CDK_DEFAULT_ACCOUNT'];
const region = process.env['CDK_DEFAULT_REGION'] ?? process.env['AWS_REGION'];
if (account === undefined || region === undefined) {
  throw new Error(
    'CDK requires CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION (or AWS_REGION) in the environment'
  );
}

new ProgressStack(app, 'GymProgressStack', {
  env: { account, region },
});
