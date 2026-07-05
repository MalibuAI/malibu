export const title = 'Team';

export function mount(root, { navigate, esc, openAccount, toast }) {
  root.innerHTML = `
    <p class="sub">Shared workspace, pooled billing, and team API keys — coming when the gateway ships org APIs.</p>
    <div class="panel">
      <h2>Team workspace</h2>
      <p class="hint">Invite teammates, share quota, and rotate keys under one org. Today each browser uses a personal API key.</p>
      <span class="badge soon">Gateway API pending</span>
      <div class="row" style="margin-top:14px;">
        <button class="btn" type="button" disabled>Create team</button>
        <button class="btn ghost" type="button" data-action="account">Connect account</button>
      </div>
    </div>
    <div class="panel">
      <h2>Planned capabilities</h2>
      <ul class="ws-list">
        <li>Org switcher in the console header</li>
        <li>Shared daily quota and usage dashboard</li>
        <li>Role-based API keys (admin / member)</li>
        <li>Centralized billing and $MALIBU credits pool</li>
      </ul>
    </div>
    <div class="nav-links">
      <button type="button" class="linkish" data-workspace-link="dashboard">Usage dashboard</button>
      <button type="button" class="linkish" data-workspace-link="keys">API keys</button>
      <a href="/docs">API docs</a>
    </div>`;

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
  return () => root.removeEventListener('click', onClick);
}
