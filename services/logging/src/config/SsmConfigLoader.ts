import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

import type { LoggingConfig } from './LoggingConfig.js';

/**
 * SSM parameter name suffixes read by the logging service. The
 * `AUTH_*` names are published by `services/auth` under its own
 * prefix (`/gym/auth/`); the `APP_ORIGINS` suffix is published by
 * the logging service itself under its own prefix (`/gym/logging/`).
 */
export class SsmParamNames {
  public static readonly AUTH_ISSUER = 'public/issuer';
  public static readonly AUTH_AUDIENCE = 'public/audience';
  public static readonly AUTH_JWKS_URL = 'public/jwks-url';
  public static readonly APP_ORIGINS = 'app/origins';

  private constructor() {
    // utility class; never instantiated
  }
}

/**
 * Reads the full `LoggingConfig` from AWS Systems Manager Parameter
 * Store.
 *
 * One call per cold start. Values are read with decryption on; the
 * SSM standard tier is used throughout to keep the service on the
 * free tier (standard parameters are free; advanced parameters
 * have a monthly charge).
 */
export class SsmConfigLoader {
  public constructor(
    private readonly client: SSMClient,
    private readonly loggingPrefix: string,
    private readonly authPrefix: string
  ) {}

  public async load(): Promise<LoggingConfig> {
    const names = [
      this.join(this.authPrefix, SsmParamNames.AUTH_ISSUER),
      this.join(this.authPrefix, SsmParamNames.AUTH_AUDIENCE),
      this.join(this.authPrefix, SsmParamNames.AUTH_JWKS_URL),
      this.join(this.loggingPrefix, SsmParamNames.APP_ORIGINS),
    ];
    const parameters = await this.getAll(names);
    const byName = new Map<string, string>();
    for (const parameter of parameters) {
      if (parameter.Name !== undefined && parameter.Value !== undefined) {
        byName.set(parameter.Name, parameter.Value);
      }
    }
    return {
      issuer: this.required(byName, this.authPrefix, SsmParamNames.AUTH_ISSUER),
      audience: this.required(byName, this.authPrefix, SsmParamNames.AUTH_AUDIENCE),
      jwksUrl: this.required(byName, this.authPrefix, SsmParamNames.AUTH_JWKS_URL),
      allowedOrigins: this.required(byName, this.loggingPrefix, SsmParamNames.APP_ORIGINS)
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    };
  }

  private async getAll(
    names: readonly string[]
  ): Promise<readonly { Name?: string | undefined; Value?: string | undefined }[]> {
    const out: { Name?: string | undefined; Value?: string | undefined }[] = [];
    for (let i = 0; i < names.length; i += 10) {
      const chunk = names.slice(i, i + 10);
      const response = await this.client.send(
        new GetParametersCommand({ Names: [...chunk], WithDecryption: true })
      );
      if (response.Parameters !== undefined) {
        for (const parameter of response.Parameters) {
          out.push({ Name: parameter.Name, Value: parameter.Value });
        }
      }
    }
    return out;
  }

  private required(byName: Map<string, string>, prefix: string, suffix: string): string {
    const name = this.join(prefix, suffix);
    const value = byName.get(name);
    if (value === undefined || value.length === 0) {
      throw new Error(`missing SSM parameter: ${name}`);
    }
    return value;
  }

  private join(prefix: string, suffix: string): string {
    return `${prefix}${suffix}`;
  }
}
