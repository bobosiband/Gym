/**
 * OpenAPI 3.1 validation helper used by `tests/logging/OpenApiSpec.test.ts`.
 *
 * Kept inside `services/logging/scripts/` so that both `@readme/openapi-parser`
 * and `js-yaml` resolve inside this package's own `node_modules`;
 * the test file lives outside the service and would not otherwise
 * find them.
 */

import OpenAPIParser from '@readme/openapi-parser';
import { load } from 'js-yaml';

/**
 * Parse the YAML string and validate it against the OpenAPI 3.1
 * standard. Throws on either parse or validation failure.
 */
export async function parseAndValidate(yaml: string): Promise<unknown> {
  const parsed = load(yaml);
  await OpenAPIParser.validate(parsed as never);
  return parsed;
}

/**
 * Parse the YAML string without validation. Used for tests that
 * inspect the parsed structure directly.
 */
export function parseYaml(yaml: string): unknown {
  return load(yaml);
}
