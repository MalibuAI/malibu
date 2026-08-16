#!/usr/bin/env node
/**
 * Validates Litepaper evidence links and blocks stale live-API claims.
 * Run: node scripts/validate-docs-claims.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');
const litepaperPath = join(docsDir, 'litepaper.mdx');
const downloadPath = join(docsDir, 'getting-started', 'download-malibu.mdx');
const statusPath = join(docsDir, 'status.mdx');

const REQUIRED_EVIDENCE_PAGES = [
  'docs/network/benchmarks-and-methodology.mdx',
  'docs/network/threat-model.mdx',
  'docs/network/toploc.mdx',
  'docs/network/glossary.mdx',
  'docs/guides/pricing-comparison.mdx',
  'docs/guides/provider-economics.mdx',
  'docs/guides/economics.mdx',
  'docs/status.mdx',
  'docs/roadmap.mdx',
  'docs/changelog.mdx',
];

const LITEPAPER_REQUIRED_LINKS = [
  '/network/benchmarks-and-methodology',
  '/guides/pricing-comparison',
  '/guides/provider-economics',
  '/guides/economics',
  '/network/threat-model',
  '/network/toploc',
  '/agentic/buyer-side-validation',
  '/status',
];

const BANNED_UNQUALIFIED = [
  { pattern: /\blive P2P\b/i, message: 'Use "coordinated inference network" — not "live P2P"' },
  { pattern: /\bPrivate\.\s*No data harvesting/i, message: 'Privacy bullet must use cooperative-trust framing' },
  { pattern: /\bNo tampering\b/i, message: '"No tampering" requires TOPLOC live — use threat-model language' },
  { pattern: /Nobody else has a reason to build this/i, message: 'Competitive absolute — credit overlapping networks' },
];

function walkMdx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkMdx(path, acc);
    else if (name.endsWith('.mdx') || name.endsWith('.md')) acc.push(path);
  }
  return acc;
}

function fail(msg) {
  console.error(`validate-docs-claims: ${msg}`);
  process.exitCode = 1;
}

if (!existsSync(litepaperPath)) {
  fail('docs/litepaper.mdx not found');
  process.exit(1);
}

const litepaper = readFileSync(litepaperPath, 'utf8');
const download = existsSync(downloadPath) ? readFileSync(downloadPath, 'utf8') : '';
const status = existsSync(statusPath) ? readFileSync(statusPath, 'utf8') : '';
let errors = 0;

for (const rel of REQUIRED_EVIDENCE_PAGES) {
  if (!existsSync(join(root, rel))) {
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

if (!litepaper.includes('90%') || !/70[%¢]|70\/12\/18/.test(litepaper)) {
  console.error('litepaper must distinguish today (90%) vs launch (70%) economics');
  errors++;
}

if (!/invite/i.test(download)) {
  console.error('download-malibu.mdx must mention invite-gated admission');
  errors++;
}

if (!status.includes('malibu.tech/v1/stats/overview')) {
  console.error('status.mdx must document https://malibu.tech/v1/stats/overview');
  errors++;
}

if (!status.includes('malibu.tech/v1/rate-card')) {
  console.error('status.mdx must document https://malibu.tech/v1/rate-card');
  errors++;
}

const marketingPages = [
  ['index.html', join(root, 'index.html')],
  ['host/index.html', join(root, 'host/index.html')],
];
for (const [rel, path] of marketingPages) {
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  if (/earn USDC \+ \$MALIBU/i.test(text) || /USDC and \$MALIBU in real time/i.test(text)) {
    console.error(`${rel}: live earn copy must not sell $MALIBU in present tense — USDC today, token at launch`);
    errors++;
  }
}

const staleDefault = 'mlx-community/Qwen2.5-7B-Instruct-4bit';
for (const file of walkMdx(docsDir)) {
  const text = readFileSync(file, 'utf8');
  const rel = file.slice(root.length + 1);

  if (text.includes(staleDefault)) {
    console.error(`${rel}: stale default model ${staleDefault} — use a warm ID`);
    errors++;
  }

  for (const url of ['api.malibu.tech/v1/rate-card', 'api.malibu.tech/v1/network-stats']) {
    if (!text.includes(url)) continue;
    const allowed = /404|not served|not on the gateway|Not served|by design|wrong host/i.test(text);
    if (!allowed) {
      console.error(`${rel}: ${url} documented as live — use malibu.tech proxy or mark 404`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log('validate-docs-claims: OK — evidence pages, admission, and live API URLs verified');
} else {
  fail(`${errors} check(s) failed`);
  process.exit(1);
}
