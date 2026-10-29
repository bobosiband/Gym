/**
 * Lambda runtime environment for the auth service.
 *
 * Only non-secret identifiers live here; every secret value (SMTP
 * password, JWT private key) is read from SSM at cold start via
 * `SsmConfigLoader`. The AWS region used by the SDK clients comes from
 * the standard `AWS_REGION` Lambda variable; CDK sets everything else.
 */
export interface Env {
  readonly USERS_TABLE: string;
  readonly SESSIONS_TABLE: string;
  readonly EVENT_BUS_NAME: string;
  readonly SSM_PARAM_PREFIX: string;
  readonly JWT_ISSUER: string;
  readonly JWT_AUDIENCE: string;
  readonly JWT_KEY_ID: string;
  readonly APP_VERIFY_URL: string;
  readonly APP_RESET_URL: string;
  readonly ALLOWED_ORIGINS: string;
}

/**
 * Read-only accessor over `process.env` that fails loudly if a key is
 * missing. Lambdas call this once per cold start to build the shared
 * `Env` object; keeping all reads behind this function prevents
 * silent `undefined` leaks into the business logic.
 */
export class EnvReader {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Read the full `Env` from `process.env`. Throws if any required key
   * is missing or empty so a misconfigured Lambda crashes at cold start
   * rather than at the first request.
   */
  public static readFromProcess(): Env {
    return {
      USERS_TABLE: EnvReader.required('USERS_TABLE'),
      SESSIONS_TABLE: EnvReader.required('SESSIONS_TABLE'),
      EVENT_BUS_NAME: EnvReader.required('EVENT_BUS_NAME'),
      SSM_PARAM_PREFIX: EnvReader.required('SSM_PARAM_PREFIX'),
      JWT_ISSUER: EnvReader.required('JWT_ISSUER'),
      JWT_AUDIENCE: EnvReader.required('JWT_AUDIENCE'),
      JWT_KEY_ID: EnvReader.required('JWT_KEY_ID'),
      APP_VERIFY_URL: EnvReader.required('APP_VERIFY_URL'),
      APP_RESET_URL: EnvReader.required('APP_RESET_URL'),
      ALLOWED_ORIGINS: EnvReader.required('ALLOWED_ORIGINS'),
    };
  }

  private static required(key: string): string {
    const raw = process.env[key];
    if (raw === undefined || raw.length === 0) {
      throw new Error(`missing required environment variable: ${key}`);
    }
    return raw;
  }
}
