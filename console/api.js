const BASE = '/api/mp';
const KEY_STORAGE = 'malibu.mp.key';

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

function authHeaders() {
  const key = loadKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
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

/**
 * Stream a chat completion. Yields delta strings.
 * Throws on HTTP errors with .status set.
 */
export async function* chatStream({ model, messages, maxTokens = 1024, signal }) {
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(),
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`chat ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
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
          if (delta) yield delta;
        } catch {}
      }
    }
  }
}
