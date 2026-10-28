import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WgerImporter } from './WgerImporter.js';
import type { WgerImporterConfig } from './WgerImporter.js';

const DEFAULT_API_BASE = 'https://wger.de';
const ENGLISH_LANGUAGE_ID = 2;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_DELAY_MS = 500;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDir, '..', 'seeds', 'wger.sql');

const config: WgerImporterConfig = {
  apiBase: process.env['WGER_API_BASE'] ?? DEFAULT_API_BASE,
  language: ENGLISH_LANGUAGE_ID,
  pageSize: Number(process.env['WGER_PAGE_SIZE'] ?? DEFAULT_PAGE_SIZE),
  delayMsBetweenPages: Number(process.env['WGER_DELAY_MS'] ?? DEFAULT_DELAY_MS),
  outputPath,
};

console.log('wger import starting:');
console.log(`  base:       ${config.apiBase}`);
console.log(`  language:   ${config.language} (English)`);
console.log(`  page size:  ${config.pageSize}`);
console.log(`  delay:      ${config.delayMsBetweenPages} ms between pages`);
console.log(`  output:     ${config.outputPath}`);
console.log('');

const importer = new WgerImporter(config);
const summary = await importer.run();

console.log('wger import complete:');
console.log(`  fetched:                   ${summary.totalFetched}`);
console.log(`  imported:                  ${summary.imported}`);
console.log(`  skipped (no English name): ${summary.skippedNoName}`);
console.log(`  skipped (no licence):      ${summary.skippedNoLicence}`);
console.log(`  bytes written:             ${summary.bytesWritten}`);
console.log(`  output path:               ${summary.outputPath}`);
