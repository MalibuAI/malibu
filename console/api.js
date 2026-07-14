const BASE = '/api/mp';
const RATE_CARD_URL = '/v1/rate-card';
const KEY_STORAGE = 'malibu.mp.key';
const DEMO_STORAGE = 'malibu.demo.token';
const THREADS_STORAGE = 'malibu.threads';
const SETTINGS_STORAGE = 'malibu.settings';
const MAX_THREADS = 40;

const DEFAULT_SETTINGS = {
  defaultModel: '',
  maxTokens: 1024,
  alertThresholds: [50, 80, 100],
  softSpendLimitUsd: null,
  lastAlertPct: 0,
  chatMode: 'chat',
  agentAutoApprove: false,
  mcpServerUrl: '',
  modelPolicy: 'all',
  allowedModels: [],
  blockedModels: [],
  threadSyncEnabled: false,
};

export function loadKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function saveKey(key) {
  try {
    if (key) {
      localStorage.setItem(KEY_STORAGE, key);
      return localStorage.getItem(KEY_STORAGE) === key;
    }
    localStorage.removeItem(KEY_STORAGE);
    return !localStorage.getItem(KEY_STORAGE);
  } catch {
    return false;
  }
}

export function loadDemoToken() {
  try { return sessionStorage.getItem(DEMO_STORAGE) || ''; } catch { return ''; }
}

export function saveDemoToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(DEMO_STORAGE, token);
      return sessionStorage.getItem(DEMO_STORAGE) === token;
    }
    sessionStorage.removeItem(DEMO_STORAGE);
    return !sessionStorage.getItem(DEMO_STORAGE);
  } catch {
    return false;
  }
}

export function authMode() {
  if (loadKey()) return 'key';
  if (loadDemoToken()) return 'demo';
  return 'anonymous';
}

function authHeaders() {
  const key = loadKey();
  if (key) return { Authorization: `Bearer ${key}` };
  const demo = loadDemoToken();
  if (demo) return { 'X-Demo-Token': demo };
  return {};
}

let demoMintPromise = null;

export async function ensureDemoToken() {
  if (loadKey()) return null;
  const existing = loadDemoToken();
  if (existing) return existing;
  if (!demoMintPromise) {
    demoMintPromise = fetch(`${BASE}/auth/demo-session`, { method: 'POST' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message || `demo ${r.status}`);
        const token = j.demo_token;
        if (!token) throw new Error('demo token missing');
        saveDemoToken(token);
        return token;
      })
      .catch((e) => {
        demoMintPromise = null;
        throw e;
      });
  }
  return demoMintPromise;
}

export async function getStatus() {
  const r = await fetch(`${BASE}/v1/status`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

export async function listModels() {
  const r = await fetch(`${BASE}/v1/models`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!r.ok) throw new Error(`models ${r.status}`);
  return r.json();
}

export async function getUsage() {
  const r = await fetch(`${BASE}/v1/usage`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!r.ok) throw new Error(`usage ${r.status}`);
  return r.json();
}

export async function getRateCard() {
  const r = await fetch(RATE_CARD_URL, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`rate-card ${r.status}`);
  return r.json();
}

export async function exchangeHandoff(handoff) {
  const r = await fetch(`${BASE}/auth/handoff/exchange`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ handoff }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `handoff ${r.status}`);
  return j;
}

export async function createApiKey() {
  const r = await fetch(`${BASE}/auth/api-keys`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `create key ${r.status}`);
  return j;
}

export async function revokeApiKey(keyId) {
  const r = await fetch(`${BASE}/auth/api-keys/${encodeURIComponent(keyId)}/revoke`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `revoke ${r.status}`);
  return j;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    if (settings.chatMode === 'json') settings.chatMode = 'chat';
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(next));
    return next;
  } catch {
    return loadSettings();
  }
}

export function normalizeModelKey(model) {
  let key = String(model || '').toLowerCase().trim();
  let namespace = '';
  const slash = key.indexOf('/');
  if (slash >= 0) {
    namespace = key.slice(0, slash);
    const known = ['mlx-community', 'openai', 'google', 'meta-llama', 'nvidia', 'qwen'].includes(namespace);
    if (known) key = key.slice(slash + 1);
  }
  for (const suffix of ['-mxfp4-q8', '-4bit', '-8bit']) {
    if (key.endsWith(suffix)) key = key.slice(0, -suffix.length);
  }
  if (namespace === 'meta-llama' && key.startsWith('llama-')) return `meta-llama/${key}`;
  if (key.startsWith('meta-llama-')) return `meta-llama/${key.slice('meta-'.length)}`;
  if (key.startsWith('gpt-oss-')) return `openai/${key}`;
  return key;
}

