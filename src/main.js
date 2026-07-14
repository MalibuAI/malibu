const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches;

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

const STATS_URL = '/v1/stats/overview';
const STATUS_URL = '/api/mp/v1/status';
const AGENT_DEMO = 'Plan a coastal drive from Malibu to Hearst Castle — distance, time, and stops. Use tools if helpful.';

function fmtCompact(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (v >= 10_000) return Math.round(v / 1000) + 'K';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return v.toLocaleString();
}

function consoleUrl(prompt) {
  const params = new URLSearchParams({ mode: 'agent' });
  const text = (prompt || '').trim();
  if (text) params.set('q', text);
  else params.set('demo', 'agent');
  return '/console/?' + params.toString();
}

async function refreshLiveStats() {
  try {
    const [statsRes, statusRes] = await Promise.all([
      fetch(STATS_URL).catch(() => null),
      fetch(STATUS_URL).catch(() => null),
    ]);
    let nodes = null;
    let tps = null;
    let requestsTotal = null;
    let tokensTotal = null;

    if (statusRes?.ok) {
      const s = await statusRes.json();
      const ready = s?.pool?.ready;
      const total = s?.pool?.total_providers;
      if (ready > 0) nodes = ready;
      else if (total > 0) nodes = total;
    }
    let networkStats = null;
    if (statsRes?.ok) {
      const stats = await statsRes.json();
      const n = stats?.network || {};
      networkStats = n;
      if (nodes == null && n.nodes_online > 0) nodes = n.nodes_online;
      requestsTotal = n.requests_total;
      tokensTotal = n.tokens_served_total;
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
      document.querySelectorAll('[data-proof-nodes]').forEach((el) => {
        el.textContent = Number(nodes).toLocaleString();
      });
    }
    if (tps != null) {
      document.querySelectorAll('[data-live-tps]').forEach((el) => {
        const suffix = el.dataset.suffix === 'none';
        el.textContent = suffix ? tps : (el.tagName === 'SPAN' && el.closest('[data-live-pill], p, [data-hero-chat-meta]') ? tps + ' t/s' : tps);
      });
    }
    if (requestsTotal != null) {
      document.querySelectorAll('[data-proof-requests]').forEach((el) => {
        el.textContent = fmtCompact(requestsTotal);
      });
    }
    if (tokensTotal != null) {
      document.querySelectorAll('[data-proof-tokens]').forEach((el) => {
        el.textContent = fmtCompact(tokensTotal);
      });
    }

    if (networkStats) {
      const merged = { ...networkStats };
      if (nodes != null && merged.nodes_online == null) merged.nodes_online = nodes;
      const fmtMetric = (name, v) => {
        if (v == null || !Number.isFinite(Number(v))) return '—';
        const num = Number(v);
        if (name === 'network_power_kw') return num.toFixed(1);
        if (name === 'network_utilization_pct') return Math.round(num).toString();
        if (name === 'bandwidth_gb_per_s') return num < 10 ? num.toFixed(2).replace(/\.?0+$/, '') : fmtCompact(num);
        if (name === 'avg_tokens_per_request') return Math.round(num).toLocaleString();
        if (['tokens_served_total', 'requests_total'].includes(name)) return fmtCompact(num);
        return num.toLocaleString();
      };
      // A proof stat of zero (or one that rounds to zero, like a lone 0.035 kW
      // node) reads as broken, so hide the whole item until it has real signal.
      const isZeroish = (text) => {
        if (text === '—') return true;
        const num = parseFloat(text);
        return Number.isFinite(num) && num === 0;
      };
      document.querySelectorAll('[data-proof-metric]').forEach((el) => {
        const name = el.dataset.proofMetric;
        if (!(name in merged)) return;
        const text = fmtMetric(name, merged[name]);
        el.textContent = text;
        const item = el.closest('.home-proof-item');
        if (item) item.hidden = isZeroish(text);
      });
    }
  } catch {}
}

refreshLiveStats();
if (!reduced) setInterval(refreshLiveStats, 20000);

const chatForm = document.querySelector('[data-hero-chat]');
const chatInput = document.querySelector('[data-hero-chat-input]');
const chatSubmit = document.querySelector('[data-hero-chat-submit]');

function handleSubmit(e) {
  if (e) e.preventDefault();
  const v = (chatInput && chatInput.value) || '';
  window.location.href = consoleUrl(v || AGENT_DEMO);
}

chatForm && chatForm.addEventListener('submit', handleSubmit);
chatSubmit && chatSubmit.addEventListener('click', handleSubmit);
chatInput && chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
});
