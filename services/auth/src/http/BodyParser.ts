import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { z, ZodType } from 'zod';

/**
 * Request body validation outcome. Discriminated so handlers can
 * exhaustive-switch over it.
 */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: 'too_large' | 'invalid' | 'missing';
      readonly message: string;
    };

/**
 * Validates incoming request bodies against a Zod schema with strict
 * key handling (unknown fields are rejected) and a hard cap on raw
 * body length so a malicious client cannot drive memory usage.
 *
 * The schema is passed in by each handler so handlers remain the
 * single source of truth for their own input shape. Stateless; use
 * via static methods.
 */
export class BodyParser {
  public static readonly MAX_BODY_BYTES = 4096;

  private constructor() {
    // utility class; never instantiated
  }

  public static parse<S extends ZodType>(
    event: APIGatewayProxyEventV2,
    schema: S
  ): ParseResult<z.infer<S>> {
    const rawBody = event.body ?? '';
    if (rawBody.length === 0) {
      return { ok: false, reason: 'missing', message: 'request body is required' };
    }
    const decoded = event.isBase64Encoded
      ? Buffer.from(rawBody, 'base64').toString('utf8')
      : rawBody;
    if (Buffer.byteLength(decoded, 'utf8') > BodyParser.MAX_BODY_BYTES) {
      return { ok: false, reason: 'too_large', message: 'request body too large' };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      return { ok: false, reason: 'invalid', message: 'request body is not valid JSON' };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, reason: 'invalid', message: 'request body failed validation' };
    }
    return { ok: true, value: result.data };
  }
}
