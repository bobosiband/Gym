/**
 * Resolved runtime configuration for the auth service. Produced once
 * per cold start by `SsmConfigLoader` from Env + SSM, then held by
 * `AuthServiceFactory` for the life of the Lambda instance.
 */
export interface AuthConfig {
  readonly jwtPrivateKeyPem: string;
  readonly jwtPublicKeyPem: string;
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly pass: string;
    readonly from: string;
  };
  readonly allowedOrigins: readonly string[];
}
