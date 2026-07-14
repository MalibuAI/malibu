import {
  getUsage, getStatus, getRateCard, authMode, formatTokenCount, formatUsd,
  aggregateLocalUsage, estimateLocalSpendUsd, inferPlan, quotaPct,
  malibuCreditsFromUsage, fetchNetworkOverview,
} from '../api.js';

export const title = 'Usage dashboard';

export function mount(root, { navigate, esc, openAccount }) {
  let period = 'today';
  let timer = null;

  root.innerHTML = `
    <p class="sub">Gateway quota, local analytics by surface, and pool transparency.</p>
    <div data-content class="empty">Loading…</div>`;

  const el = root.querySelector('[data-content]');

  function modelRows(byModel) {
    const entries = Object.entries(byModel || {}).sort((a, b) => b[1].tokens - a[1].tokens);
    if (!entries.length) return '<p class="hint">No local chat usage in this period.</p>';
    return `<table class="table"><thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cached</th></tr></thead><tbody>${
      entries.map(([m, s]) => `<tr><td>${esc(m.split('/').pop() || m)}</td><td>${s.requests}</td><td>${formatTokenCount(s.tokens)}</td><td>${formatTokenCount(s.cached)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  function surfaceRows(bySurface) {
    const rows = [
      ['chat', 'Chat'],
      ['agent', 'Agent · tools & code'],
      ['api', 'API (external)'],
    ];
    return `<table class="table"><thead><tr><th>Surface</th><th>Requests</th><th>Tokens</th></tr></thead><tbody>${
      rows.map(([k, label]) => {
        const s = bySurface?.[k] || { requests: 0, tokens: 0 };
        const note = k === 'api' && !s.requests ? ' — use API keys outside console' : '';
        return `<tr><td>${esc(label)}${note ? `<span class="hint">${esc(note)}</span>` : ''}</td><td>${s.requests}</td><td>${formatTokenCount(s.tokens)}</td></tr>`;
      }).join('')
    }</tbody></table>`;
  }

  function providerRows(byProvider) {
    const entries = Object.entries(byProvider || {}).sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 8);
    if (!entries.length) return '<p class="hint">Provider IDs appear on replies after your first inference.</p>';
    return `<table class="table"><thead><tr><th>Provider ID</th><th>Requests</th><th>Tokens</th></tr></thead><tbody>${
      entries.map(([p, s]) => `<tr><td><code>${esc(p)}</code></td><td>${s.requests}</td><td>${formatTokenCount(s.tokens)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  async function render() {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const local = period === 'today' ? aggregateLocalUsage(1) : aggregateLocalUsage(days);
    const network = await fetchNetworkOverview().catch(() => null);
    const net = network?.network || {};

    if (authMode() !== 'key') {
      el.className = '';
      el.innerHTML = `
        <div class="tabs" style="margin-top:0;">
          <button class="tab ${period === 'today' ? 'active' : ''}" type="button" data-period="today">Today</button>
          <button class="tab ${period === '7d' ? 'active' : ''}" type="button" data-period="7d">7 days</button>
          <button class="tab ${period === '30d' ? 'active' : ''}" type="button" data-period="30d">30 days</button>
        </div>
        <div class="panel">
          <h2>Local usage (this browser)</h2>
          ${surfaceRows(local.bySurface)}
        </div>
        <div class="panel">
          <h2>Network transparency</h2>
          <p class="hint">Aggregate pool stats. Per-request provider IDs show on chat replies.</p>
          <div class="grid">
            <div class="card"><div class="lbl">Nodes online</div><div class="val" style="font-size:22px;">${net.nodes_online ?? '—'}</div></div>
          </div>
          <div class="nav-links"><a href="/network/">Full network dashboard</a></div>
        </div>
        <p class="hint">Connect an API key for account quota.</p>
        <p><button type="button" class="linkish" data-action="account">Connect account</button></p>`;
      bindPeriod();
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
      const spend = rateCard ? estimateLocalSpendUsd(days, rateCard) : 0;
      const ready = status?.pool?.ready ?? '—';
      const malibuBal = malibuCreditsFromUsage(usage);

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
            <div class="hint">local console · rate card</div>
          </div>
          <div class="card">
            <div class="lbl">Pool ready</div>
            <div class="val">${ready}</div>
            <div class="hint">live nodes</div>
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
          <h2>By surface (${period})</h2>
          <p class="hint" style="margin-top:0;">Chat vs Agent usage from this browser. API calls via raw keys are not tracked here yet.</p>
          ${surfaceRows(local.bySurface)}
        </div>
        <div class="panel">
          <h2>Providers (${period})</h2>
          <p class="hint" style="margin-top:0;">MacProvider node IDs from inference receipts. Hardware/region disclosure per node is on the roadmap.</p>
          ${providerRows(local.byProvider)}
          <div class="nav-links"><a href="/network/">Network stats</a></div>
        </div>
        <div class="panel">
          <h2>$MALIBU credits</h2>
          ${malibuBal != null && Number.isFinite(malibuBal)
            ? `<div class="val" style="font-size:24px;margin-bottom:8px;">${formatTokenCount(malibuBal)}</div><p class="hint">Wallet balance from gateway.</p>`
            : `<p class="hint" style="margin:0 0 10px;">Redeem $MALIBU for inference credits when the wallet API ships. Until then, use daily quota or USDC top-up.</p><span class="badge soon">Wallet API pending</span>`}
          <div class="nav-links">
            <a href="/#token">$MALIBU token</a>
            <button type="button" class="linkish" data-workspace-link="team">Team billing</button>
          </div>
        </div>
        <div class="panel">
          <h2>Billing</h2>
          <p class="hint" style="margin:0 0 10px;">USDC top-up and prepaid credits are on the roadmap.</p>
          <span class="badge soon">Top-up coming soon</span>
          <div class="nav-links">
            <button type="button" class="linkish" data-workspace-link="keys">API keys</button>
            <button type="button" class="linkish" data-workspace-link="settings">Settings</button>
            <a href="/docs">API docs</a>
          </div>
        </div>`;

      bindPeriod();
    } catch (e) {
      el.className = 'empty err';
      el.textContent = e?.message || 'Could not load dashboard.';
    }
  }

  function bindPeriod() {
    el.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => { period = btn.dataset.period; render(); });
    });
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
