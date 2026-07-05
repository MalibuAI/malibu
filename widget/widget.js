import { ensureDemoToken, getStatus, chatStream, formatBillMeta } from '../console/api.js';

const stream = document.querySelector('[data-stream]');
const form = document.querySelector('[data-form]');
const input = document.querySelector('[data-input]');
let model = '';
let busy = false;

function append(role, text, meta) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  if (meta) {
    const m = document.createElement('div');
    m.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:10px;color:rgba(255,198,41,0.7);margin-top:4px;';
    m.textContent = meta;
    el.appendChild(m);
  }
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
}

async function init() {
  try {
    await ensureDemoToken();
    const s = await getStatus();
    const models = (s?.models || []).filter((m) => m.available !== false);
    model = models[0]?.id || '';
  } catch {}
  append('ai', 'Malibu embed uses the demo session (1k tokens/IP/day). Sign in on malibu.tech for full quota.');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const val = (input.value || '').trim();
  if (!val || !model) return;
  busy = true;
  append('user', val);
  input.value = '';
  let buf = '';
  const started = performance.now();
  let usage = null;
  let meta = {};
  try {
    for await (const event of chatStream({ model, messages: [{ role: 'user', content: val }], maxTokens: 512 })) {
      if (event.type === 'delta') buf += event.text;
      else if (event.type === 'done') {
        usage = event.usage;
        meta = event.meta || {};
        if (event.content) buf = event.content;
      }
    }
    append('ai', buf, formatBillMeta({ usage, meta, latencyMs: performance.now() - started }));
  } catch (err) {
    append('ai', err?.message || 'Request failed.');
  } finally {
    busy = false;
  }
});

init();
