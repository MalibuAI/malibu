import * as dashboard from './views/dashboard.js';
import * as keys from './views/keys.js';
import * as settings from './views/settings.js';
import * as agentDocs from './views/agent-docs.js';

const VIEWS = {
  dashboard,
  keys,
  settings,
  'agent-docs': agentDocs,
};

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function createWorkspace({
  panelEl,
  chatHeadEl,
  workspaceHeadEl,
  chatShellEl,
  workspacePaneEl,
  workspaceContentEl,
  workspaceTitleEl,
  closeBtnEl,
  railEl,
  toast,
  onSettingsSaved,
  openAccount,
}) {
  let activeView = null;
  let cleanup = null;

  function setRailActive(viewId) {
    railEl?.querySelectorAll('[data-workspace]').forEach((item) => {
      item.classList.toggle('active', item.dataset.workspace === viewId);
    });
  }

  function updateUrl(viewId) {
    const params = new URLSearchParams(location.search);
    const thread = params.get('thread');
    if (viewId && viewId !== 'chat') params.set('view', viewId);
    else params.delete('view');
    const qs = params.toString();
    const path = location.pathname;
    history.replaceState({}, '', qs ? `${path}?${qs}` : path + (thread ? `?thread=${thread}` : ''));
  }

  function close() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    activeView = null;
    panelEl?.classList.remove('workspace-open');
    chatHeadEl?.removeAttribute('hidden');
    workspaceHeadEl?.setAttribute('hidden', '');
    chatShellEl?.removeAttribute('hidden');
    workspacePaneEl?.setAttribute('hidden', '');
    workspaceContentEl.innerHTML = '';
    setRailActive('');
    updateUrl('chat');
  }

  function open(viewId) {
    if (viewId === 'chat' || !viewId) {
      close();
      return;
    }
    const mod = VIEWS[viewId];
    if (!mod) return;

    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    activeView = viewId;
    panelEl?.classList.add('workspace-open');
    chatHeadEl?.setAttribute('hidden', '');
    workspaceHeadEl?.removeAttribute('hidden');
    chatShellEl?.setAttribute('hidden', '');
    workspacePaneEl?.removeAttribute('hidden');
    workspaceTitleEl.textContent = mod.title || viewId;
    workspaceContentEl.innerHTML = '';
    setRailActive(viewId);
    updateUrl(viewId);

    cleanup = mod.mount(workspaceContentEl, {
      navigate: (id) => {
        if (id === 'chat') close();
        else open(id);
        if (id === 'settings' && onSettingsSaved) onSettingsSaved();
      },
      esc,
      toast,
      openAccount,
    });
  }

  closeBtnEl?.addEventListener('click', () => close());

  railEl?.querySelectorAll('[data-workspace]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.workspace;
      if (activeView === id) close();
      else open(id);
    });
  });

  const params = new URLSearchParams(location.search);
  const viewParam = params.get('view');
  if (viewParam && VIEWS[viewParam]) open(viewParam);

  return { open, close, activeView: () => activeView };
}
