import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  modelDisplayName,
  modelRoutingMeaning,
  normalizeRoutabilityPayload,
  routabilityErrorView,
} from '../j/network-routability.mjs';

const NOW = Date.parse('2026-08-22T06:47:00Z');

test('normalizes a healthy redundant routability payload', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    summary: {
      state: 'redundant',
      models_total: 1,
      providers_total: 2,
      providers_routable: 2,
      providers_serving_capable: 2,
      models_redundant: 1,
    },
    models: [{
      model_id: 'mlx-community/Qwen3-8B-4bit',
      state: 'redundant',
      provider_count: 2,
      routable_provider_count: 2,
      serving_capable_provider_count: 2,
      recent_success_provider_count_1h: 2,
      slots_free: 2,
      slots_total: 2,
      max_context_tokens: 4000,
    }],
    providers: [{
      provider_ref: 'provider_000001',
      model_id: 'mlx-community/Qwen3-8B-4bit',
      state: 'online',
      routable: true,
      serving_capable: true,
      stale_data: false,
      slots_free: 1,
      slots_total: 1,
      receipt_validity: 'present',
      compute_integrity: 'hash_verified',
      attestation: 'hardware',
      routability_score: 100,
      last_heartbeat_age_seconds: 2,
    }],
    methodology: {
      version: 'SPEC-017-v0.2.0',
      state_basis: 'public pool snapshot',
      provider_identity: 'provider_ref is public',
      redaction: 'private fields omitted',
    },
  }, { nowMs: NOW });

  assert.equal(view.status, 'success');
  assert.equal(view.freshness, 'fresh');
  assert.equal(view.summary.routable, true);
  assert.equal(view.models[0].state, 'redundant');
  assert.equal(view.models[0].displayName, 'Qwen3 8B');
  assert.equal(view.models[0].routingMeaning, 'Available for buyer requests.');
  assert.equal(view.providers[0].providerRef, 'provider_000001');
  assert.equal(view.providers[0].computeIntegrity, 'hash_verified');
  assert.equal(view.methodology.version, 'SPEC-017-v0.2.0');
});

test('preserves degraded and offline model states with buyer-readable meanings', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    models: [
      { model_id: 'degraded-model', state: 'degraded', provider_count: 1, routable_provider_count: 0 },
      { model_id: 'offline-model', state: 'offline', provider_count: 0, routable_provider_count: 0 },
    ],
  }, { nowMs: NOW });

  assert.equal(view.models[0].state, 'degraded');
  assert.equal(view.models[0].routingMeaning, modelRoutingMeaning('degraded'));
  assert.equal(view.models[1].state, 'offline');
  assert.equal(view.models[1].routingMeaning, 'Temporarily unavailable.');
});

test('formats model ids as buyer-facing model names', () => {
  assert.equal(modelDisplayName('mlx-community/Llama-3.2-3B-Instruct-4bit'), 'Llama 3.2 3B Instruct');
  assert.equal(modelDisplayName('mlx-community/Qwen3-8B-4bit'), 'Qwen3 8B');
  assert.equal(modelDisplayName('unknown model'), 'Unknown model');
});

test('marks payloads stale after stale_after', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:45:00Z',
    stale_after: '2026-08-22T06:45:30Z',
    models: [{ model_id: 'model', state: 'operational' }],
  }, { nowMs: NOW });

  assert.equal(view.freshness, 'stale');
});

test('handles an empty provider list without treating counters as failed', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    summary: { state: 'unknown', providers_total: 0, providers_routable: 0 },
    models: [],
    providers: [],
  }, { nowMs: NOW });

  assert.equal(view.status, 'success');
  assert.equal(view.isEmpty, true);
  assert.deepEqual(view.providers, []);
  assert.equal(view.summary.providersTotal, 0);
});

