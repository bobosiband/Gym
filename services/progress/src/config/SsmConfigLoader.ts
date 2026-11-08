import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

import type { ProgressConfig } from './ProgressConfig.js';

/**
 * Load {@link ProgressConfig} from SSM at cold start.
 *
 * The loader reads four parameters under
 * `/gym/auth/public/jwks-url`, `/gym/auth/public/issuer`,
 * `/gym/auth/public/audience` (published by `services/auth`) and
 * `${SSM_PARAM_PREFIX}/app/origins` (per-service CORS allow list).
 */
export class SsmConfigLoader {
  private readonly paramPrefix: string;

  public constructor(
    private readonly ssm: SSMClient,
    paramPrefix: string
  ) {
    this.paramPrefix = paramPrefix.endsWith('/') ? paramPrefix.slice(0, -1) : paramPrefix;
  }

  public async load(): Promise<ProgressConfig> {
    const names = [
      '/gym/auth/public/jwks-url',
      '/gym/auth/public/issuer',
      '/gym/auth/public/audience',
      `${this.paramPrefix}/app/origins`,
    ];
    const response = await this.ssm.send(new GetParametersCommand({ Names: names }));
    const resolved = new Map<string, string>();
    for (const param of response.Parameters ?? []) {
      if (param.Name !== undefined && param.Value !== undefined) {
        resolved.set(param.Name, param.Value);
      }
    }
    const missing = names.filter((name) => !resolved.has(name));
    if (missing.length > 0) {
      throw new Error(`SsmConfigLoader: missing parameters ${missing.join(', ')}`);
    }
    const jwksUrl = resolved.get('/gym/auth/public/jwks-url') as string;
    const jwtIssuer = resolved.get('/gym/auth/public/issuer') as string;
    const jwtAudience = resolved.get('/gym/auth/public/audience') as string;
    const originsRaw = resolved.get(`${this.paramPrefix}/app/origins`) as string;
    const allowedOrigins = SsmConfigLoader.parseOrigins(originsRaw);
    return { jwksUrl, jwtIssuer, jwtAudience, allowedOrigins };
  }

  private static parseOrigins(raw: string): readonly string[] {
    const trimmed = raw.trim();
    if (trimmed === '*') {
      return ['*'];
    }
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
}
