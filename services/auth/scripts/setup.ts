/**
 * Non-interactive bootstrap script for the auth service.
 *
 * Run with `pnpm --filter @gym/auth setup`. The script:
 *   1. loads AWS credentials from `services/auth/.env`;
 *   2. refuses to run if any required key is empty;
 *   3. generates an ES256 key pair the first time it runs and stores
 *      the private key as an SSM SecureString and the public key as
 *      an SSM String, both under the service's standard parameter
 *      prefix;
 *   4. copies only the SMTP settings and `APP_ORIGINS` into SSM,
 *      never the AWS keys;
 *   5. prints what it did without ever echoing a secret value.
 *
 * The script is safe to re-run: parameter writes use `Overwrite: true`
 * for non-key values, and the ES256 key pair is only created when the
 * private-key parameter does not already exist.
 */

import { generateKeyPairSync } from 'node:crypto';
import { exit } from 'node:process';

import {
  GetParameterCommand,
  ParameterNotFound,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';

import { SsmParamNames } from '../src/config/SsmConfigLoader.js';

const DEFAULT_PREFIX = '/gym/auth/';

interface SetupEnv {
  readonly awsRegion: string;
  readonly smtp: {
    readonly host: string;
    readonly port: string;
    readonly user: string;
    readonly pass: string;
    readonly from: string;
  };
  readonly appOrigins: string;
  readonly prefix: string;
}

function readEnv(): SetupEnv {
  const required = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'APP_ORIGINS',
  ] as const;
  const missing: string[] = [];
  for (const key of required) {
    const value = process.env[key];
    if (value === undefined || value.length === 0) missing.push(key);
  }
  if (missing.length > 0) {
    console.error(`setup: missing or empty keys in services/auth/.env: ${missing.join(', ')}`);
    exit(1);
  }
  return {
    awsRegion: process.env['AWS_REGION'] as string,
    smtp: {
      host: process.env['SMTP_HOST'] as string,
      port: process.env['SMTP_PORT'] as string,
      user: process.env['SMTP_USER'] as string,
      pass: process.env['SMTP_PASS'] as string,
      from: process.env['SMTP_FROM'] as string,
    },
    appOrigins: process.env['APP_ORIGINS'] as string,
    prefix: process.env['SSM_PARAM_PREFIX'] ?? DEFAULT_PREFIX,
  };
}

async function parameterExists(client: SSMClient, name: string): Promise<boolean> {
  try {
    await client.send(new GetParameterCommand({ Name: name, WithDecryption: false }));
    return true;
  } catch (err) {
    if (err instanceof ParameterNotFound) return false;
    throw err;
  }
}

async function writeParameter(
  client: SSMClient,
  name: string,
  value: string,
  secret: boolean
): Promise<void> {
  await client.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Type: secret ? ParameterType.SECURE_STRING : ParameterType.STRING,
      Tier: 'Standard',
      Overwrite: true,
    })
  );
  console.log(`setup: wrote ${name}${secret ? ' (SecureString)' : ''}`);
}

async function ensureKeyPair(client: SSMClient, prefix: string): Promise<void> {
  const privateName = `${prefix}${SsmParamNames.JWT_PRIVATE_KEY}`;
  const publicName = `${prefix}${SsmParamNames.JWT_PUBLIC_KEY}`;
  if (await parameterExists(client, privateName)) {
    console.log('setup: JWT key pair already present, leaving as is');
    return;
  }
  const keyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateKeyPem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  await writeParameter(client, privateName, privateKeyPem, true);
  await writeParameter(client, publicName, publicKeyPem, false);
  console.log('setup: generated new ES256 key pair');
}

async function main(): Promise<void> {
  const env = readEnv();
  const client = new SSMClient({ region: env.awsRegion });

  await ensureKeyPair(client, env.prefix);

  await writeParameter(client, `${env.prefix}${SsmParamNames.SMTP_HOST}`, env.smtp.host, false);
  await writeParameter(client, `${env.prefix}${SsmParamNames.SMTP_PORT}`, env.smtp.port, false);
  await writeParameter(client, `${env.prefix}${SsmParamNames.SMTP_USER}`, env.smtp.user, false);
  await writeParameter(client, `${env.prefix}${SsmParamNames.SMTP_PASS}`, env.smtp.pass, true);
  await writeParameter(client, `${env.prefix}${SsmParamNames.SMTP_FROM}`, env.smtp.from, false);
  await writeParameter(client, `${env.prefix}${SsmParamNames.APP_ORIGINS}`, env.appOrigins, false);

  console.log('setup: done');
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(`setup: failed: ${err.message}`);
  } else {
    console.error('setup: failed with unknown error');
  }
  exit(1);
});
