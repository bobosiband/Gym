#!/usr/bin/env node
/**
 * One-time setup for the logging service.
 *
 * Reads `APP_ORIGINS` from the local `.env` file (loaded by the
 * `--env-file` flag in the `pnpm --filter @gym/logging setup`
 * script) and writes it to AWS SSM at `/gym/logging/app/origins`.
 * Nothing else lives in SSM for this service; the JWT issuer,
 * audience and JWKS URL are produced by the auth stack under
 * `/gym/auth/public/*`.
 *
 * The script is idempotent: running it twice overwrites the
 * parameter with the current value.
 */

import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const PARAM_NAME = '/gym/logging/app/origins';

async function main(): Promise<void> {
  const origins = process.env['APP_ORIGINS'];
  if (origins === undefined || origins.length === 0) {
    throw new Error('APP_ORIGINS must be set in services/logging/.env before running setup');
  }
  const region = process.env['AWS_REGION'];
  if (region === undefined || region.length === 0) {
    throw new Error('AWS_REGION must be set in services/logging/.env before running setup');
  }
  const client = new SSMClient({ region });
  await client.send(
    new PutParameterCommand({
      Name: PARAM_NAME,
      Value: origins,
      Type: 'String',
      Overwrite: true,
      Description: 'Comma-separated CORS allow list for services/logging. "*" means allow all.',
    })
  );
  console.log(`SSM parameter ${PARAM_NAME} written (${origins.length} chars).`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`setup failed: ${message}`);
  process.exit(1);
});
