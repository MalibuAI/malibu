const STATS_BASE = (import.meta.env.VITE_MACPROVIDER_STATS_BASE_URL || '').replace(/\/+$/, '');
const OVERVIEW_URL = STATS_BASE + '/v1/stats/overview';
const POLL_MS = 20000;
const MIN_MANUAL_MS = 3000;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  statusPill: document.querySelector('[data-net-status-pill]'),
  statusDot: document.querySelector('[data-net-status-dot]'),
  statusLabel: document.querySelector('[data-net-status-label]'),
  updated: document.querySelector('[data-net-updated]'),
  refresh: document.querySelector('[data-net-refresh]'),
  banner: document.querySelector('[data-net-banner]'),
  bannerText: document.querySelector('[data-net-banner-text]'),
};

let currentAbort = null;
let pollTimer = null;
let lastFetchAt = 0;
let latestData = null;
let latestFetchedAt = 0;
let staleTimer = null;

function nfmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (abs >= 1e9)  return (num / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (abs >= 1e6)  return (num / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1e4)  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtDecimal(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function relTime(fromMs) {
  const now = Date.now();
  const s = Math.max(0, Math.round((now - fromMs) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  return h + 'h ago';
}

function setStatus(kind, label) {
  const dot = els.statusDot;
  const map = {
    live:   { color: '#4FBFD4', pulse: true },
    stale:  { color: '#FFC629', pulse: true },
    error:  { color: '#FF6E5B', pulse: false },
    idle:   { color: 'rgba(255, 251, 242,0.35)', pulse: true },
  };
  const conf = map[kind] || map.idle;
  if (dot) {
    dot.style.background = conf.color;
    dot.style.animation = conf.pulse ? 'pillPulse 2.4s ease-in-out infinite' : 'none';
  }
  if (els.statusLabel) els.statusLabel.textContent = label;
  if (els.statusPill) els.statusPill.dataset.state = kind;
}

function showBanner(msg) {
  if (!els.banner || !els.bannerText) return;
  if (!msg) { els.banner.hidden = true; return; }
  els.bannerText.textContent = msg;
  els.banner.hidden = false;
}

function paintMetric(name, value) {
  document.querySelectorAll(`[data-metric="${name}"]`).forEach((el) => {
    el.textContent = value;
  });
}

// Hide the enclosing card for a metric when its value would read as broken or
// dishonest pre-beta (e.g. a "ready" percentage while no nodes are online).
function hideCardWhen(name, shouldHide) {
  document.querySelectorAll(`[data-metric="${name}"]`).forEach((el) => {
    const card = el.closest('.net-card, .net-counter');
    if (card) card.hidden = !!shouldHide;
  });
}

function paintOverview(data) {
  const n = data.network || {};

  paintMetric('tokens_served_total', nfmt(n.tokens_served_total));
  paintMetric('requests_total', nfmt(n.requests_total));
  paintMetric('nodes_online', nfmt(n.nodes_online));
  paintMetric('bandwidth_gb_per_s', nfmt(n.bandwidth_gb_per_s));

  paintMetric('gpu_cores_total', nfmt(n.gpu_cores_total));
  paintMetric('cpu_cores_total', nfmt(n.cpu_cores_total));
  paintMetric('unified_ram_gb_total', nfmt(n.unified_ram_gb_total));
  paintMetric('models_serving', nfmt(n.models_serving));

  paintMetric('tokens_in_total', nfmt(n.tokens_in_total));
  paintMetric('tokens_out_total', nfmt(n.tokens_out_total));

  const nodesOnline = Number(n.nodes_online);

  // Capacity headroom: the honest reframe of utilization is "how much of the
  // pool is ready right now" = 100 − utilization. But "100% ready" with zero
  // nodes online is a lie, so gate the card on a live pool (port of the
  // homepage zero-hiding discipline in src/main.js).
  // Guard explicitly: Number(null) and Number('') are 0, which would fake a
  // "100% ready" reading whenever the coordinator omits utilization.
  const rawUtil = n.network_utilization_pct;
  const util = rawUtil == null || rawUtil === '' ? NaN : Number(rawUtil);
  const capacityReady = Number.isFinite(util)
    ? Math.max(0, Math.min(100, 100 - util))
    : null;
  paintMetric('capacity_ready_pct', capacityReady == null ? '—' : nfmt(capacityReady));
  hideCardWhen('capacity_ready_pct', !(nodesOnline > 0) || capacityReady == null);
  const utilFill = document.querySelector('[data-util-fill]');
  if (utilFill) utilFill.style.width = (capacityReady == null ? 0 : capacityReady) + '%';

  // Token in/out ratio bar
  const tin = Number(n.tokens_in_total) || 0;
  const tout = Number(n.tokens_out_total) || 0;
  const total = tin + tout;
  const inPct = total > 0 ? (tin / total) * 100 : 0;
  const outPct = total > 0 ? (tout / total) * 100 : 0;
  const inBar = document.querySelector('[data-io-bar="in"]');
  const outBar = document.querySelector('[data-io-bar="out"]');
  if (inBar) inBar.style.width = inPct.toFixed(2) + '%';
  if (outBar) outBar.style.width = outPct.toFixed(2) + '%';
  const inPctEl = document.querySelector('[data-io-pct="in"]');
  const outPctEl = document.querySelector('[data-io-pct="out"]');
  if (inPctEl) inPctEl.textContent = total > 0 ? inPct.toFixed(1) + '% in' : '—';
  if (outPctEl) outPctEl.textContent = total > 0 ? outPct.toFixed(1) + '% out' : '—';

  // Charts
  paintRpm(data.timeseries && data.timeseries.rpm_30m);
  paintTpm(data.timeseries && data.timeseries.tpm_30m);

  // Per-request decode speed (the single-stream number, opposite of aggregate).
  paintDecodeSpeed(n.decode_tok_s);
}

// Minimum decode samples before an honest median + range can be shown. Below
// this the distribution is noise, so the whole card stays hidden — the same
// pre-beta "hide until real data" discipline used for the Throughput chart,
// and the reason we do NOT synthesize a per-request speed from aggregates
// (that fabrication was removed in #49/#53).
const MIN_DECODE_SAMPLES = 20;

function humanWindow(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  if (s % 86400 === 0) return (s / 86400) + 'd';
  if (s % 3600 === 0) return (s / 3600) + 'h';
  if (s % 60 === 0) return (s / 60) + 'm';
  return Math.round(s) + 's';
}

// Expects network.decode_tok_s = { median, p10, p90, sample_count, window_seconds }
// measured server-side over the decode window (first→last token), NOT total
// request latency. Absent today; the card reveals itself when the coordinator
// ships the field with enough samples.
function paintDecodeSpeed(decode) {
  const card = document.querySelector('[data-chart-card="decode"]');
  if (!card) return;
  const d = decode || {};
  // Treat null/'' as missing: Number(null) and Number('') are 0, which is
  // finite and would slip a fake "0–0 tok/s" range past the gate (same footgun
  // guarded for utilization above).
  const num = (v) => (v == null || v === '' ? NaN : Number(v));
  const median = num(d.median);
  const p10 = num(d.p10);
  const p90 = num(d.p90);
  const samples = num(d.sample_count);
  // Honest gate: a well-formed distribution (positive, ordered p10 ≤ median ≤
  // p90) with enough samples to mean it. Anything malformed hides the card.
  const ok =
    Number.isFinite(median) && median > 0 &&
    Number.isFinite(p10) && p10 > 0 &&
    Number.isFinite(p90) && p90 > 0 &&
    p10 <= median && median <= p90 &&
    Number.isFinite(samples) && samples >= MIN_DECODE_SAMPLES;
  card.hidden = !ok;
  if (!ok) return;

  const medEl = card.querySelector('[data-decode-median]');
  const rangeEl = card.querySelector('[data-decode-range]');
  const samplesEl = card.querySelector('[data-decode-samples]');
  if (medEl) medEl.textContent = nfmt(Math.round(median));
  if (rangeEl) rangeEl.textContent = nfmt(Math.round(p10)) + '–' + nfmt(Math.round(p90)) + ' tok/s';
  if (samplesEl) {
    const win = humanWindow(d.window_seconds);
    samplesEl.textContent =
      'median over ' + nfmt(samples) + ' requests' + (win ? ' · last ' + win : '');
  }
}

function pointsToSeries(series, keys) {
  const points = (series && Array.isArray(series.points)) ? series.points : [];
  return points.map((p) => {
    const out = { t: p.t };
    for (const k of keys) {
      const v = p[k];
      out[k] = (v === null || v === undefined) ? null : Number(v);
    }
    return out;
  });
}

function chartPath(values, w, h, pad) {
  const n = values.length;
  if (n === 0) return { line: '', area: '' };
  const max = Math.max(1, ...values.map((v) => (v == null ? 0 : v)));
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const step = n === 1 ? 0 : innerW / (n - 1);
  let line = '';
  let last = null;
  const seg = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = pad + step * i;
    const y = pad + innerH - (v / max) * innerH;
    seg.push({ x, y });
  });
  if (seg.length === 0) return { line: '', area: '' };
  seg.forEach((p, i) => {
    line += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ';
  });
  const first = seg[0];
  const lastP = seg[seg.length - 1];
  const area = line + 'L ' + lastP.x.toFixed(1) + ' ' + (pad + innerH) + ' L ' + first.x.toFixed(1) + ' ' + (pad + innerH) + ' Z';
  return { line: line.trim(), area };
}

function drawGrid(gridEl, w, h, pad, lines = 4) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for (let i = 0; i <= lines; i++) {
    const y = pad + ((h - pad * 2) / lines) * i;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(pad));
    el.setAttribute('x2', String(w - pad));
    el.setAttribute('y1', y.toFixed(1));
    el.setAttribute('y2', y.toFixed(1));
    el.setAttribute('stroke', 'rgba(255, 251, 242, 0.06)');
    el.setAttribute('stroke-width', '1');
    gridEl.appendChild(el);
  }
}

