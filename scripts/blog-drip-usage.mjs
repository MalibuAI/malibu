#!/usr/bin/env node
/**
 * Extract cost / turns / duration from the claude-code-action `execution_file`
 * so the drip notification can report what a run actually spent. Prints
 * `key=value` lines suitable for appending to $GITHUB_OUTPUT.
 *
 * Defensive by design: the execution-file schema is not contractually stable,
 * so anything unparseable degrades to `n/a` rather than failing the workflow.
 *
 * Usage: node scripts/blog-drip-usage.mjs <execution_file_path>
 */
import { readFileSync, existsSync } from 'node:fs';

const file = process.argv[2];

function emit(cost, turns, durationMs) {
  const dur =
    typeof durationMs === 'number' && durationMs > 0
      ? `${Math.round(durationMs / 1000)}s`
      : 'n/a';
  const costStr = typeof cost === 'number' ? `$${cost.toFixed(2)}` : 'n/a';
  const turnStr = Number.isFinite(turns) ? String(turns) : 'n/a';
  process.stdout.write(`cost=${costStr}\nturns=${turnStr}\nduration=${dur}\n`);
}

function collectObjects(raw) {
  // Try whole-file JSON (array or object) first, then JSONL.
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [v];
  } catch {
    /* not a single JSON doc */
  }
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* skip non-JSON line */
    }
  }
  return out;
}

function pick(obj) {
  // A field may sit on the object or on a nested `.result`/`.usage`.
  const c =
    obj?.total_cost_usd ?? obj?.cost_usd ?? obj?.result?.total_cost_usd ?? obj?.usage?.total_cost_usd;
  const t = obj?.num_turns ?? obj?.turns ?? obj?.result?.num_turns;
  const d = obj?.duration_ms ?? obj?.duration ?? obj?.result?.duration_ms;
  return { c, t, d };
}

try {
  if (!file || !existsSync(file)) {
    emit();
  } else {
    const objs = collectObjects(readFileSync(file, 'utf8'));
    // Prefer the last entry that actually carries a cost figure.
    let best = null;
    for (const o of objs) {
      const p = pick(o);
      if (typeof p.c === 'number') best = p;
    }
    if (!best) {
      // fall back to any turns/duration we can find
      for (const o of objs) {
        const p = pick(o);
        if (Number.isFinite(p.t) || typeof p.d === 'number') best = p;
      }
    }
    emit(best?.c, best?.t, best?.d);
  }
} catch {
  emit();
}
