import { getStatus, loadSettings, saveSettings, resetQuotaAlert } from '../api.js';

export const title = 'Settings';

export function mount(root, { navigate, toast }) {
  root.innerHTML = `
    <p class="sub">Chat defaults and usage alerts stored locally in this browser.</p>
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
        <p class="hint" style="margin-top:0;">Soft warning based on estimated spend from local chat history and the public rate card. Does not block requests.</p>
        <div class="field">
          <label for="spend-limit">Monthly soft limit (USD)</label>
          <input id="spend-limit" name="softSpendLimitUsd" type="number" min="0" step="1" placeholder="No limit" data-spend-limit />
        </div>
      </div>
      <div class="panel">
        <h2>Agent mode</h2>
        <p class="hint" style="margin-top:0;">Tools run in your browser. Malibu streams <code>tool_calls</code> from MacProvider; you approve each batch unless auto-approve is on.</p>
        <div class="field">
          <label><input type="checkbox" data-agent-auto /> Auto-approve tool calls (skip confirmation modal)</label>
        </div>
        <div class="field">
          <label for="mcp-url">MCP server URL (optional stub)</label>
          <input id="mcp-url" name="mcpServerUrl" type="url" placeholder="https://mcp.example.com/sse" data-mcp-url />
          <p class="hint" style="margin-top:8px;">Reserved for future MCP tool discovery. Built-in tools work without this.</p>
        </div>
      </div>
      <div class="row">
        <button class="btn" type="submit">Save settings</button>
        <button class="btn ghost" type="button" data-reset-alerts>Reset alert state</button>
      </div>
    </form>
    <div class="nav-links">
      <button type="button" class="linkish" data-workspace-link="dashboard">Dashboard</button>
      <button type="button" class="linkish" data-workspace-link="keys">API keys</button>
      <button type="button" class="linkish" data-workspace-link="agent-docs">Agent SDK</button>
      <a href="/docs">API docs</a>
    </div>`;

  const form = root.querySelector('[data-form]');
  const modelEl = root.querySelector('[data-default-model]');
  const maxTokEl = root.querySelector('[data-max-tokens]');
  const spendEl = root.querySelector('[data-spend-limit]');
  const alertBoxes = [...root.querySelectorAll('[data-alert]')];
  const agentAutoEl = root.querySelector('[data-agent-auto]');
  const mcpUrlEl = root.querySelector('[data-mcp-url]');

  function modelLabel(id) {
    const tail = id.split('/').pop() || id;
    return tail.replace(/-Instruct-4bit$/i, '').replace(/-/g, ' ');
  }

  async function loadModels() {
    try {
      const s = await getStatus();
      const models = Array.isArray(s?.models) ? s.models : [];
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = modelLabel(m.id);
        modelEl.appendChild(opt);
      }
    } catch {}
  }

  function applySettings() {
    const s = loadSettings();
    modelEl.value = s.defaultModel || '';
    maxTokEl.value = s.maxTokens || 1024;
    spendEl.value = s.softSpendLimitUsd ?? '';
    const thresholds = new Set(s.alertThresholds || [50, 80, 100]);
    for (const box of alertBoxes) {
      box.checked = thresholds.has(Number(box.dataset.alert));
    }
    if (agentAutoEl) agentAutoEl.checked = !!s.agentAutoApprove;
    if (mcpUrlEl) mcpUrlEl.value = s.mcpServerUrl || '';
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const thresholds = alertBoxes.filter((b) => b.checked).map((b) => Number(b.dataset.alert));
    saveSettings({
      defaultModel: modelEl.value,
      maxTokens: Math.min(4096, Math.max(64, Number(maxTokEl.value) || 1024)),
      alertThresholds: thresholds.length ? thresholds : [50, 80, 100],
      softSpendLimitUsd: spendEl.value === '' ? null : Number(spendEl.value),
      agentAutoApprove: !!agentAutoEl?.checked,
      mcpServerUrl: mcpUrlEl?.value?.trim() || '',
    });
    toast('Settings saved.');
  };

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