function paintRpm(series) {
  const svg = document.querySelector('[data-chart="rpm"]');
  const empty = document.querySelector('[data-chart-empty="rpm"]');
  if (!svg) return;
  const points = pointsToSeries(series, ['value']);
  const values = points.map((p) => p.value);
  const anyData = values.some((v) => v != null && v > 0);
  if (empty) empty.hidden = anyData;
  drawGrid(svg.querySelector('[data-chart-grid]'), 600, 220, 12);
  const { line, area } = chartPath(values, 600, 220, 12);
  const lineEl = svg.querySelector('[data-chart-line]');
  const areaEl = svg.querySelector('[data-chart-area]');
  if (lineEl) lineEl.setAttribute('d', line);
  if (areaEl) areaEl.setAttribute('d', area);
  const peak = anyData ? Math.max(...values.filter((v) => v != null)) : 0;
  const now = anyData ? [...values].reverse().find((v) => v != null) ?? 0 : 0;
  const peakEl = document.querySelector('[data-chart-peak="rpm"]');
  const nowEl = document.querySelector('[data-chart-now="rpm"]');
  if (peakEl) peakEl.textContent = anyData ? nfmt(peak) + ' /min' : '—';
  if (nowEl) nowEl.textContent = anyData ? nfmt(now) + ' /min' : '—';
}