export function lookupModelRate(modelId, rateCard) {
  const rows = rateCard?.rows || {};
  const key = normalizeModelKey(modelId);
  return rows[key] || rows.default || null;
}

export function creditsToUsd(credits, usdPerMillion = 1) {
  const n = Number(credits);
  if (!Number.isFinite(n)) return null;
  return (n / 1e6) * Number(usdPerMillion || 1);
}

export function formatUsd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(3);
  return '$' + v.toFixed(4);
}

export function formatModelPrice(modelId, rateCard) {
  const row = lookupModelRate(modelId, rateCard);
  if (!row) return '';
  const usd = rateCard?.usd_per_million_credits ?? 1;
  const out = creditsToUsd(row.completion_rate_per_mtok, usd);
  const inp = creditsToUsd(row.prompt_rate_per_mtok, usd);
  if (!out && !inp) return '';
  return `${formatUsd(inp)}/${formatUsd(out)} per M`;
}

export function isModelAllowed(modelId, settings = loadSettings()) {
  const id = String(modelId || '');
  if (!id) return false;
  const policy = settings.modelPolicy || 'all';
  const allowed = settings.allowedModels || [];
  const blocked = settings.blockedModels || [];
  if (policy === 'allowlist') return allowed.length ? allowed.includes(id) : true;
  if (policy === 'blocklist') return !blocked.includes(id);
  return true;
}

export function filterPoolModels(models, settings = loadSettings()) {
  const list = Array.isArray(models) ? models : [];
  return list.filter((m) => isModelAllowed(m.id, settings));
}

export function exportThreadsBundle() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    threads: loadThreads(),
    settings: loadSettings(),
  };
}

