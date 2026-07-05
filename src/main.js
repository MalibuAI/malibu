const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches;

// Hero pointer-reactive parallax
const hero = document.querySelector('[data-hero-root]');
if (hero && !isTouch && !reduced) {
  window.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) return;
    hero.style.setProperty('--mx', ((x - 0.5) * 2).toFixed(3));
    hero.style.setProperty('--my', ((y - 0.5) * 2).toFixed(3));
  }, { passive: true });
}

// Live network stats from MacProvider stats API
const STATS_URL = 'https://stats.streamvc.live/v1/stats/overview';
const STATUS_URL = '/api/mp/v1/status';

async function refreshLiveStats() {
  try {
    const [statsRes, statusRes] = await Promise.all([
      fetch(STATS_URL).catch(() => null),
      fetch(STATUS_URL).catch(() => null),
    ]);
    let nodes = null;
    let tps = null;
    if (statusRes?.ok) {
      const s = await statusRes.json();
      const ready = s?.pool?.ready;
      const total = s?.pool?.total_providers;
      if (ready > 0) nodes = ready;
      else if (total > 0) nodes = total;
    }
    if (statsRes?.ok) {
      const stats = await statsRes.json();
      const n = stats?.network || {};
      if (nodes == null && n.nodes_online > 0) nodes = n.nodes_online;
      const rpm = stats?.timeseries?.rpm_30m?.points;
      if (Array.isArray(rpm)) {
        const recent = [...rpm].reverse().find((p) => p?.value != null && p.value > 0);
        if (recent?.value) tps = (recent.value / 60).toFixed(1);
      }
      if (!tps && n.avg_tokens_per_request && n.requests_total) {
        tps = (n.avg_tokens_per_request * 0.15).toFixed(1);
      }
    }
    if (nodes != null) {
      document.querySelectorAll('[data-live-nodes]').forEach((el) => {
        el.textContent = Number(nodes).toLocaleString() + ' nodes';
      });
      document.querySelectorAll('[data-live-nodes-count]').forEach((el) => {
        el.textContent = Number(nodes).toLocaleString();
      });
    }
    if (tps != null) {
      document.querySelectorAll('[data-live-tps]').forEach((el) => {
        const suffix = el.dataset.suffix === 'none';
        el.textContent = suffix ? tps : (el.tagName === 'SPAN' && el.closest('[data-live-pill], p, [data-hero-chat-meta]') ? tps + ' t/s' : tps);
      });
    }
  } catch {}
}

refreshLiveStats();
if (!reduced) setInterval(refreshLiveStats, 20000);


// Hero chatbox: stream a canned response inline; on Enter w/ shift -> /console/
const chatForm = document.querySelector('[data-hero-chat]');
const chatInput = document.querySelector('[data-hero-chat-input]');
const chatSubmit = document.querySelector('[data-hero-chat-submit]');

const samples = {
  default: [
    "Dear friend — the light here is on a timer. ",
    "The Pacific has flattened to a sheet of orange foil. ",
    "Your prompt routes through the Malibu pool on Apple Silicon. ",
    "Settled on-chain when enabled. ",
    "0.00033 $MALIBU burned. ",
    "From the coast, with warmth.",
  ],
  postcard: [
    "Pacific Coast Highway, mile 27. ",
    "Three pelicans, single file. ",
    "The Porsche at the overlook hasn't moved since Tuesday. ",
    "Somebody's Mac in a kitchen behind the cliff is doing your inference at 62.4 tokens per second. ",
    "Charged you $0.00184 USDC. Burned 0.00033 $MALIBU. ",
    "Wish you were here.",
  ],
};

function pickResponse(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('postcard') || p.includes('zuma') || p.includes('pch') || p.includes('beach')) return samples.postcard;
  return samples.default;
}

let streamingEl = null;
let streamingTimer = null;

function ensureStreamingArea() {
  if (streamingEl) return streamingEl;
  const wrap = document.createElement('div');
  wrap.setAttribute('data-hero-chat-stream', '');
  wrap.style.cssText = 'margin-top: 16px; padding: 18px 20px; background: rgba(12,22,32,0.62); border: 1px solid rgba(251,246,236,0.14); border-radius: 14px; font-family: \'Geist\', sans-serif; font-size: 14.5px; line-height: 1.55; color: rgba(251,246,236,0.92); backdrop-filter: blur(14px); max-width: 720px;';
  wrap.innerHTML = '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(217,164,65,0.78); margin-bottom: 10px;">M2 Ultra · Zuma Beach, CA · 184 ms</div><div data-hero-chat-text></div>';
  chatForm.parentNode.insertBefore(wrap, chatForm.nextSibling);
  streamingEl = wrap;
  return wrap;
}

function streamResponse(prompt) {
  if (streamingTimer) clearInterval(streamingTimer);
  const area = ensureStreamingArea();
  const target = area.querySelector('[data-hero-chat-text]');
  target.innerHTML = '<span style="opacity: 0.6;">▍</span>';
  const chunks = pickResponse(prompt);
  let i = 0, buf = '';
  streamingTimer = setInterval(() => {
    if (i >= chunks.length) {
      clearInterval(streamingTimer);
      target.innerHTML = buf + ' <a href="/console/" style="color: #D9A441; border-bottom: 1px solid rgba(217,164,65,0.5);">Open in console →</a>';
      return;
    }
    buf += chunks[i++];
    target.innerHTML = buf + '<span style="opacity: 0.6; animation: streamCursor 1.1s steps(1) infinite;">▍</span>';
  }, 380);
}

function handleSubmit(e) {
  if (e) e.preventDefault();
  const v = (chatInput && chatInput.value) || '';
  const trimmed = v.trim();
  if (!trimmed) {
    window.location.href = '/console/';
    return;
  }
  window.location.href = '/console/?q=' + encodeURIComponent(trimmed);
}

chatForm && chatForm.addEventListener('submit', handleSubmit);
chatSubmit && chatSubmit.addEventListener('click', handleSubmit);
chatInput && chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.shiftKey)) {
    e.preventDefault();
    window.location.href = '/console/?q=' + encodeURIComponent(chatInput.value || '');
  }
});
