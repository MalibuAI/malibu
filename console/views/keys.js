import {
  getUsage, loadKey, saveKey, authMode, createApiKey, revokeApiKey,
} from '../api.js';

export const title = 'API keys';

export function mount(root, { navigate, esc, toast }) {
  root.innerHTML = `
    <p class="sub">Create, rotate, and revoke keys via the MacProvider gateway. Keys are shown once — save immediately.</p>
    <div data-content class="empty">Loading…</div>`;

  const el = root.querySelector('[data-content]');

  function maskKey(key) {
    if (!key || key.length < 12) return key || '—';
    return key.slice(0, 7) + '…' + key.slice(-4);
  }

  function keyField(k) {
    const id = k.key_id || k.KeyID || k.id || '—';
    const prefix = k.key_prefix || k.KeyHashPrefix || k.key_hash_prefix || 'mp_…';
    const status = k.status || k.Status || (k.revoked_at || k.RevokedAt ? 'revoked' : 'active');
    const created = k.created_at || k.CreatedAt || '';
    const date = created ? new Date(created).toLocaleDateString() : '';
    const local = loadKey();
    const isLocal = prefix && local.startsWith('mp_') && maskKey(local).includes(prefix.slice(-4));
    return `
      <div class="key-box" data-key-id="${esc(id)}">
        <div class="lbl" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,251,242,0.45);margin-bottom:8px;">
          ${esc(prefix)} · ${esc(status)}${date ? ` · ${esc(date)}` : ''}${isLocal ? ' · this device' : ''}
        </div>
        <code>${esc(id)}</code>
        ${status === 'active' ? `<div class="row"><button class="btn danger" type="button" data-revoke="${esc(id)}">Revoke</button></div>` : ''}
      </div>`;
  }

  async function render() {
    if (authMode() !== 'key') {
      el.className = 'empty';
      el.innerHTML = `
        <p>No API key on this device.</p>
        <button class="btn" type="button" data-signin>Sign in with GitHub</button>
        <p style="margin-top:16px;"><button type="button" class="linkish" data-action="chat">Return to chat</button> and paste your key.</p>`;
      el.querySelector('[data-signin]')?.addEventListener('click', () => {
        window.open('https://api.streamvc.live/auth/github/start', '_blank', 'noopener');
      });
      el.querySelector('[data-action="chat"]')?.addEventListener('click', () => navigate('chat'));
      return;
    }
    try {
      const usage = await getUsage();
      const keys = Array.isArray(usage?.keys) ? usage.keys : [];
      let html = `
        <div class="key-box">
          <div class="lbl" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,251,242,0.45);margin-bottom:8px;">Active on this device</div>
          <code>${esc(maskKey(loadKey()))}</code>
        </div>
        <div class="row">
          <button class="btn" type="button" data-rotate>Rotate key</button>
          <button class="btn ghost" type="button" data-mint>Mint via GitHub</button>
        </div>
        <p class="hint" style="margin-top:8px;">Rotating issues a new key and revokes the one used for this request.</p>`;
      if (keys.length) {
        html += '<div class="panel" style="margin-top:20px;"><h2>Account keys</h2>';
        for (const k of keys) html += keyField(k);
        html += '</div>';
      }
      html += `<div class="nav-links">
        <button type="button" class="linkish" data-workspace-link="dashboard">Dashboard</button>
        <button type="button" class="linkish" data-workspace-link="settings">Settings</button>
        <a href="/docs">API docs</a>
      </div>`;
      el.className = '';
      el.innerHTML = html;

      el.querySelector('[data-mint]')?.addEventListener('click', () => {
        window.open('https://api.streamvc.live/auth/github/start?action=mint', '_blank', 'noopener');
      });
      el.querySelector('[data-rotate]')?.addEventListener('click', async () => {
        if (!confirm('Rotate your API key? The current key will stop working.')) return;
        try {
          const j = await createApiKey();
          const newKey = j.api_key;
          if (!newKey || !saveKey(newKey)) throw new Error('Could not save new key');
          toast('New key saved to this device.');
          render();
        } catch (e) {
          toast(e?.message || 'Rotate failed', 'error');
        }
      });
      el.querySelectorAll('[data-revoke]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.revoke;
          if (!confirm(`Revoke key ${id}?`)) return;
          try {
            await revokeApiKey(id);
            toast('Key revoked.');
            render();
          } catch (e) {
            toast(e?.message || 'Revoke failed', 'error');
          }
        });
      });
    } catch (e) {
      el.className = 'empty';
      el.innerHTML = `
        <div class="key-box"><code>${esc(maskKey(loadKey()))}</code></div>
        <p class="err">${esc(e?.message || 'Could not load keys.')}</p>
        <button type="button" class="linkish" data-action="chat">Back to chat</button>`;
      el.querySelector('[data-action="chat"]')?.addEventListener('click', () => navigate('chat'));
    }
  }

  const onClick = (e) => {
    const link = e.target.closest('[data-workspace-link]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.workspaceLink);
    }
  };
  root.addEventListener('click', onClick);

  render();

  return () => root.removeEventListener('click', onClick);
}
