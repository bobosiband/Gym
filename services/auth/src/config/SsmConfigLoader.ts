import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

import type { AuthConfig } from './AuthConfig.js';

/**
 * SSM parameter name suffixes read by the auth service. Each service
 * declares its own prefix via the `SSM_PARAM_PREFIX` env var (set by
 * CDK, typically `/gym/auth/`). The full name of each parameter is
 * `${prefix}${suffix}`.
 */
export class SsmParamNames {
  public static readonly JWT_PRIVATE_KEY = 'jwt/private-key';
  public static readonly JWT_PUBLIC_KEY = 'jwt/public-key';
  public static readonly SMTP_HOST = 'smtp/host';
  public static readonly SMTP_PORT = 'smtp/port';
  public static readonly SMTP_USER = 'smtp/user';
  public static readonly SMTP_PASS = 'smtp/pass';
  public static readonly SMTP_FROM = 'smtp/from';
  public static readonly APP_ORIGINS = 'app/origins';

  private constructor() {
    // utility class; never instantiated
  }

  public static all(): readonly string[] {
    return [
      SsmParamNames.JWT_PRIVATE_KEY,
      SsmParamNames.JWT_PUBLIC_KEY,
      SsmParamNames.SMTP_HOST,
      SsmParamNames.SMTP_PORT,
      SsmParamNames.SMTP_USER,
      SsmParamNames.SMTP_PASS,
      SsmParamNames.SMTP_FROM,
      SsmParamNames.APP_ORIGINS,
    ];
  }
}

/**
 * Reads the full `AuthConfig` from AWS Systems Manager Parameter
 * Store.
 *
 * One call per cold start. Values are read with decryption on; the
 * SSM standard tier is used throughout to keep the service on the
 * free tier (standard parameters are free; advanced parameters have
 * a monthly charge).
 */
export class SsmConfigLoader {
  public constructor(
    private readonly client: SSMClient,
    private readonly prefix: string
  ) {}

  public async load(): Promise<AuthConfig> {
    const suffixes = SsmParamNames.all();
    const fullNames = suffixes.map((s) => this.join(s));
    const parameters = await this.getAll(fullNames);
    const byName = new Map<string, string>();
    for (const parameter of parameters) {
      if (parameter.Name !== undefined && parameter.Value !== undefined) {
        byName.set(parameter.Name, parameter.Value);
      }
    }
    return {
      jwtPrivateKeyPem: this.required(byName, SsmParamNames.JWT_PRIVATE_KEY),
      jwtPublicKeyPem: this.required(byName, SsmParamNames.JWT_PUBLIC_KEY),
      smtp: {
        host: this.required(byName, SsmParamNames.SMTP_HOST),
        port: Number.parseInt(this.required(byName, SsmParamNames.SMTP_PORT), 10),
        user: this.required(byName, SsmParamNames.SMTP_USER),
        pass: this.required(byName, SsmParamNames.SMTP_PASS),
        from: this.required(byName, SsmParamNames.SMTP_FROM),
      },
      allowedOrigins: this.required(byName, SsmParamNames.APP_ORIGINS)
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

  private required(byName: Map<string, string>, suffix: string): string {
    const name = this.join(suffix);
    const value = byName.get(name);
    if (value === undefined || value.length === 0) {
      throw new Error(`missing SSM parameter: ${name}`);
    }
    return value;
  }

  private join(suffix: string): string {
    return `${this.prefix}${suffix}`;
  }
}
