#!/usr/bin/env node
/**
 * style-check.mjs
 *
 * Fails if any tracked repo file contains an em dash, en dash, or emoji.
 * Skips binary, build, and vendor paths. Used by `pnpm style:check` and CI.
 */

import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const FORBIDDEN = new RegExp('[\\u2013\\u2014]|[\\u{1F300}-\\u{1FAFF}]|[\\u{2600}-\\u{27BF}]', 'u');

const SKIP_PATH_PREFIXES = [
  'node_modules/',
  '.git/',
  '.pnpm-store/',
  'dist/',
  'build/',
  'target/',
  'coverage/',
  '.next/',
  '.turbo/',
  '.venv/',
  'docs/uml/',
];

const SKIP_EXACT = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

function listTrackedFiles() {
  try {
    const out = execSync('git ls-files', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    console.error('style-check: unable to list files via git. Is this a git repo?');
    throw err;
  }
}

function isSkipped(path) {
  if (SKIP_EXACT.has(path)) return true;
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

function isLikelyBinary(path) {
  try {
    const buf = readFileSync(path);
    for (let i = 0; i < Math.min(buf.length, 8000); i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function main() {
  const files = listTrackedFiles();
  const offences = [];

  for (const file of files) {
    if (isSkipped(file)) continue;
    try {
      statSync(file);
    } catch {
      continue;
    }
    if (isLikelyBinary(file)) continue;

    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (FORBIDDEN.test(line)) {
        offences.push({ file, line: idx + 1, text: line.trim().slice(0, 160) });
      }
    });
  }

  if (offences.length > 0) {
    console.error('style-check: forbidden characters found (em dash, en dash, or emoji):');
    for (const o of offences) {
      console.error(`  ${o.file}:${o.line}: ${o.text}`);
    }
    console.error(`\nTotal offences: ${offences.length}`);
    process.exit(1);
  }

  console.log(`style-check: OK (${files.length} files scanned)`);
}

main();
