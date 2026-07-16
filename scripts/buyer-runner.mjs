#!/usr/bin/env node
// Fires a small batch of real chat-completions requests against the live
// Malibu gateway (api.streamvc.live today; api.malibu.tech once DNS is cut
// over) so the /network dashboard reflects actual pool activity instead of
// "awaiting first traffic". Each request is real
// inference, billed and settled like any buyer request — this is genuine
// traffic generation, not mock data. Meant to be invoked periodically by cron
// or launchd (see scripts/buyer-runner.md), not run as a long-lived daemon.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// cron/launchd don't source shell profiles, so load a local .env file
// ourselves rather than requiring a wrapper script or a dotenv dependency.
function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(join(projectRoot, '.env.local'));
loadEnvFile(join(projectRoot, '.env'));

// The public brand endpoint api.malibu.tech is not in DNS yet; the live gateway
// is api.streamvc.live (same host the console proxies to). Override via
// MALIBU_API_BASE once the branded hostname is cut over.
const API_BASE = (process.env.MALIBU_API_BASE || 'https://api.streamvc.live/v1').replace(/\/+$/, '');
const API_KEY = process.env.MALIBU_API_KEY;
const REQUESTS_PER_RUN = Number(process.env.BUYER_RUNNER_REQUESTS || 3);
const MAX_TOKENS = Number(process.env.BUYER_RUNNER_MAX_TOKENS || 120);

if (!API_KEY) {
  console.error('[buyer-runner] MALIBU_API_KEY is not set. Aborting.');
  process.exit(1);
}

// Fallback list if /v1/models can't be reached. Small, cheap models only —
// this script's job is to keep the pool visibly warm, not to burn buyer
// credits on large weights.
const FALLBACK_MODELS = [
  'mlx-community/Qwen2.5-7B-Instruct-4bit',
  'mlx-community/Llama-3.2-3B-Instruct-4bit',
];

// Discover what the pool is actually serving instead of assuming model IDs
// (which drift as the catalog changes). Prefer smaller models by name heuristic
// so we stay cheap. Falls back to the static list if the call fails.
async function resolveModels() {
  try {
    const res = await fetch(`${API_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ids = (data.data || []).map((m) => m.id).filter(Boolean);
    if (!ids.length) throw new Error('empty model list');
    // Bias toward the smallest-looking weights (a "3B" beats a "70B").
    const sizeOf = (id) => {
      const m = id.match(/(\d+(?:\.\d+)?)\s*[bB]\b/);
      return m ? parseFloat(m[1]) : Infinity;
    };
    ids.sort((a, b) => sizeOf(a) - sizeOf(b));
    const smallest = ids.slice(0, Math.max(2, Math.ceil(ids.length / 2)));
    console.log(`[buyer-runner] pool serving ${ids.length} model(s); using: ${smallest.join(', ')}`);
    return smallest;
  } catch (err) {
    console.warn(`[buyer-runner] /v1/models unavailable (${err.message}); using fallback list`);
    return FALLBACK_MODELS;
  }
}

// Short, varied prompts so requests don't look like an obvious canned loop.
const PROMPTS = [
  'Give one interesting fact about Apple Silicon in a single sentence.',
  'Explain what a WebSocket ping/pong is in one sentence.',
  'Name three prime numbers between 50 and 100.',
  'Summarize what a coordinator does in a routing system, in two sentences.',
  'Write a haiku about idle compute becoming useful.',
  'What is the capital of Lithuania?',
  'Give a one-line definition of prefix caching for LLM inference.',
  'List two benefits of open-source AI models over closed ones.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function sendOne(i, models) {
  const prompt = pick(PROMPTS);
  const started = Date.now();
  // Try each candidate model in random order so a transient
  // 503 no_provider_available on one model rolls over to another instead of
  // leaving an empty minute-bucket on the /network chart.
  const order = [...models].sort(() => Math.random() - 0.5);
  try {
    let res, model, body;
    for (let attempt = 0; attempt < order.length; attempt++) {
      model = order[attempt];
      res = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'X-Malibu-Conversation': `buyer-runner-${Date.now()}-${i}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: MAX_TOKENS,
        }),
      });
      if (res.ok) break;
      body = await res.text().catch(() => '');
      // Only a busy-pool 503 is worth rolling over to another model.
      if (res.status !== 503 || attempt === order.length - 1) {
        console.error(`[buyer-runner] ${model} -> HTTP ${res.status} ${body.slice(0, 160)}`);
        return;
      }
    }
    if (!res.ok) return;

    const data = await res.json();
    const usage = data.usage || {};
    const servedBy =
      res.headers.get('x-provider-id') ||
      res.headers.get('X-Malibu-Provider') ||
      'unknown';
    const ms = Date.now() - started;
    console.log(
      `[buyer-runner] ${model} served_by=${servedBy} ` +
      `tokens=${usage.total_tokens ?? '?'} (in=${usage.prompt_tokens ?? '?'} out=${usage.completion_tokens ?? '?'}) ` +
      `${ms}ms`
    );
  } catch (err) {
    console.error(`[buyer-runner] ${model} request failed:`, err.message);
  }
}

async function main() {
  const models = await resolveModels();
  // Stagger requests within the run instead of firing them all at once, so
  // the traffic looks like a trickle of individual prompts rather than a burst.
  for (let i = 0; i < REQUESTS_PER_RUN; i++) {
    await sendOne(i, models);
    if (i < REQUESTS_PER_RUN - 1) {
      const delay = 5000 + Math.random() * 15000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

main();
