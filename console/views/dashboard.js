import {
  getUsage, getStatus, getRateCard, authMode, formatTokenCount, formatUsd,
  aggregateLocalUsage, estimateLocalSpendUsd, inferPlan, quotaPct,
} from '../api.js';

export const title = 'Usage dashboard';

export function mount(root, { navigate, esc, openAccount }) {
  let period = 'today';
  let timer = null;

  root.innerHTML = `
    <p class="sub">Gateway quota for today plus local chat analytics from this browser.</p>
    <div data-content class="empty">Loading…</div>`;

  const el = root.querySelector('[data-content]');

  function modelRows(byModel) {
    const entries = Object.entries(byModel || {}).sort((a, b) => b[1].tokens - a[1].tokens);
    if (!entries.length) return '<p class="hint">No local chat usage in this period.</p>';
    return `<table class="table"><thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cached</th></tr></thead><tbody>${
      entries.map(([m, s]) => `<tr><td>${esc(m.split('/').pop() || m)}</td><td>${s.requests}</td><td>${formatTokenCount(s.tokens)}</td><td>${formatTokenCount(s.cached)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  async function render() {
    if (authMode() !== 'key') {
      el.className = 'empty';
      el.innerHTML = `
        <p>Connect an API key to see account usage.</p>
        <p><button type="button" class="linkish" data-action="account">Connect account</button> or <button type="button" class="linkish" data-workspace-link="keys">API keys</button>.</p>
        <p>Demo sessions (1k tokens/IP) are tracked separately.</p>`;
      return;
    }
    try {
      const [usage, status, rateCard] = await Promise.all([
        getUsage(),
        getStatus().catch(() => null),
        getRateCard().catch(() => null),
      ]);
      const plan = inferPlan(usage);
      const q = usage?.quota || {};
      const used = Number(q.daily_tokens_used) || 0;
      const reserved = Number(q.daily_tokens_reserved) || 0;
      const limit = Number(q.daily_tokens_limit) || 100000;
      const remaining = Math.max(0, limit - used - reserved);
      const pct = quotaPct(usage);
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
      const local = period === 'today' ? aggregateLocalUsage(1) : aggregateLocalUsage(days);
      const spend = rateCard ? estimateLocalSpendUsd(days, rateCard) : 0;
      const ready = status?.pool?.ready ?? '—';

      el.className = '';
      el.innerHTML = `
        <div class="row" style="margin-top:0;">
          <span class="badge ${plan.id === 'pro' ? 'pro' : ''}">${esc(plan.label)}</span>
          <span class="hint">${esc(plan.hint)}</span>
        </div>
        <div class="tabs" style="margin-top:18px;">
          <button class="tab ${period === 'today' ? 'active' : ''}" type="button" data-period="today">Today</button>
          <button class="tab ${period === '7d' ? 'active' : ''}" type="button" data-period="7d">7 days</button>
          <button class="tab ${period === '30d' ? 'active' : ''}" type="button" data-period="30d">30 days</button>
        </div>
        <div class="grid">
          <div class="card">
            <div class="lbl">${period === 'today' ? 'Tokens remaining' : 'Local requests'}</div>
            <div class="val">${period === 'today' ? formatTokenCount(remaining) : local.requests}</div>
            <div class="hint">${period === 'today' ? `of ${formatTokenCount(limit)} daily` : `${formatTokenCount(local.tokens)} tokens in chat`}</div>
          </div>
          <div class="card">
            <div class="lbl">${period === 'today' ? 'Used today' : 'Cached savings'}</div>
            <div class="val">${period === 'today' ? formatTokenCount(used) : formatTokenCount(local.cached)}</div>
            <div class="hint">${period === 'today' ? `${formatTokenCount(reserved)} reserved` : 'sticky KV cache tokens'}</div>
          </div>
          <div class="card">
            <div class="lbl">Est. spend</div>
            <div class="val" style="font-size:22px;">${formatUsd(spend)}</div>
            <div class="hint">from local chat · rate card</div>
          </div>
          <div class="card">
            <div class="lbl">Pool</div>
            <div class="val">${ready}</div>
            <div class="hint">nodes ready</div>
          </div>
        </div>
        ${period === 'today' ? `
        <div class="panel">
          <h2>Daily quota · ${esc(q.window_date || 'UTC')}</h2>
          <div class="bar-track"><div class="bar-fill ${pct >= 80 ? 'warn' : ''}" style="width:${pct.toFixed(1)}%"></div></div>
          <div class="hint">${formatTokenCount(used + reserved)} used · ${formatTokenCount(remaining)} left (${pct.toFixed(0)}%)</div>
        </div>` : `
        <div class="panel">
          <h2>By model (${period})</h2>
          ${modelRows(local.byModel)}
        </div>`}
        <div class="panel">
          <h2>Credits &amp; billing</h2>
          <p class="hint" style="margin:0 0 10px;">USDC top-up and prepaid credits are on the roadmap. Today you use the free daily quota (100k tokens) or your API key allocation.</p>
          <span class="badge soon">Top-up coming soon</span>
          <div class="nav-links">
            <button type="button" class="linkish" data-workspace-link="keys">API keys</button>
            <button type="button" class="linkish" data-workspace-link="settings">Settings &amp; alerts</button>
            <a href="/docs">API docs</a>
            <a href="/#token">$MALIBU</a>
          </div>
        </div>`;

      el.querySelectorAll('[data-period]').forEach((btn) => {
        btn.addEventListener('click', () => { period = btn.dataset.period; render(); });
      });
    } catch (e) {
      el.className = 'empty err';
      el.textContent = e?.message || 'Could not load dashboard.';
    }
  }

  const onClick = (e) => {
    if (e.target.closest('[data-action="account"]')) {
      e.preventDefault();
      openAccount?.();
      return;
    }
    const link = e.target.closest('[data-workspace-link]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.workspaceLink);
    }
  };
  root.addEventListener('click', onClick);

  render();
  timer = setInterval(render, 60_000);

  return () => {
    clearInterval(timer);
    root.removeEventListener('click', onClick);
  };
}
