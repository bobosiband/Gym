import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generateOpenApiYaml } from '../../services/logging/scripts/genOpenapi.js';
import { parseAndValidate, parseYaml } from '../../services/logging/scripts/validateOpenapi.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..');
const yamlPath = resolve(repoRoot, 'docs', 'swagger', 'logging.yaml');

describe('docs/swagger/logging.yaml', () => {
  it('is byte-equal to the output of the generator (no drift)', () => {
    const committed = readFileSync(yamlPath, 'utf8');
    const generated = generateOpenApiYaml();
    expect(committed).toBe(generated);
  });

  it('is a valid OpenAPI 3.1 document', async () => {
    const committed = readFileSync(yamlPath, 'utf8');
    await expect(parseAndValidate(committed)).resolves.toBeTruthy();
  });

  it('has an https production server URL and no localhost', () => {
    const committed = readFileSync(yamlPath, 'utf8');
    const parsed = parseYaml(committed) as { servers?: { url: string }[] };
    expect(parsed.servers?.length).toBeGreaterThan(0);
    for (const server of parsed.servers ?? []) {
      expect(server.url.startsWith('https://')).toBe(true);
      expect(server.url).not.toContain('localhost');
      expect(server.url).not.toContain('127.0.0.1');
    }
  });
});
