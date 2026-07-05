import {
  getStatus, loadSettings, saveSettings, resetQuotaAlert,
  exportThreadsBundle, importThreadsBundle, filterPoolModels,
} from '../api.js';

export const title = 'Settings';

export function mount(root, { navigate, toast }) {
  root.innerHTML = `
    <p class="sub">Chat defaults, model policy, thread backup, and usage alerts — stored locally.</p>
    <form data-form>
      <div class="panel">
        <h2>Chat defaults</h2>
        <div class="field">
          <label for="default-model">Default model</label>
          <select id="default-model" name="defaultModel" data-default-model>
            <option value="">Auto (first available)</option>
          </select>
        </div>
        <div class="field">
          <label for="max-tokens">Max tokens per reply</label>
          <input id="max-tokens" name="maxTokens" type="number" min="64" max="4096" step="64" data-max-tokens />
        </div>
      </div>
      <div class="panel">
        <h2>Model policy (local)</h2>
        <p class="hint" style="margin-top:0;">Filter models in this browser. Server-side enforcement requires a gateway policy API.</p>
        <div class="field">
          <label for="model-policy">Policy mode</label>
          <select id="model-policy" data-model-policy>
            <option value="all">All pool models</option>
            <option value="allowlist">Allowlist only</option>
            <option value="blocklist">Blocklist</option>
          </select>
        </div>
        <div class="field" data-allow-field>
          <label>Allowed models</label>
          <div data-allow-models class="model-checks"></div>
        </div>
        <div class="field" data-block-field hidden>
          <label>Blocked models</label>
          <div data-block-models class="model-checks"></div>
        </div>
      </div>
      <div class="panel">
        <h2>Thread backup</h2>
        <p class="hint" style="margin-top:0;">Export/import chat history as JSON. Encrypted server sync is pending gateway APIs.</p>
        <div class="row">
          <button class="btn ghost" type="button" data-export-threads>Export threads</button>
          <label class="btn ghost" style="cursor:pointer;">Import threads<input type="file" accept="application/json,.json" data-import-threads hidden /></label>
        </div>
        <div class="field" style="margin-top:12px;">
          <label><input type="checkbox" data-thread-sync disabled /> Sync threads to account (coming soon)</label>
        </div>
      </div>
      <div class="panel">
        <h2>Usage alerts</h2>
        <p class="hint" style="margin-top:0;">Toast notifications when daily quota crosses these thresholds (signed-in only).</p>
        <div class="field">
          <label><input type="checkbox" data-alert="50" /> 50% of daily quota</label>
        </div>
        <div class="field">
          <label><input type="checkbox" data-alert="80" /> 80% of daily quota</label>
        </div>
        <div class="field">
          <label><input type="checkbox" data-alert="100" /> 100% of daily quota</label>
        </div>
      </div>
      <div class="panel">
        <h2>Spend limit (local)</h2>
        <p class="hint" style="margin-top:0;">Soft warning based on estimated spend from local chat history and the public rate card.</p>
        <div class="field">
          <label for="spend-limit">Monthly soft limit (USD)</label>
          <input id="spend-limit" name="softSpendLimitUsd" type="number" min="0" step="1" placeholder="No limit" data-spend-limit />
        </div>
      </div>
      <div class="panel">
        <h2>Agent · tools &amp; code</h2>
        <p class="hint" style="margin-top:0;">Tools run in your browser. Approve each batch unless auto-approve is on.</p>
        <div class="field">
          <label><input type="checkbox" data-agent-auto /> Auto-approve tool calls</label>
        </div>
        <div class="field">
          <label for="mcp-url">MCP server URL</label>
          <input id="mcp-url" name="mcpServerUrl" type="url" placeholder="https://mcp.example.com/sse" data-mcp-url />
          <p class="hint" style="margin-top:8px;">Optional connector for external MCP tools (Phase 3 stub).</p>
        </div>
      </div>
      <div class="row">
        <button class="btn" type="submit">Save settings</button>
        <button class="btn ghost" type="button" data-reset-alerts>Reset alert state</button>
      </div>
    </form>
    <div class="nav-links">
      <button type="button" class="linkish" data-workspace-link="dashboard">Dashboard</button>
      <button type="button" class="linkish" data-workspace-link="team">Team</button>
      <button type="button" class="linkish" data-workspace-link="keys">API keys</button>
      <a href="/widget/" target="_blank" rel="noopener">Embed widget</a>
    </div>`;

  const form = root.querySelector('[data-form]');
  const modelEl = root.querySelector('[data-default-model]');
  const maxTokEl = root.querySelector('[data-max-tokens]');
  const spendEl = root.querySelector('[data-spend-limit]');
  const alertBoxes = [...root.querySelectorAll('[data-alert]')];
  const agentAutoEl = root.querySelector('[data-agent-auto]');
  const mcpUrlEl = root.querySelector('[data-mcp-url]');
  const policyEl = root.querySelector('[data-model-policy]');
  const allowField = root.querySelector('[data-allow-field]');
  const blockField = root.querySelector('[data-block-field]');
  const allowBox = root.querySelector('[data-allow-models]');
  const blockBox = root.querySelector('[data-block-models]');
  let poolModels = [];

  function modelLabel(id) {
    const tail = id.split('/').pop() || id;
    return tail.replace(/-Instruct-4bit$/i, '').replace(/-/g, ' ');
  }

  function renderModelChecks() {
    const s = loadSettings();
    const mkCheck = (container, listKey) => {
      container.innerHTML = '';
      for (const m of poolModels) {
        const id = `m-${listKey}-${m.id.replace(/[^a-z0-9]/gi, '-')}`;
        const label = document.createElement('label');
        label.style.cssText = 'display:block;margin-bottom:6px;font-size:13px;text-transform:none;letter-spacing:0;';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = m.id;
        box.id = id;
        box.checked = (s[listKey] || []).includes(m.id);
        label.append(box, document.createTextNode(` ${modelLabel(m.id)}`));
        container.appendChild(label);
      }
    };
    mkCheck(allowBox, 'allowedModels');
    mkCheck(blockBox, 'blockedModels');
    const policy = policyEl.value;
    allowField.hidden = policy !== 'allowlist';
    blockField.hidden = policy !== 'blocklist';
  }

  function readModelLists() {
    const read = (container) => [...container.querySelectorAll('input:checked')].map((b) => b.value);
    return {
      allowedModels: read(allowBox),
      blockedModels: read(blockBox),
    };
  }

  async function loadModels() {
    try {
      const s = await getStatus();
      poolModels = filterPoolModels(s?.models || []);
      for (const m of poolModels) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = modelLabel(m.id);
        modelEl.appendChild(opt);
      }
      renderModelChecks();
    } catch {}
  }

  function applySettings() {
    const s = loadSettings();
    modelEl.value = s.defaultModel || '';
    maxTokEl.value = s.maxTokens || 1024;
    spendEl.value = s.softSpendLimitUsd ?? '';
    policyEl.value = s.modelPolicy || 'all';
    const thresholds = new Set(s.alertThresholds || [50, 80, 100]);
    for (const box of alertBoxes) {
      box.checked = thresholds.has(Number(box.dataset.alert));
    }
    if (agentAutoEl) agentAutoEl.checked = !!s.agentAutoApprove;
    if (mcpUrlEl) mcpUrlEl.value = s.mcpServerUrl || '';
    renderModelChecks();
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const thresholds = alertBoxes.filter((b) => b.checked).map((b) => Number(b.dataset.alert));
    const lists = readModelLists();
    saveSettings({
      defaultModel: modelEl.value,
      maxTokens: Math.min(4096, Math.max(64, Number(maxTokEl.value) || 1024)),
      alertThresholds: thresholds.length ? thresholds : [50, 80, 100],
      softSpendLimitUsd: spendEl.value === '' ? null : Number(spendEl.value),
      agentAutoApprove: !!agentAutoEl?.checked,
      mcpServerUrl: mcpUrlEl?.value?.trim() || '',
      modelPolicy: policyEl.value,
      allowedModels: lists.allowedModels,
      blockedModels: lists.blockedModels,
    });
    toast('Settings saved.');
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(exportThreadsBundle(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `malibu-threads-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Threads exported.');
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const n = importThreadsBundle(text, { merge: true });
      toast(`Imported ${n} threads.`);
    } catch (err) {
      toast(err?.message || 'Import failed', 'error');
    }
    e.target.value = '';
  };

  policyEl.addEventListener('change', renderModelChecks);
  root.querySelector('[data-export-threads]').addEventListener('click', onExport);
  root.querySelector('[data-import-threads]').addEventListener('change', onImport);

  const onReset = () => {
    resetQuotaAlert();
    toast('Alert thresholds will fire again on next crossing.');
  };

  const onClick = (e) => {
    const link = e.target.closest('[data-workspace-link]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.workspaceLink);
    }
  };

  form.addEventListener('submit', onSubmit);
  root.querySelector('[data-reset-alerts]').addEventListener('click', onReset);
  root.addEventListener('click', onClick);

  loadModels().then(applySettings);

  return () => {
    form.removeEventListener('submit', onSubmit);
    root.removeEventListener('click', onClick);
  };
}
