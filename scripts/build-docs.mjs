#!/usr/bin/env node
/**
 * Export Mintlify docs to dist/docs for Vercel static hosting at /docs.
 * Rewrites root-absolute asset and nav URLs to /docs/* so they work on malibu.tech.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');
const distDocs = join(root, 'dist', 'docs');
const zipPath = join(root, '.tmp-docs-export.zip');

const TEXT_EXTENSIONS = /\.(html|js|css|json|txt|xml|md)$/i;

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

if (!existsSync(docsDir)) {
  console.error('docs/ directory not found');
  process.exit(1);
}

console.log('Exporting Mintlify docs...');
run(`npx --yes mintlify@latest export --output ${JSON.stringify(zipPath)}`, docsDir);

rmSync(distDocs, { recursive: true, force: true });
mkdirSync(distDocs, { recursive: true });
run(`unzip -q ${JSON.stringify(zipPath)} -d ${JSON.stringify(distDocs)}`);
rmSync(zipPath, { force: true });

function prefixAbsolutePaths(content) {
  // Only rewrite root-relative URL paths inside quoted strings (HTML attrs, JS string literals).
  // Require a path-like character after `/` so grammar tokens like `"/>"` and `"/**"` stay intact.
  // Skip regex closing delimiters like `/="([^"]*)"/g` where `/` is preceded by `"`.
  // Do NOT rewrite `/` inside regex literals like .replace(/^\/+/, '').
  return content
    .replace(
      /(?<=["'`])\/(?!docs\/)(?![a-z]+:)(?=[a-zA-Z0-9_/.])(?![gimsuvy]+[,;)\s\]])/g,
      '/docs/',
    )
    .replace(/\/docs\/docs\//g, '/docs/');
}

function assertNoPathRewriteCorruption(dir) {
  const corruptionPatterns = [
    /\/docs\/\^/,
    /"\/docs\/>/,
    /\.replace\(\/docs\//,
    /\/docs\/[gimsuvy]+[,;)\s\]]/,
  ];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      assertNoPathRewriteCorruption(path);
      continue;
    }
    if (!TEXT_EXTENSIONS.test(name)) continue;
    const text = readFileSync(path, 'utf8');
    for (const pattern of corruptionPatterns) {
      if (pattern.test(text)) {
        console.error(`Path rewrite corruption detected in ${path}`);
        process.exit(1);
      }
    }
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!TEXT_EXTENSIONS.test(name)) continue;
    const original = readFileSync(path, 'utf8');
    const rewritten = prefixAbsolutePaths(original);
    if (rewritten !== original) writeFileSync(path, rewritten);
  }
}

console.log('Rewriting exported paths for /docs hosting...');
walk(distDocs);
assertNoPathRewriteCorruption(distDocs);

const llmsPath = join(distDocs, 'llms.txt');
const llmsEntries = [
  '# Malibu Docs',
  '',
  '## Narrative',
  '- [Litepaper](/docs/litepaper): Why Malibu exists — vision with live/planned labels',
  '',
  '## Ledger',
  '- [Network status](/docs/status): Shipped vs planned ledger',
  '- [Roadmap](/docs/roadmap): Protocol milestones',
  '- [Changelog](/docs/changelog): API and docs changes',
  '',
  '## Evidence (claim validation)',
  '- [Benchmarks & methodology](/docs/network/benchmarks-and-methodology): PoMW evidence scope',
  '- [Pricing comparison](/docs/guides/pricing-comparison): Buyer savings methodology',
  '- [Provider economics](/docs/guides/provider-economics): Earnings assumptions',
  '- [Threat model](/docs/network/threat-model): Adversary catalog',
  '- [TOPLOC integration](/docs/network/toploc): Planned v1 verification',
  '- [Glossary](/docs/network/glossary): Term definitions',
  '',
  '## Reference',
  '- [Getting started](/docs/getting-started/introduction)',
  '- [Security & trust model](/docs/network/security)',
  '- [API reference](/docs/api/chat-completions)',
].join('\n');

if (existsSync(llmsPath)) {
  const llms = readFileSync(llmsPath, 'utf8');
  if (!llms.includes('Benchmarks & methodology')) {
    writeFileSync(llmsPath, llms.trimEnd() + '\n\n' + llmsEntries.split('\n').slice(2).join('\n') + '\n');
    console.log('Patched llms.txt with ledger and evidence pages');
  }
} else {
  writeFileSync(llmsPath, llmsEntries + '\n');
  console.log('Generated llms.txt with ledger and evidence pages');
}

console.log(`Docs built at ${distDocs}`);