function paintTpm(series) {
  const svg = document.querySelector('[data-chart="tpm"]');
  const empty = document.querySelector('[data-chart-empty="tpm"]');
  if (!svg) return;
  const points = pointsToSeries(series, ['input_tokens', 'output_tokens']);
  const inVals = points.map((p) => p.input_tokens);
  const outVals = points.map((p) => p.output_tokens);
  const allVals = inVals.concat(outVals);
  const anyData = allVals.some((v) => v != null && v > 0);
  if (empty) empty.hidden = anyData;
  // Pre-beta, an empty throughput chart alongside the empty traffic chart reads
  // as broken. Hide the whole card until there is real throughput to plot.
  const card = document.querySelector('[data-chart-card="tpm"]');
  if (card) card.hidden = !anyData;
  drawGrid(svg.querySelector('[data-chart-grid]'), 600, 220, 12);

  const max = Math.max(1, ...allVals.map((v) => (v == null ? 0 : v)));
  const w = 600, h = 220, pad = 12;
  const build = (values) => chartPath(values.map((v) => (v == null ? null : (v / max) * max)), w, h, pad);
  // Use a shared max so both lines share y-scale.
  const scale = (values) => {
    const step = values.length <= 1 ? 0 : (w - pad * 2) / (values.length - 1);
    const innerH = h - pad * 2;
    let line = '';
    const seg = [];
    values.forEach((v, i) => {
      if (v == null) return;
      const x = pad + step * i;
      const y = pad + innerH - (v / max) * innerH;
      seg.push({ x, y });
    });
    if (seg.length === 0) return { line: '', area: '' };
    seg.forEach((p, i) => {
      line += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ';
    });
    const first = seg[0];
    const lastP = seg[seg.length - 1];
    const area = line + 'L ' + lastP.x.toFixed(1) + ' ' + (pad + innerH) + ' L ' + first.x.toFixed(1) + ' ' + (pad + innerH) + ' Z';
    return { line: line.trim(), area };
  };

  const inPath = scale(inVals);
  const outPath = scale(outVals);
  svg.querySelector('[data-chart-line-in]').setAttribute('d', inPath.line);
  svg.querySelector('[data-chart-area-in]').setAttribute('d', inPath.area);
  svg.querySelector('[data-chart-line-out]').setAttribute('d', outPath.line);
  svg.querySelector('[data-chart-area-out]').setAttribute('d', outPath.area);

  const inPeak = anyData ? Math.max(0, ...inVals.filter((v) => v != null)) : 0;
  const outPeak = anyData ? Math.max(0, ...outVals.filter((v) => v != null)) : 0;
  const inPeakEl = document.querySelector('[data-chart-peak="tpm-in"]');
  const outPeakEl = document.querySelector('[data-chart-peak="tpm-out"]');
  if (inPeakEl) inPeakEl.textContent = anyData ? nfmt(inPeak) + ' /min' : '—';
  if (outPeakEl) outPeakEl.textContent = anyData ? nfmt(outPeak) + ' /min' : '—';
}

