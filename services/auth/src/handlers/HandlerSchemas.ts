import { z } from 'zod';

/**
 * Zod schemas for every auth endpoint. Each schema is `strict` so an
 * unknown field causes a validation error, which prevents payload
 * sneak-in attacks and keeps the request shape in lock-step with the
 * contract in `@gym/contracts/api/auth`.
 *
 * These schemas are not re-exported from the contracts package on
 * purpose: the contract defines the HTTP shape; the schema enforces
 * runtime bounds and formatting that TypeScript cannot express.
 */
export class HandlerSchemas {
  public static readonly MIN_PASSWORD_LENGTH = 12;
  public static readonly MAX_PASSWORD_LENGTH = 128;

  private constructor() {
    // utility class; never instantiated
  }

  public static register(): z.ZodType {
    return z
      .object({
        email: z.string().min(3).max(320).email(),
        password: z
          .string()
          .min(HandlerSchemas.MIN_PASSWORD_LENGTH)
          .max(HandlerSchemas.MAX_PASSWORD_LENGTH),
      })
      .strict();
  }

  public static login(): z.ZodType {
    return z
      .object({
        email: z.string().min(3).max(320).email(),
        password: z.string().min(1).max(HandlerSchemas.MAX_PASSWORD_LENGTH),
      })
      .strict();
  }

  public static refresh(): z.ZodType {
    return z.object({ refreshToken: z.string().min(10).max(200) }).strict();
  }

  public static logout(): z.ZodType {
    return z.object({ refreshToken: z.string().min(10).max(200) }).strict();
  }

  public static verifyEmail(): z.ZodType {
    return z.object({ token: z.string().min(10).max(200) }).strict();
  }

  public static resendVerification(): z.ZodType {
    return z.object({ email: z.string().min(3).max(320).email() }).strict();
  }

  public static forgotPassword(): z.ZodType {
    return z.object({ email: z.string().min(3).max(320).email() }).strict();
  }

  public static resetPassword(): z.ZodType {
    return z
      .object({
        token: z.string().min(10).max(200),
        newPassword: z
          .string()
          .min(HandlerSchemas.MIN_PASSWORD_LENGTH)
          .max(HandlerSchemas.MAX_PASSWORD_LENGTH),
      })
      .strict();
  }
}
