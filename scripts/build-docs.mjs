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
  // Prefix root-relative URLs used by the exported Mintlify app.
  // Skip external URLs, protocol-relative URLs, and already-prefixed /docs paths.
  return content
    .replace(/(?<=["'`(])\/(?!docs\/)(?![a-z]+:)/g, '/docs/')
    .replace(/\/docs\/docs\//g, '/docs/');
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
console.log(`Docs built at ${distDocs}`);
