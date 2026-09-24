// Design proposal only. The daily series is a fixed drawn shape.
// The public overview feed publishes all-time totals and the last 30 minutes,
// not day buckets. Live counters on this page come from that feed.

const SAMPLE_MILLION = Array.from({ length: 90 }, (_, i) => {
  const trend = 0.7 + (i / 89) * 1.5;
  const wave = Math.sin(i * 0.55) * 0.12;
  const dip = i >= 62 && i <= 68 ? (i - 65) * (i - 65) * -0.06 : 0;
  return Math.max(0.3, Math.round((trend + wave + dip) * 100) / 100);
});

const WINDOWS = { 7: 7, 30: 30, 90: 90 };

let windowDays = 30;

function sum(values) {
  return values.reduce((acc, n) => acc + n, 0);
}

function rolling7(values) {
  return values.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = values.slice(start, i + 1);
    return sum(slice) / slice.length;
  });
}

function fmtMillion(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 100) return Math.round(n).toLocaleString('en-US') + 'M';
  return n.toFixed(1).replace(/\.0$/, '') + 'M';
}

function paintSample() {
  const days = WINDOWS[windowDays] || 30;
  const current = SAMPLE_MILLION.slice(-days);
  const prior = SAMPLE_MILLION.slice(-(days * 2), -days);
  const currentSum = sum(current);
  const priorSum = sum(prior);
  const delta = currentSum - priorSum;
  const pct = priorSum > 0 ? (delta / priorSum) * 100 : null;

  const valueEl = document.querySelector('[data-sample-total]');
  const compareEl = document.querySelector('[data-sample-compare]');
  const titleEl = document.querySelector('[data-growth-title]');
  if (titleEl) titleEl.textContent = 'Last ' + days + ' days';
  if (valueEl) valueEl.textContent = fmtMillion(currentSum);
  if (compareEl) {
    if (prior.length < days) {
      compareEl.textContent = 'Sample is ' + SAMPLE_MILLION.length + ' days, so this window has no earlier one to compare.';
    } else {
      const sign = delta > 0 ? '+' : '';
      const pctText = pct == null ? '' : sign + pct.toFixed(0) + '% · ';
      compareEl.textContent =
        'vs prior ' + days + ' days: ' + pctText + sign + fmtMillion(Math.abs(delta)) + ' tokens · sample';
    }
  }

  drawBars(current, rolling7(current), days);
}

function drawBars(values, average, days) {
  const svg = document.querySelector('[data-growth-chart]');
  if (!svg) return;
  const w = 720;
  const h = 280;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...values, ...average);
  const niceMax = Math.ceil(max);

  const bars = svg.querySelector('[data-growth-bars]');
  const line = svg.querySelector('[data-growth-avg]');
  const grid = svg.querySelector('[data-growth-grid]');
  const axis = svg.querySelector('[data-growth-axis]');
  if (!bars || !line || !grid || !axis) return;
  bars.replaceChildren();
  grid.replaceChildren();
  axis.replaceChildren();

  for (let i = 0; i <= 3; i++) {
    const y = padT + (innerH / 3) * i;
    const rule = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rule.setAttribute('x1', String(padL));
    rule.setAttribute('x2', String(w - padR));
    rule.setAttribute('y1', y.toFixed(1));
    rule.setAttribute('y2', y.toFixed(1));
    rule.setAttribute('stroke', 'rgba(250, 251, 255, 0.08)');
    grid.appendChild(rule);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(padL - 8));
    label.setAttribute('y', (y + 4).toFixed(1));
    label.setAttribute('text-anchor', 'end');
    label.textContent = String(Math.round(niceMax - (niceMax / 3) * i));
    axis.appendChild(label);
  }

  const gap = days > 40 ? 2 : 4;
  const slot = innerW / values.length;
  const barW = Math.max(2, slot - gap);
  values.forEach((v, i) => {
    const bh = (v / niceMax) * innerH;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (padL + i * slot + (slot - barW) / 2).toFixed(1));
    rect.setAttribute('y', (padT + innerH - bh).toFixed(1));
    rect.setAttribute('width', barW.toFixed(1));
    rect.setAttribute('height', Math.max(1, bh).toFixed(1));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', '#4BB8D0');
    bars.appendChild(rect);
  });

  if (days >= 30) {
    let d = '';
    average.forEach((v, i) => {
      const x = padL + i * slot + slot / 2;
      const y = padT + innerH - (v / niceMax) * innerH;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    line.setAttribute('d', d.trim());
    line.setAttribute('visibility', 'visible');
  } else {
    line.setAttribute('d', '');
    line.setAttribute('visibility', 'hidden');
  }

  const ticks = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  const tickNames = ['Day 1', 'Day ' + Math.round(days / 2), 'Day ' + days];
  ticks.forEach((i, idx) => {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', (padL + i * slot + slot / 2).toFixed(1));
    label.setAttribute('y', String(h - 10));
    label.setAttribute('text-anchor', idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle');
    label.textContent = tickNames[idx];
    axis.appendChild(label);
  });

  svg.setAttribute(
    'aria-label',
    'Sample daily tokens, last ' + days + ' days. Not live Malibu history. Y axis is millions of tokens.',
  );
}

function bindWindows() {
  document.querySelectorAll('[data-growth-window]').forEach((btn) => {
    btn.addEventListener('click', () => {
      windowDays = Number(btn.getAttribute('data-growth-window')) || 30;
      document.querySelectorAll('[data-growth-window]').forEach((other) => {
        other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
      });
      paintSample();
    });
  });
}

function bindLive() {
  const btn = document.querySelector('[data-growth-live]');
  const panel = document.querySelector('[data-live-panel]');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Hide live' : 'Live · last 30 min';
  });
}

bindWindows();
bindLive();
paintSample();
