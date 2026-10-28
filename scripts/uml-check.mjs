#!/usr/bin/env node
/**
 * uml-check.mjs
 *
 * Enforces the "every feature updates its UML" rule from docs/architecture.md.
 *
 * For a given diff range (default: HEAD against origin/main), fails if any
 * file under apps/<x>/src/** or services/<x>/src/** changed without a
 * matching change under docs/uml/<x>/**.
 *
 * In Stage 1 there are no src/ folders yet, so this script passes trivially.
 * It is wired up now so Stage 2 feature PRs are checked from day one.
 */

import { execSync } from 'node:child_process';

const BASE = process.env.UML_CHECK_BASE ?? 'origin/main';
const HEAD = process.env.UML_CHECK_HEAD ?? 'HEAD';

function diffFiles(base, head) {
  try {
    const out = execSync(`git diff --name-only ${base} ${head}`, { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    const out = execSync('git ls-files', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  }
}

function serviceOrAppFromPath(path) {
  const svc = path.match(/^services\/([^/]+)\/src\//);
  if (svc) return { kind: 'service', name: svc[1] };
  const app = path.match(/^apps\/([^/]+)\/src\//);
  if (app) return { kind: 'app', name: app[1] };
  return null;
}

function umlChangedFor(name, changed) {
  const prefix = `docs/uml/${name}/`;
  return changed.some((p) => p.startsWith(prefix));
}

function main() {
  const changed = diffFiles(BASE, HEAD);
  const violations = new Set();

  for (const path of changed) {
    const owner = serviceOrAppFromPath(path);
    if (!owner) continue;
    if (!umlChangedFor(owner.name, changed)) {
      violations.add(
        `${owner.kind} "${owner.name}" source changed without a matching docs/uml/${owner.name}/ update`
      );
    }
  }

  if (violations.size > 0) {
    console.error(
      'uml-check: UML diagrams must be updated in the same commit or PR as source changes.'
    );
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log('uml-check: OK');
}

main();
