const BASE = '/api/mp';
const KEY_STORAGE = 'malibu.mp.key';
const DEMO_STORAGE = 'malibu.demo.token';
const THREADS_STORAGE = 'malibu.threads';
const MAX_THREADS = 40;

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

/**
 * Stream a chat completion. Yields { type: 'delta', text } then { type: 'done', usage, meta }.
 */
export async function* chatStream({ model, messages, maxTokens = 1024, signal, conversationId }) {
  await ensureDemoToken();

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...authHeaders(),
  };
  if (conversationId) headers['X-MacProvider-Conversation'] = conversationId;

  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens }),
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
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
          const delta = obj?.choices?.[0]?.delta?.content;
          if (delta) yield { type: 'delta', text: delta };
          if (obj?.usage) usage = obj.usage;
        } catch {}
      }
    }
  }

  yield { type: 'done', usage, meta };
}

export function formatTokenCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e4) return Math.round(num).toLocaleString();
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(num));
}

export function formatBillMeta({ usage, meta, latencyMs }) {
  const parts = [];
  if (usage?.total_tokens) parts.push(`${formatTokenCount(usage.total_tokens)} tokens`);
  if (usage?.cached_prompt_tokens) parts.push(`${formatTokenCount(usage.cached_prompt_tokens)} cached`);
  if (latencyMs) parts.push(`${Math.round(latencyMs)}ms`);
  if (meta?.settlement) parts.push(meta.settlement);
  else if (meta?.receipt) parts.push('verified');
  if (meta?.provider) {
    const short = meta.provider.length > 12 ? meta.provider.slice(0, 10) + '…' : meta.provider;
    parts.push(short);
  }
  return parts.length ? parts.join(' · ') : 'complete';
}