function scheduleStaleCheck(staleAtMs) {
  if (staleTimer) clearTimeout(staleTimer);
  if (!Number.isFinite(staleAtMs)) return;
  const delay = Math.max(1000, staleAtMs - Date.now());
  staleTimer = setTimeout(() => {
    if (!latestData) return;
    setStatus('stale', 'Stale');
    showBanner('Live snapshot is past its freshness window. Numbers may lag behind the coordinator.');
  }, delay);
}

function updateUpdatedLabel() {
  if (!els.updated) return;
  if (!latestFetchedAt) { els.updated.textContent = '—'; return; }
  els.updated.textContent = 'Updated ' + relTime(latestFetchedAt);
}

async function fetchOverview({ manual } = {}) {
  const now = Date.now();
  if (manual && now - lastFetchAt < MIN_MANUAL_MS) return;
  lastFetchAt = now;

  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  if (!latestData) setStatus('idle', 'Connecting…');

  try {
    const res = await fetch(OVERVIEW_URL, {
      signal: currentAbort.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit',
    });

    if (res.status === 503) {
      let body = null;
      try { body = await res.json(); } catch { /* ignore */ }
      if (latestData) {
        setStatus('stale', 'Stale');
        showBanner('Coordinator is serving stale rollups. Showing the last good snapshot.');
      } else {
        setStatus('error', 'Warming up');
        showBanner('Stats are warming up on the coordinator. Try again in a moment.');
      }
      return;
    }
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();
    latestData = data;
    latestFetchedAt = Date.now();
    paintOverview(data);
    setStatus('live', 'Live');
    showBanner('');
    updateUpdatedLabel();

    const staleAt = data.stale_after ? Date.parse(data.stale_after) : NaN;
    scheduleStaleCheck(staleAt);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.warn('[network stats] fetch failed', err);
    if (latestData) {
      setStatus('stale', 'Retrying');
      showBanner('Could not reach the stats service. Showing the last snapshot.');
    } else {
      setStatus('error', 'Offline');
      showBanner('Could not reach the stats service (' + (STATS_BASE || 'unknown') + '). We\'ll keep trying.');
    }
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') fetchOverview();
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchOverview();
    startPolling();
  } else {
    stopPolling();
    if (currentAbort) currentAbort.abort();
  }
});

