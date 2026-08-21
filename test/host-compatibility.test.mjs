import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPublicKey, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const TRUSTED_AUTOTUNE_V4_PUBLIC_KEY_BASE64 = 'zTKDIdMmKKkO1Cgf5OdTzMOytVqW7U8SGsJ9XrzAltU=';

function ed25519PublicKeyFromRawBase64(rawBase64) {
  const raw = Buffer.from(rawBase64, 'base64');
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

import {
  deriveBandwidthTier,
  enrichCompatibilityWithCanIRunSpeeds,
  evaluateHostCompatibility,
  HOST_CATALOG,
} from '../j/host-compatibility.mjs';

test('derives Mac bandwidth tiers from chip family names', () => {
  assert.equal(deriveBandwidthTier('Apple M4'), 'C');
  assert.equal(deriveBandwidthTier('Apple M4 Pro'), 'B');
  assert.equal(deriveBandwidthTier('Apple M4 Max'), 'A');
  assert.equal(deriveBandwidthTier('Apple M4 Ultra'), 'S');
  assert.equal(deriveBandwidthTier('Hidden by browser'), 'C');
  assert.equal(deriveBandwidthTier('Apple M4 Prototype'), 'C');
  assert.equal(deriveBandwidthTier('Apple M4 Maximize'), 'C');
  assert.equal(deriveBandwidthTier('Apple M4 Professional'), 'C');
});

test('unsupported chip strings collapse to a finite Apple Silicon profile', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M4 Max exploit variant 123', ramGb: 32 });
  assert.equal(result.hardware.chip, 'Apple Silicon');
  assert.equal(result.hardware.bandwidthTier, 'C');
});

test('compatibility preview is bound to the MacProvider catalog snapshot', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M3 Pro', ramGb: 36 });
  assert.equal(result.catalog.releaseId, HOST_CATALOG.releaseId);
  assert.equal(result.catalog.source, 'operator_curated_autotune_candidate_catalog');
  assert.equal(result.catalog.candidateCatalogSha256.length, 64);
  assert.equal(result.catalog.signerKeyId, 'streamvc-autotune-static-v4');
  assert.equal(result.rows.length, HOST_CATALOG.rows.length);
  assert.equal(result.rows.every((row) => typeof row.key === 'string' && row.key.length > 0), true);
  assert.equal(result.rows.every((row) => typeof row.modelSha256 === 'string' && row.modelSha256.length === 64), true);
  assert.equal(result.rows.every((row) => row.canIRunModelId === undefined), true);
  assert.equal(result.rows.every((row) => row.canIRunQuantization === undefined), true);
});

test('catalog digest matches the checked-in signed candidate payload', async () => {
  const raw = await readFile(new URL('../j/macprovider/autotune-candidates.published-2026-07-29.json', import.meta.url));
  const digest = createHash('sha256').update(raw).digest('hex');
  const sig = JSON.parse(await readFile(new URL('../j/macprovider/autotune-candidates.published-2026-07-29.json.sig', import.meta.url), 'utf8'));
  const release = JSON.parse(await readFile(new URL('../j/macprovider/release.published-2026-07-29.json', import.meta.url), 'utf8'));
  assert.equal(digest, HOST_CATALOG.candidateCatalogSha256);
  assert.equal(release.feeds['autotune-candidates.json'].sha256, HOST_CATALOG.candidateCatalogSha256);
  assert.equal(release.feeds['autotune-candidates.json'].signer_key_id, HOST_CATALOG.signerKeyId);
  assert.equal(sig.key_id, HOST_CATALOG.signerKeyId);
  assert.equal(sig.alg, 'ed25519');
  assert.equal(
    verify(null, raw, ed25519PublicKeyFromRawBase64(TRUSTED_AUTOTUNE_V4_PUBLIC_KEY_BASE64), Buffer.from(sig.signature, 'base64')),
    true,
  );
});

test('16 GB base Mac fits only the small current catalog rows', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M2', ramGb: 16 });
  const fitted = result.rows.filter((row) => row.eligiblePreview).map((row) => row.key);
  assert.deepEqual(new Set(fitted), new Set([
    'qwen3-8b',
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/llama-3.2-3b-instruct',
  ]));
  assert.equal(result.hardware.usableRamGb, 12);
  assert.equal(result.catalogCeiling.state, 'within_current_preview');
});

test('128 GB Max Mac is represented as above current preview, not incapable', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M4 Max', ramGb: 128 });
  assert.equal(result.compatibleCount, HOST_CATALOG.rows.length);
  assert.equal(result.catalogCeiling.state, 'above_current_preview');
  assert.match(result.catalogCeiling.message, /more memory than the current public preview rows need/);
  assert.equal(result.rows[0].eligiblePreview, true);
  assert.equal(result.rows.some((row) => row.label === 'Needs more RAM'), false);
});

