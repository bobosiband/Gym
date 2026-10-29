#!/usr/bin/env node
/**
 * CDK app entry for the auth service.
 *
 * Reads the AWS account and region from standard environment variables
 * (`CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`), which CDK populates from
 * the local credentials loaded via `services/auth/.env`. No account id
 * or region is hardcoded here.
 */

import { App } from 'aws-cdk-lib';

import { AuthStack } from '../lib/AuthStack.js';

const app = new App();

const account = process.env['CDK_DEFAULT_ACCOUNT'];
const region = process.env['CDK_DEFAULT_REGION'] ?? process.env['AWS_REGION'];
if (account === undefined || region === undefined) {
  throw new Error(
    'CDK requires CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION (or AWS_REGION) in the environment'
  );
}

new AuthStack(app, 'GymAuthStack', {
  env: { account, region },
});
