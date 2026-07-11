#!/usr/bin/env node
/**
 * Deterministic brand + house-style lint for a blog post's Markdown source.
 * A machine backstop for blog/CLAUDE.md §4/§5 — the unattended writer must never
 * be the only thing checking its own compliance.
 *
 * ERRORS (exit 1, block the post):
 *   - Backend leakage: "streamvc" or "MacProvider" anywhere (§5 non-negotiable).
 *   - Smart/curly quotes and apostrophes (§4 requires straight only).
 *   - Unambiguous AI-slop phrases that are never right here.
 * WARNINGS (reported, do not block): context-dependent banned words for the
 *   human reviewer to weigh.
 *
 * Usage:
 *   node scripts/blog-lint.mjs <slug>              # lints blog/posts/<slug>.md
 *   node scripts/blog-lint.mjs --file <path.md>
 */
import { readFileSync, existsSync } from 'node:fs';

const arg = process.argv[2];
const file =
  arg === '--file'
    ? process.argv[3]
    : arg
      ? `blog/posts/${arg.replace(/^.*\//, '').replace(/\.md$/, '')}.md`
      : null;

if (!file || !existsSync(file)) {
  console.error(`blog-lint: file not found (${file || 'no slug/path given'})`);
  process.exit(2);
}

const text = readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);

const BRAND_FORBIDDEN = [/streamvc/i, /macprovider/i];
const SMART_QUOTES = /[‘’“”]/; // curly quotes/apostrophes (em-dash U+2014 is allowed)

// Never-right-here phrases → hard error.
const SLOP_ERRORS = [
  'revolutionary', 'game-changing', 'game-changer', 'supercharge', 'best-in-class',
  'cutting-edge', 'state-of-the-art', 'unprecedented', 'transformative', 'seamless',
  'seamlessly', "in today's fast-paced world", "it's important to note",
  'at the end of the day', 'in conclusion',
];
// Context-dependent → warn only.
const SLOP_WARN = [
  'leverage', 'robust', 'ecosystem', 'landscape', 'empower', 'elevate', 'unlock',
  'delve', 'harness the power of', 'when it comes to', 'the world of',
];

const errors = [];
const warnings = [];

lines.forEach((line, i) => {
  const n = i + 1;
  for (const re of BRAND_FORBIDDEN) {
    const m = line.match(re);
    if (m) errors.push(`L${n}: backend leak "${m[0]}" — never expose in content (CLAUDE.md §5)`);
  }
  if (SMART_QUOTES.test(line)) {
    errors.push(`L${n}: smart/curly quote — use straight quotes only (CLAUDE.md §4)`);
  }
});

const hay = text.toLowerCase();
const wordHit = (term) => {
  const t = term.toLowerCase();
  // word-ish boundary for single words; substring for multi-word phrases
  if (/\s/.test(t)) return hay.includes(t);
  return new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).test(hay);
};
for (const term of SLOP_ERRORS) if (wordHit(term)) errors.push(`banned phrase "${term}" (CLAUDE.md §4)`);
for (const term of SLOP_WARN) if (wordHit(term)) warnings.push(`possible AI-slop "${term}" — verify it's intentional`);

if (warnings.length) {
  console.log(`blog-lint warnings for ${file}:`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (errors.length) {
  console.error(`blog-lint FAILED for ${file}:`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
console.log(`blog-lint: ${file} clean (${warnings.length} warning(s)).`);