test('high-RAM base Macs still respect catalog bandwidth tiers', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M4', ramGb: 128 });
  assert.equal(result.catalogCeiling.state, 'high_memory_tier_limited');
  assert.match(result.catalogCeiling.message, /some rows still require a Pro, Max, or Ultra/);
  const qwen32 = result.rows.find((row) => row.key === 'qwen3-32b');
  const qwenCoder32 = result.rows.find((row) => row.key === 'qwen2.5-coder-32b-instruct');
  assert.equal(qwen32.eligiblePreview, false);
  assert.equal(qwen32.label, 'Needs higher tier');
  assert.equal(qwenCoder32.eligiblePreview, false);
  assert.equal(qwenCoder32.label, 'Needs higher tier');
});

test('rejects impossible memory profiles', () => {
  assert.throws(
    () => evaluateHostCompatibility({ chip: 'Apple M4', ramGb: 2 }),
    /ramGb must be a number from 4 to 512/,
  );
});

test('adds oMLX observed speed hints without changing catalog eligibility', () => {
  const result = evaluateHostCompatibility({ chip: 'Apple M4', ramGb: 32 });
  const gptOss = result.rows.find((row) => row.key === 'openai/gpt-oss-20b');
  assert.equal(gptOss.eligiblePreview, true);
  assert.equal(gptOss.advisorySpeed.source, 'omlx');
  assert.equal(gptOss.advisorySpeed.usedForAdmission, false);
  assert.equal(gptOss.advisorySpeed.tgTps, 32.7);
  assert.match(gptOss.speedLabel, /Observed ~33 tok\/s · oMLX 4k/);
});

test('uses checked-in CanIRun estimates only as an advisory fallback', async () => {
  const base = evaluateHostCompatibility({ chip: 'Apple M4', ramGb: 32 });
  const beforeCount = base.compatibleCount;
  const calls = [];
  const enriched = await enrichCompatibilityWithCanIRunSpeeds(base, {
    fetchImpl: async () => calls.push('unexpected fetch'),
  });
  const qwen = enriched.rows.find((row) => row.key === 'qwen3-8b');
  const gptOss = enriched.rows.find((row) => row.key === 'openai/gpt-oss-20b');
  assert.equal(enriched.compatibleCount, beforeCount);
  assert.equal(qwen.advisorySpeed.source, 'canirun');
  assert.equal(qwen.advisorySpeed.usedForAdmission, false);
  assert.equal(qwen.advisorySpeed.modelId, qwen.modelId);
  assert.equal(qwen.advisorySpeed.modelSha256, qwen.modelSha256);
  assert.match(qwen.speedLabel, /Estimated ~17 tok\/s · CanIRun/);
  assert.equal(gptOss.advisorySpeed.source, 'omlx');
  assert.deepEqual(calls, []);
});

test('checked-in CanIRun advisory schema cannot carry remote status or grades', async () => {
  const enriched = await enrichCompatibilityWithCanIRunSpeeds(evaluateHostCompatibility({ chip: 'Apple M5', ramGb: 32 }));
  const canirunRows = enriched.rows.filter((row) => row.advisorySpeed?.source === 'canirun');
  assert.equal(canirunRows.length > 0, true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.modelId === row.modelId), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.modelSha256 === row.modelSha256), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.modelName === row.name), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.quantization === 'Q4_K_M'), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.status === undefined), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.grade === undefined), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.tgTps > 0 && row.advisorySpeed.tgTps <= 1000), true);
  assert.equal(canirunRows.every((row) => row.advisorySpeed.usedForAdmission === false), true);
});

test('host preview does not expose internal tier or pseudo-speed targets', async () => {
  const html = await readFile(new URL('../host/index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('tok/s target'), false);
  assert.equal(html.includes('tok/s gate'), false);
  assert.equal(html.includes('fit-tier'), false);
  assert.equal(html.includes('fit-stats'), false);
  assert.equal(html.includes('minSustainedTps'), false);
  assert.equal(html.includes('Detected locally'), false);
  assert.equal(html.includes("fetch('/api/host-compatibility'"), false);
  assert.match(html, /Confirm values/);
});

test('host compatibility handler accepts byte JSON bodies', async () => {
  const handler = require('../api/host-compatibility.js');
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.88' },
    body: Buffer.from(JSON.stringify({ hardware: { chip: 'Apple M4', ramGb: 16 } })),
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
  await handler(req, res);
  const body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.hardware.chip, 'Apple M4');
  assert.equal(body.hardware.ramGb, 16);
});