if (els.refresh) {
  els.refresh.addEventListener('click', () => fetchOverview({ manual: true }));
}

setInterval(updateUpdatedLabel, 15000);

// ---- Verify-a-receipt demo -------------------------------------------------
// Runs a REAL Ed25519 sign + verify in the browser over a sample receipt tuple
// — the Ed25519 primitive behind every Malibu receipt. NOTE: production receipts
// canonicalize with RFC 8785 (JCS) and carry trust/hash checks, so this is a
// demonstration of the signature scheme, not a byte-for-byte `malibu-verify`
// run. The keypair is ephemeral and the tuple is a sample: not production
// traffic, and it attests provenance + integrity only (not that the answer is
// correct — that is TOPLOC, planned v1).
(function initVerifyDemo() {
  const btn = document.querySelector('[data-verify-run]');
  const panel = document.querySelector('[data-verify-demo]');
  const statusEl = document.querySelector('[data-verify-status]');
  const tupleEl = document.querySelector('[data-verify-tuple]');
  if (!btn || !panel || !tupleEl) return;

  const toHex = (buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function sha256Hex(str) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return toHex(digest);
  }

  function setStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.state = state || '';
  }

  async function run() {
    panel.hidden = false;
    btn.disabled = true;
    setStatus('running…', 'running');
    try {
      const [promptHash, outputHash, modelHash] = await Promise.all([
        sha256Hex('Summarize the Malibu litepaper in one line.'),
        sha256Hex('A verifiable inference network on idle Apple silicon.'),
        sha256Hex('mlx-community/Qwen3-8B-4bit'),
      ]);

      const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
      const providerPubkey = toHex(await crypto.subtle.exportKey('raw', keyPair.publicKey));

      // v0.3 tuple, canonicalized in fixed field order.
      const fields = [
        ['model_hash', 'sha256:' + modelHash],
        ['model_id', 'qwen3-8b'],
        ['prompt_hash', 'sha256:' + promptHash],
        ['output_hash', 'sha256:' + outputHash],
        ['provider_pubkey', providerPubkey],
        ['receipt_version', '0.3.3'],
        ['tokens_out', '12'],
        ['ttft_ms', '214'],
        ['unix_ts', String(Math.floor(Date.now() / 1000))],
      ];
      const msg = new TextEncoder().encode(fields.map(([k, v]) => k + '=' + v).join('\n'));
      const sig = await crypto.subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, msg);
      const ok = await crypto.subtle.verify({ name: 'Ed25519' }, keyPair.publicKey, sig, msg);

      const short = (v) => (v.length > 44 ? v.slice(0, 41) + '…' : v);
      tupleEl.textContent =
        fields.map(([k, v]) => k.padEnd(16) + short(v)).join('\n') +
        '\n' + 'signature'.padEnd(16) + short(toHex(sig));
      setStatus(ok ? 'signature valid ✓' : 'signature invalid ✕', ok ? 'ok' : 'bad');
    } catch {
      // Ed25519 in WebCrypto isn't available in every browser — the CLI still verifies.
      tupleEl.textContent =
        'Ed25519 verification is not available in this browser.\n' +
        'Run `malibu-verify` on any X-Malibu-Receipt header to check it offline.';
      setStatus('use malibu-verify', 'bad');
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', run);
})();

fetchOverview();
if (!reduced) startPolling();