export function importThreadsBundle(raw, { merge = true } = {}) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || !Array.isArray(data.threads)) throw new Error('Invalid thread export');
  const incoming = data.threads.slice(0, MAX_THREADS);
  if (!merge) saveThreads(incoming);
  else {
    const byId = new Map(loadThreads().map((t) => [t.id, t]));
    for (const t of incoming) byId.set(t.id, t);
    saveThreads([...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  }
  return loadThreads().length;
}

export function inferMessageSurface(msg, thread = {}) {
  if (msg?.surface) return msg.surface;
  if (msg?.role === 'tool' || msg?.tool_calls?.length) return 'agent';
  return thread.lastSurface || 'chat';
}

export function malibuCreditsFromUsage(usage) {
  const w = usage?.wallet || usage?.malibu || {};
  const bal = w.malibu_balance ?? w.balance ?? usage?.malibu_credits ?? usage?.malibu_balance;
  return bal == null ? null : Number(bal);
}

export async function fetchNetworkOverview() {
  try {
    const r = await fetch('/v1/stats/overview', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export function inferPlan(usage) {
  const limit = Number(usage?.quota?.daily_tokens_limit) || 100000;
  const tier = Number(usage?.capacity?.tier) || 0;
  if (tier >= 1) return { id: 'capacity', label: 'Capacity tier', hint: 'Signup paused on network' };
  if (limit >= 500000) return { id: 'pro', label: 'Pro', hint: `${formatTokenCount(limit)} tokens/day` };
  return { id: 'free', label: 'Free', hint: `${formatTokenCount(limit)} tokens/day` };
}

export function aggregateLocalUsage(days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const totals = {
    requests: 0,
    tokens: 0,
    cached: 0,
    prompt: 0,
    completion: 0,
    byModel: {},
    byDay: {},
    bySurface: { chat: { requests: 0, tokens: 0 }, agent: { requests: 0, tokens: 0 }, api: { requests: 0, tokens: 0 } },
    byProvider: {},
  };
  for (const thread of loadThreads()) {
    const ts = thread.updatedAt || 0;
    if (ts < cutoff) continue;
    const day = new Date(ts).toISOString().slice(0, 10);
    for (const msg of thread.messages || []) {
      if (msg.role !== 'assistant' || !msg.usage) continue;
      totals.requests += 1;
      const u = msg.usage;
      const total = Number(u.total_tokens) || 0;
      const cached = Number(u.cached_prompt_tokens) || 0;
      const prompt = Number(u.prompt_tokens) || 0;
      const completion = Number(u.completion_tokens) || 0;
      totals.tokens += total;
      totals.cached += cached;
      totals.prompt += prompt;
      totals.completion += completion;
      const model = thread.model || msg.model || 'unknown';
      if (!totals.byModel[model]) totals.byModel[model] = { requests: 0, tokens: 0, cached: 0 };
      totals.byModel[model].requests += 1;
      totals.byModel[model].tokens += total;
      totals.byModel[model].cached += cached;
      const surface = inferMessageSurface(msg, thread);
      if (!totals.bySurface[surface]) totals.bySurface[surface] = { requests: 0, tokens: 0 };
      totals.bySurface[surface].requests += 1;
      totals.bySurface[surface].tokens += total;
      const provider = msg.meta?.provider || '';
      if (provider) {
        if (!totals.byProvider[provider]) totals.byProvider[provider] = { requests: 0, tokens: 0 };
        totals.byProvider[provider].requests += 1;
        totals.byProvider[provider].tokens += total;
      }
      if (!totals.byDay[day]) totals.byDay[day] = { requests: 0, tokens: 0 };
      totals.byDay[day].requests += 1;
      totals.byDay[day].tokens += total;
    }
  }
  return totals;
}

export function estimateMessageUsd({ usage, model }, rateCard) {
  if (!usage || !rateCard) return 0;
  const row = lookupModelRate(model, rateCard);
  if (!row) return 0;
  const usdPerM = rateCard.usd_per_million_credits ?? 1;
  const prompt = Number(usage.prompt_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  const cached = Number(usage.cached_prompt_tokens) || 0;
  const promptBillable = Math.max(0, prompt - cached);
  const promptCredits = (promptBillable * row.prompt_rate_per_mtok + cached * row.prompt_cache_hit_rate_per_mtok) / 1e6;
  const completionCredits = (completion * row.completion_rate_per_mtok) / 1e6;
  return creditsToUsd(promptCredits + completionCredits, usdPerM) || 0;
}

export function estimateLocalSpendUsd(days, rateCard) {
  const cutoff = Date.now() - days * 86400000;
  let usd = 0;
  for (const thread of loadThreads()) {
    if ((thread.updatedAt || 0) < cutoff) continue;
    const model = thread.model || 'unknown';
    for (const msg of thread.messages || []) {
      if (msg.role !== 'assistant' || !msg.usage) continue;
      usd += estimateMessageUsd({ usage: msg.usage, model: msg.model || model }, rateCard);
    }
  }
  return usd;
}

export function quotaPct(usage) {
  const q = usage?.quota || {};
  const used = Number(q.daily_tokens_used) || 0;
  const reserved = Number(q.daily_tokens_reserved) || 0;
  const limit = Number(q.daily_tokens_limit) || 100000;
  if (!limit) return 0;
  return Math.min(100, ((used + reserved) / limit) * 100);
}

export function checkQuotaAlert(usage, settings = loadSettings()) {
  const pct = quotaPct(usage);
  const thresholds = settings.alertThresholds || [50, 80, 100];
  const last = settings.lastAlertPct || 0;
  let hit = null;
  for (const t of thresholds) {
    if (pct >= t && last < t) hit = t;
  }
  if (hit != null) saveSettings({ lastAlertPct: hit });
  return hit;
}

export function resetQuotaAlert() {
  saveSettings({ lastAlertPct: 0 });
}

export function createThreadId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadThreads() {
  try {
    const raw = localStorage.getItem(THREADS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads) {
  try {
    localStorage.setItem(THREADS_STORAGE, JSON.stringify(threads.slice(0, MAX_THREADS)));
    return true;
  } catch {
    return false;
  }
}

export function upsertThread(thread) {
  const threads = loadThreads().filter((t) => t.id !== thread.id);
  threads.unshift(thread);
  saveThreads(threads);
  return threads;
}

export function getThread(id) {
  return loadThreads().find((t) => t.id === id) || null;
}

export function deleteThread(id) {
  const threads = loadThreads().filter((t) => t.id !== id);
  saveThreads(threads);
  return threads;
}

function readResponseMeta(headers) {
  return {
    provider: headers.get('X-MacProvider-Provider') || '',
    receipt: headers.get('X-MacProvider-Receipt') || '',
    settlement: headers.get('X-MacProvider-Settlement-Outcome') || headers.get('X-MacProvider-Settlement-Mode') || '',
    rateLimitRemaining: headers.get('X-RateLimit-Remaining-Requests') || '',
    requestId: headers.get('X-Request-ID') || '',
  };
}

function mergeToolDelta(acc, deltaToolCalls) {
  for (const tc of deltaToolCalls || []) {
    const i = tc.index ?? 0;
    if (!acc[i]) acc[i] = { index: i, id: '', type: 'function', function: { name: '', arguments: '' } };
    if (tc.id) acc[i].id = tc.id;
    if (tc.type) acc[i].type = tc.type;
    if (tc.function?.name) acc[i].function.name += tc.function.name;
    if (tc.function?.arguments != null) acc[i].function.arguments += tc.function.arguments;
  }
}

function toolList(acc) {
  return Object.keys(acc)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => {
      const { index, ...rest } = acc[k];
      return rest;
    });
}

/**
 * Stream a chat completion.
 * Yields { type: 'delta', text }, { type: 'tool_delta', toolCalls },
 * then { type: 'done', content, usage, meta, toolCalls, finishReason }.
 */
export async function* chatStream({
  model,
  messages,
  maxTokens = 1024,
  signal,
  conversationId,
  tools,
  toolChoice,
  responseFormat,
}) {
  await ensureDemoToken();

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...authHeaders(),
  };
  if (conversationId) headers['X-MacProvider-Conversation'] = conversationId;

  const body = { model, messages, stream: true, max_tokens: maxTokens };
  if (tools?.length) {
    body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
  }
  if (responseFormat) body.response_format = responseFormat;

  const requestStart = performance.now();
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  });

  const meta = readResponseMeta(r.headers);

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`chat ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let usage = null;
  let content = '';
  let finishReason = '';
  const toolAcc = {};
  // Decode-window timing so the console can show the honest per-request decode
  // speed the user actually felt: tokens ÷ (first token → last token), NOT
  // total latency. First-token time also gives TTFT (queue + prompt + relay).
  let firstTokenAt = null;
  let lastTokenAt = null;

  const parseSSEBuffer = function* parseSSEBuffer() {
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload);
          const choice = obj?.choices?.[0];
          const delta = choice?.delta;
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (delta?.content) {
            const now = performance.now();
            if (firstTokenAt == null) firstTokenAt = now;
            lastTokenAt = now;
            content += delta.content;
            yield { type: 'delta', text: delta.content };
          }
          if (delta?.tool_calls) {
            mergeToolDelta(toolAcc, delta.tool_calls);
            yield { type: 'tool_delta', toolCalls: toolList(toolAcc) };
          }
          if (choice?.message?.tool_calls) {
            mergeToolDelta(toolAcc, choice.message.tool_calls.map((tc, i) => ({ ...tc, index: i })));
          }
          if (obj?.usage) usage = obj.usage;
        } catch {}
      }
    }
  };

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      throw new DOMException('Aborted', 'AbortError');
    }
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: !done });
    yield* parseSSEBuffer();
    if (done) {
      buf += decoder.decode();
      if (buf.trim()) buf += '\n\n';
      yield* parseSSEBuffer();
      break;
    }
  }

  yield {
    type: 'done',
    content,
    usage,
    meta,
    finishReason,
    toolCalls: toolList(toolAcc),
    timing: {
      ttftMs: firstTokenAt != null ? firstTokenAt - requestStart : null,
      decodeMs: firstTokenAt != null && lastTokenAt != null ? lastTokenAt - firstTokenAt : null,
    },
  };
}

export function formatTokenCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e4) return Math.round(num).toLocaleString();
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(num));
}

function normalizedTotalTokens(usage) {
  if (!usage) return 0;
  const total = Number(usage.total_tokens);
  if (Number.isFinite(total) && total > 0) return total;
  const prompt = Number(usage.prompt_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  return prompt + completion > 0 ? prompt + completion : 0;
}

function formatLatency(latencyMs) {
  const ms = Number(latencyMs);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// Decode-only speed the user felt on this stream: completion tokens over the
// decode window (first token → last token), not total latency. Gated on a real
// window and enough tokens so a tiny reply can't show a wild rate; omitted
// otherwise rather than shown as a misleading number.
export function formatDecodeSpeed(usage, timing) {
  const completion = Number(usage?.completion_tokens) || 0;
  const decodeMs = Number(timing?.decodeMs);
  if (completion < 8 || !Number.isFinite(decodeMs) || decodeMs < 200) return '';
  // (completion − 1) inter-token gaps span the measured window.
  const toks = (completion - 1) / (decodeMs / 1000);
  if (!Number.isFinite(toks) || toks <= 0) return '';
  return `${Math.round(toks)} tok/s`;
}

export function formatBillMeta({ usage, meta, latencyMs, timing }) {
  const parts = [];
  const totalTokens = normalizedTotalTokens(usage);
  if (totalTokens > 0) parts.push(`${formatTokenCount(totalTokens)} tokens`);
  if (usage?.cached_prompt_tokens) parts.push(`${formatTokenCount(usage.cached_prompt_tokens)} cached`);
  const decode = formatDecodeSpeed(usage, timing);
  if (decode) parts.push(decode);
  const latency = formatLatency(latencyMs);
  if (latency) parts.push(latency);
  if (meta?.settlement) parts.push(meta.settlement);
  else if (meta?.receipt) parts.push('verified');
  if (meta?.provider) parts.push(meta.provider);
  return parts.length ? parts.join(' · ') : 'complete';
}
