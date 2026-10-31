/**
 * Lambda runtime environment for the logging service.
 *
 * Only non-secret identifiers live here; every runtime value that
 * can change without a redeploy (allowed origins, the auth issuer,
 * the JWKS URL) is read from SSM at cold start by
 * `SsmConfigLoader`. The AWS region used by the SDK clients comes
 * from the standard `AWS_REGION` Lambda variable; CDK sets
 * everything else.
 */
export interface Env {
  readonly WORKOUTS_TABLE: string;
  readonly IDEMPOTENCY_TABLE: string;
  readonly EVENT_BUS_NAME: string;
  readonly SSM_PARAM_PREFIX: string;
  readonly AUTH_SSM_PREFIX: string;
  readonly ALLOWED_ORIGINS: string;
}

/**
 * Read-only accessor over `process.env` that fails loudly if a key
 * is missing. Lambdas call this once per cold start to build the
 * shared `Env` object; keeping all reads behind this function
 * prevents silent `undefined` leaks into the business logic.
 */
export class EnvReader {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Read the full `Env` from `process.env`. Throws if any required
   * key is missing or empty so a misconfigured Lambda crashes at
   * cold start rather than at the first request.
   */
  public static readFromProcess(): Env {
    return {
      WORKOUTS_TABLE: EnvReader.required('WORKOUTS_TABLE'),
      IDEMPOTENCY_TABLE: EnvReader.required('IDEMPOTENCY_TABLE'),
      EVENT_BUS_NAME: EnvReader.required('EVENT_BUS_NAME'),
      SSM_PARAM_PREFIX: EnvReader.required('SSM_PARAM_PREFIX'),
      AUTH_SSM_PREFIX: EnvReader.required('AUTH_SSM_PREFIX'),
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
