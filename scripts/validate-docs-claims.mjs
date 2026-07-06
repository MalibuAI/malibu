#!/usr/bin/env node
/**
 * Validates that Litepaper quantitative/trust claims link to evidence pages.
 * Run: node scripts/validate-docs-claims.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const litepaperPath = join(root, 'docs', 'litepaper.mdx');

const REQUIRED_EVIDENCE_PAGES = [
  'docs/network/benchmarks-and-methodology.mdx',
  'docs/network/threat-model.mdx',
  'docs/network/toploc.mdx',
  'docs/network/glossary.mdx',
  'docs/guides/pricing-comparison.mdx',
  'docs/guides/provider-economics.mdx',
  'docs/status.mdx',
  'docs/roadmap.mdx',
  'docs/changelog.mdx',
];

/** Litepaper must link to these paths (Mintlify routes, no /docs prefix). */
const LITEPAPER_REQUIRED_LINKS = [
  '/network/benchmarks-and-methodology',
  '/guides/pricing-comparison',
  '/guides/provider-economics',
  '/network/threat-model',
  '/network/toploc',
  '/status',
];

/** Patterns that must not appear without nearby evidence links. */
const BANNED_UNQUALIFIED = [
  { pattern: /\blive P2P\b/i, message: 'Use "coordinated inference network" — not "live P2P"' },
  { pattern: /\bPrivate\.\s*No data harvesting/i, message: 'Privacy bullet must use cooperative-trust framing' },
  { pattern: /\bNo tampering\b/i, message: '"No tampering" requires TOPLOC live — use threat-model language' },
];

function fail(msg) {
  console.error(`validate-docs-claims: ${msg}`);
  process.exitCode = 1;
}

if (!existsSync(litepaperPath)) {
  fail('docs/litepaper.mdx not found');
  process.exit(1);
}

const litepaper = readFileSync(litepaperPath, 'utf8');
let errors = 0;

for (const rel of REQUIRED_EVIDENCE_PAGES) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    console.error(`missing evidence page: ${rel}`);
    errors++;
  }
}

for (const link of LITEPAPER_REQUIRED_LINKS) {
  if (!litepaper.includes(link)) {
    console.error(`litepaper missing required evidence link: ${link}`);
    errors++;
  }
}

for (const { pattern, message } of BANNED_UNQUALIFIED) {
  if (pattern.test(litepaper)) {
    console.error(`litepaper banned claim: ${message}`);
    errors++;
  }
}

if (!litepaper.includes('Network status') && !litepaper.includes('/status')) {
  console.error('litepaper missing Network status / reality-check link');
  errors++;
}

if (!litepaper.includes('90%') || !/70[%¢]|70\/12\/18/.test(litepaper)) {
  console.error('litepaper must distinguish today (90%) vs launch (70%) economics');
  errors++;
}

if (errors === 0) {
  console.log('validate-docs-claims: OK — evidence pages present and litepaper cross-links verified');
} else {
  fail(`${errors} check(s) failed`);
  process.exit(1);
}
