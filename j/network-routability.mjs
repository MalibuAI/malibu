const MODEL_STATES = new Set(['redundant', 'operational', 'degraded', 'unknown', 'offline']);
const PROVIDER_STATES = new Set(['online', 'degraded', 'unknown', 'offline']);

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function stateValue(value, allowed, fallback = 'unknown') {
  const state = cleanString(value)?.toLowerCase();
  return state && allowed.has(state) ? state : fallback;
}

function parseTimeMs(value) {
  const raw = cleanString(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function freshness(generatedAtMs, staleAfterMs, nowMs) {
  if (!generatedAtMs && !staleAfterMs) return 'unavailable';
  if (staleAfterMs && staleAfterMs <= nowMs) return 'stale';
  return 'fresh';
}

function pickString(source, keys) {
  for (const key of keys) {
    const value = cleanString(source?.[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = finiteNumber(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickBoolean(source, keys) {
  for (const key of keys) {
    const value = cleanBoolean(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

export function modelRoutingMeaning(state) {
  switch (state) {
    case 'redundant':
    case 'operational':
      return 'Available for buyer requests.';
    case 'degraded':
      return 'Available, but capacity is tight.';
    case 'offline':
      return 'Temporarily unavailable.';
    default:
      return 'Status is updating.';
  }
}

export function modelDisplayName(modelId) {
  const raw = cleanString(modelId);
  if (!raw || raw === 'unknown model') return 'Unknown model';

  const slug = raw.split('/').pop() || raw;
  const withoutQuantization = slug
    .replace(/-(?:[234568]|[0-9]{2})bit$/i, '')
    .replace(/-mlx$/i, '');

  return withoutQuantization
    .replace(/-/g, ' ')
    .replace(/\bqwen(\d)/gi, 'Qwen$1')
    .replace(/\bllama\b/gi, 'Llama')
    .replace(/\binstruct\b/gi, 'Instruct')
    .replace(/\b(\d+(?:\.\d+)?)\s*b\b/gi, '$1B')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModel(model) {
  const state = stateValue(model?.state, MODEL_STATES);
  return {
    modelId: pickString(model, ['model_id']) || 'unknown model',
    displayName: modelDisplayName(pickString(model, ['model_id']) || 'unknown model'),
    state,
    providerCount: pickNumber(model, ['provider_count', 'providers_total']),
    routableProviderCount: pickNumber(model, ['routable_provider_count', 'providers_routable']),
    servingCapableProviderCount: pickNumber(model, ['serving_capable_provider_count', 'providers_serving_capable']),
    recentSuccessProviderCount1h: pickNumber(model, ['recent_success_provider_count_1h', 'recent_success_1h_provider_count']),
    slotsFree: pickNumber(model, ['slots_free', 'free_slots']),
    slotsTotal: pickNumber(model, ['slots_total', 'total_slots']),
    maxContextTokens: pickNumber(model, ['max_context_tokens', 'context_window_tokens']),
    routingMeaning: modelRoutingMeaning(state),
  };
}

function normalizeProvider(provider, index) {
  const alias = pickString(provider, ['provider_ref', 'public_alias']);
  return {
    providerRef: alias || 'redacted provider #' + (index + 1),
    ordinal: index + 1,
    state: stateValue(provider?.state, PROVIDER_STATES),
    modelId: pickString(provider, ['model_id']) || 'unknown model',
    routable: pickBoolean(provider, ['routable']),
    servingCapable: pickBoolean(provider, ['serving_capable']),
    staleData: pickBoolean(provider, ['stale_data']),
    slotsFree: pickNumber(provider, ['slots_free', 'free_slots']),
    slotsTotal: pickNumber(provider, ['slots_total', 'total_slots']),
    uptimeBucket: pickString(provider, ['uptime_bucket']),
    receiptValidity: pickString(provider, ['receipt_validity']),
    computeIntegrity: pickString(provider, ['compute_integrity']),
    attestation: pickString(provider, ['attestation']),
    recentSuccess1h: pickBoolean(provider, ['recent_success_1h']),
    routabilityScore: pickNumber(provider, ['routability_score']),
    lastHeartbeatAgeSeconds: pickNumber(provider, ['last_heartbeat_age_seconds']),
  };
}

function normalizeSummary(summary, models, providers) {
  const state = stateValue(summary?.state, MODEL_STATES, models.length ? 'unknown' : 'offline');
  const routableProviders = pickNumber(summary, ['providers_routable']);
  const providersTotal = pickNumber(summary, ['providers_total']);
  return {
    state,
    routable: state === 'redundant' || state === 'operational' || (routableProviders !== null && routableProviders > 0),
    modelsTotal: pickNumber(summary, ['models_total']) ?? models.length,
    providersTotal: providersTotal ?? providers.length,
    providersRoutable: routableProviders ?? providers.filter((provider) => provider.routable === true).length,
    providersServingCapable: pickNumber(summary, ['providers_serving_capable']) ?? providers.filter((provider) => provider.servingCapable === true).length,
    modelsRedundant: pickNumber(summary, ['models_redundant']) ?? models.filter((model) => model.state === 'redundant').length,
    modelsOperational: pickNumber(summary, ['models_operational']) ?? models.filter((model) => model.state === 'operational').length,
    modelsDegraded: pickNumber(summary, ['models_degraded']) ?? models.filter((model) => model.state === 'degraded').length,
    modelsUnknown: pickNumber(summary, ['models_unknown']) ?? models.filter((model) => model.state === 'unknown').length,
    modelsOffline: pickNumber(summary, ['models_offline']) ?? models.filter((model) => model.state === 'offline').length,
  };
}

function normalizeMethodology(methodology) {
  if (!methodology || typeof methodology !== 'object' || Array.isArray(methodology)) {
    return {
      version: null,
      stateBasis: null,
      providerIdentity: null,
      redaction: null,
    };
  }
  return {
    version: cleanString(methodology.version),
    stateBasis: cleanString(methodology.state_basis),
    providerIdentity: cleanString(methodology.provider_identity),
    redaction: cleanString(methodology.redaction),
  };
}

export function normalizeRoutabilityPayload(payload, { nowMs = Date.now() } = {}) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const models = Array.isArray(body.models) ? body.models.map(normalizeModel) : [];
  const providers = Array.isArray(body.providers) ? body.providers.map(normalizeProvider) : [];
  const generatedAtMs = parseTimeMs(body.generated_at);
  const staleAfterMs = parseTimeMs(body.stale_after);
  const summary = normalizeSummary(body.summary, models, providers);

  return {
    status: 'success',
    generatedAt: cleanString(body.generated_at),
    staleAfter: cleanString(body.stale_after),
    generatedAtMs,
    staleAfterMs,
    freshness: freshness(generatedAtMs, staleAfterMs, nowMs),
    summary,
    models,
    providers,
    methodology: normalizeMethodology(body.methodology),
    isEmpty: models.length === 0 && providers.length === 0,
  };
}

export function routabilityErrorView(error, previous = null) {
  const message = error && error.message ? error.message : 'Health feed unavailable.';
  const hasPreviousSnapshot =
    previous &&
    (previous.generatedAtMs || previous.staleAfterMs || previous.models?.length || previous.providers?.length);
  if (hasPreviousSnapshot) {
    return {
      ...previous,
      status: 'stale',
      freshness: 'unavailable',
      errorMessage: message,
    };
  }
  return {
    status: 'error',
    freshness: 'unavailable',
    generatedAt: null,
    staleAfter: null,
    generatedAtMs: null,
    staleAfterMs: null,
    errorMessage: message,
    summary: normalizeSummary({}, [], []),
    models: [],
    providers: [],
    methodology: normalizeMethodology(null),
    isEmpty: true,
  };
}