test('endpoint failures produce an error view or preserve the last snapshot', () => {
  const error = new Error('HTTP 503');
  const failed = routabilityErrorView(error);
  assert.equal(failed.status, 'error');
  assert.equal(failed.errorMessage, 'HTTP 503');
  assert.equal(failed.models.length, 0);

  const previous = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    models: [{ model_id: 'model', state: 'operational' }],
  }, { nowMs: NOW });
  const preserved = routabilityErrorView(error, previous);
  assert.equal(preserved.status, 'stale');
  assert.equal(preserved.models[0].modelId, 'model');

  const stillPreserved = routabilityErrorView(error, preserved);
  assert.equal(stillPreserved.status, 'stale');
  assert.equal(stillPreserved.models[0].modelId, 'model');
});

test('provider normalization allowlists public fields only', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    providers: [{
      provider_ref: 'provider_000001',
      model_id: 'mlx-community/Qwen3-8B-4bit',
      state: 'online',
      routable: true,
      provider_id: 'raw-provider-id',
      hostname: 'secret-host.local',
      endpoint: 'https://10.0.0.2:9999',
      buyer_id: 'buyer-secret',
      prompt: 'private prompt',
      api_key: 'mp_secret',
      receipt_public_key: 'receipt-key',
      model_hash: 'sha256:secret',
      hardware_identity: 'serial-number',
      session_id: 'private-session',
      id: 'internal-model-id',
      name: 'internal-model-name',
      model: 'internal-model-shortcut',
      provider_alias: 'private-provider-alias',
      alias: 'private-host-alias',
    }],
  }, { nowMs: NOW });

  const rendered = JSON.stringify(view);
  assert.equal(rendered.includes('provider_000001'), true);
  assert.equal(rendered.includes('raw-provider-id'), false);
  assert.equal(rendered.includes('secret-host.local'), false);
  assert.equal(rendered.includes('https://10.0.0.2:9999'), false);
  assert.equal(rendered.includes('buyer-secret'), false);
  assert.equal(rendered.includes('private prompt'), false);
  assert.equal(rendered.includes('mp_secret'), false);
  assert.equal(rendered.includes('receipt-key'), false);
  assert.equal(rendered.includes('sha256:secret'), false);
  assert.equal(rendered.includes('serial-number'), false);
  assert.equal(rendered.includes('private-session'), false);
  assert.equal(rendered.includes('internal-model-id'), false);
  assert.equal(rendered.includes('internal-model-name'), false);
  assert.equal(rendered.includes('internal-model-shortcut'), false);
  assert.equal(rendered.includes('private-provider-alias'), false);
  assert.equal(rendered.includes('private-host-alias'), false);
});

test('model and provider identities do not fall back to generic fields', () => {
  const view = normalizeRoutabilityPayload({
    generated_at: '2026-08-22T06:46:56Z',
    stale_after: '2026-08-22T06:47:26Z',
    models: [{
      id: 'internal-model-id',
      name: 'internal-model-name',
      model: 'internal-model-shortcut',
      state: 'operational',
    }],
    providers: [{
      provider_alias: 'private-provider-alias',
      alias: 'private-host-alias',
      model: 'internal-provider-model',
      state: 'online',
    }],
  }, { nowMs: NOW });

  assert.equal(view.models[0].modelId, 'unknown model');
  assert.equal(view.providers[0].providerRef, 'redacted provider #1');
  assert.equal(view.providers[0].modelId, 'unknown model');
  const rendered = JSON.stringify(view);
  assert.equal(rendered.includes('internal-model-id'), false);
  assert.equal(rendered.includes('internal-model-name'), false);
  assert.equal(rendered.includes('internal-model-shortcut'), false);
  assert.equal(rendered.includes('private-provider-alias'), false);
  assert.equal(rendered.includes('private-host-alias'), false);
  assert.equal(rendered.includes('internal-provider-model'), false);
});

test('same-origin stats rewrites target the API host that serves routability', async () => {
  const [vercel, vite] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
  ]);

  assert.equal(vercel.includes('https://api.malibu.tech/v1/stats/:path*'), true);
  assert.equal(vercel.includes('https://stats.streamvc.live/v1/stats/:path*'), false);
  assert.equal(vite.includes("target: 'https://api.malibu.tech'"), true);
  assert.equal(vite.includes("target: 'https://stats.streamvc.live'"), false);
});
