import type { AuthApi } from '@gym/contracts';

import type { AuthTokens } from '../auth/AuthTokens.js';
import type { FetchHttpClient } from './FetchHttpClient.js';

/**
 * Typed HTTP client for `services/auth`.
 *
 * The methods on this class map one-to-one to the auth service's
 * endpoints documented in `services/auth/README.md`. Each method
 * returns the parsed response body on success and throws an
 * {@link HttpError} on any non-2xx status.
 *
 * This client knows nothing about the token store: the caller is
 * responsible for persisting the tokens returned by {@link login} and
 * {@link refresh}. That split keeps the client reusable from screens
 * that need a one-off auth action without touching session state.
 */
export class AuthApiClient {
  private readonly http: FetchHttpClient;
  private readonly baseUrl: string;

  public constructor(http: FetchHttpClient, baseUrl: string) {
    this.http = http;
    this.baseUrl = baseUrl;
  }

  /** `POST /auth/register` */
  public async register(email: string, password: string): Promise<AuthApi.RegisterResponse> {
    const body: AuthApi.RegisterRequest = { email, password };
    return this.http.request<AuthApi.RegisterResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/register`,
      body,
    });
  }

  /** `POST /auth/verify-email` */
  public async verifyEmail(token: string): Promise<AuthApi.VerifyEmailResponse> {
    const body: AuthApi.VerifyEmailRequest = { token };
    return this.http.request<AuthApi.VerifyEmailResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/verify-email`,
      body,
    });
  }

  /** `POST /auth/resend-verification` */
  public async resendVerification(email: string): Promise<AuthApi.ResendVerificationResponse> {
    const body: AuthApi.ResendVerificationRequest = { email };
    return this.http.request<AuthApi.ResendVerificationResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/resend-verification`,
      body,
    });
  }

  /** `POST /auth/login`. Returns tokens on success. */
  public async login(email: string, password: string): Promise<AuthTokens> {
    const body: AuthApi.LoginRequest = { email, password };
    const response = await this.http.request<AuthApi.LoginResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/login`,
      body,
    });
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresInSeconds: response.expiresInSeconds,
    };
  }

  /**
   * `POST /auth/refresh`. Rotates the refresh token: the caller must
   * persist the returned token pair and discard the old refresh token.
   */
  public async refresh(refreshToken: string): Promise<AuthTokens> {
    const body: AuthApi.RefreshRequest = { refreshToken };
    const response = await this.http.request<AuthApi.RefreshResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/refresh`,
      body,
    });
    return {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresInSeconds: response.expiresInSeconds,
    };
  }

  /** `POST /auth/logout`. Idempotent on the server. */
  public async logout(refreshToken: string): Promise<void> {
    const body: AuthApi.LogoutRequest = { refreshToken };
    await this.http.request<AuthApi.LogoutResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/logout`,
      body,
    });
  }

  /** `POST /auth/forgot-password` */
  public async forgotPassword(email: string): Promise<AuthApi.ForgotPasswordResponse> {
    const body: AuthApi.ForgotPasswordRequest = { email };
    return this.http.request<AuthApi.ForgotPasswordResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/forgot-password`,
      body,
    });
  }

  /** `POST /auth/reset-password` */
  public async resetPassword(
    token: string,
    newPassword: string
  ): Promise<AuthApi.ResetPasswordResponse> {
    const body: AuthApi.ResetPasswordRequest = { token, newPassword };
    return this.http.request<AuthApi.ResetPasswordResponse>({
      method: 'POST',
      url: `${this.baseUrl}/auth/reset-password`,
      body,
    });
  }

  /** `GET /auth/me` */
  public async me(accessToken: string): Promise<AuthApi.MeResponse> {
    return this.http.request<AuthApi.MeResponse>({
      method: 'GET',
      url: `${this.baseUrl}/auth/me`,
      bearerToken: accessToken,
    });
  }
}
