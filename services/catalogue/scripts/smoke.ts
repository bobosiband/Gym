import { argv, exit } from 'node:process';

import { SmokeTest } from './SmokeTest.js';

const baseUrl = argv[2];
if (baseUrl === undefined || baseUrl.length === 0) {
  console.error('Usage: pnpm --filter @gym/catalogue smoke <base-url>');
  console.error('Example: pnpm --filter @gym/catalogue smoke https://gym-catalogue.workers.dev');
  exit(2);
}

console.log(`Smoke-testing ${baseUrl}`);
const smoke = new SmokeTest(baseUrl);
const result = await smoke.run();

for (const failure of result.failures) {
  console.error(`FAIL  ${failure.label}: ${failure.message}`);
}
console.log(`${result.passed}/${result.passed + result.failed} checks passed.`);

if (result.failed > 0) {
  exit(1);
}
