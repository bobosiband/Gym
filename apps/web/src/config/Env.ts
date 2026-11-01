/**
 * Public, build-time configuration for the Gym PWA.
 *
 * Values are read from Vite's `import.meta.env` object, which inlines
 * every variable prefixed with `VITE_` into the client bundle. Secrets
 * must never appear here: anything exposed via this class ships to
 * every end user.
 *
 * The static {@link Env.load} factory validates that required URLs
 * are present and returns a frozen value. Screens and clients should
 * accept the resolved `Env` as a dependency rather than touching
 * `import.meta.env` directly, so tests can supply fakes.
 */
export class Env {
  public readonly authApiUrl: string;
  public readonly authJwksUrl: string;
  public readonly jwtIssuer: string;
  public readonly jwtAudience: string;
  public readonly catalogueApiUrl: string;
  public readonly loggingApiUrl: string;

  private constructor(input: {
    authApiUrl: string;
    authJwksUrl: string;
    jwtIssuer: string;
    jwtAudience: string;
    catalogueApiUrl: string;
    loggingApiUrl: string;
  }) {
    this.authApiUrl = input.authApiUrl;
    this.authJwksUrl = input.authJwksUrl;
    this.jwtIssuer = input.jwtIssuer;
    this.jwtAudience = input.jwtAudience;
    this.catalogueApiUrl = input.catalogueApiUrl;
    this.loggingApiUrl = input.loggingApiUrl;
    Object.freeze(this);
  }

  /**
   * Build an {@link Env} from the given record of Vite variables.
   * Each required field must be a non-empty string. Trailing slashes
   * on URLs are trimmed so clients can concatenate paths without a
   * double slash.
   *
   * @throws Error listing every missing variable.
   */
  public static load(source: Readonly<Record<string, string | undefined>>): Env {
    const required: readonly EnvVariableName[] = [
      'VITE_AUTH_API_URL',
      'VITE_AUTH_JWKS_URL',
      'VITE_JWT_ISSUER',
      'VITE_JWT_AUDIENCE',
      'VITE_CATALOGUE_API_URL',
      'VITE_LOGGING_API_URL',
    ];
    const missing = required.filter((name) => {
      const value = source[name];
      return typeof value !== 'string' || value.trim().length === 0;
    });
    if (missing.length > 0) {
      throw new Error(`Env: missing required variables: ${missing.join(', ')}`);
    }
    return new Env({
      authApiUrl: Env.trimTrailingSlash(source['VITE_AUTH_API_URL'] as string),
      authJwksUrl: (source['VITE_AUTH_JWKS_URL'] as string).trim(),
      jwtIssuer: (source['VITE_JWT_ISSUER'] as string).trim(),
      jwtAudience: (source['VITE_JWT_AUDIENCE'] as string).trim(),
      catalogueApiUrl: Env.trimTrailingSlash(source['VITE_CATALOGUE_API_URL'] as string),
      loggingApiUrl: Env.trimTrailingSlash(source['VITE_LOGGING_API_URL'] as string),
    });
  }

  private static trimTrailingSlash(input: string): string {
    const trimmed = input.trim();
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
}

type EnvVariableName =
  | 'VITE_AUTH_API_URL'
  | 'VITE_AUTH_JWKS_URL'
  | 'VITE_JWT_ISSUER'
  | 'VITE_JWT_AUDIENCE'
  | 'VITE_CATALOGUE_API_URL'
  | 'VITE_LOGGING_API_URL';
