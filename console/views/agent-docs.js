import { buildSdkSnippet } from '../agent.js';
import { loadKey } from '../api.js';

export const title = 'Agent SDK';

export function mount(root, { navigate }) {
  const base = `${location.origin}/api/mp/v1`;
  const snippet = buildSdkSnippet({
    model: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
    apiKey: loadKey() || 'mp_YOUR_KEY',
  });

  root.innerHTML = `
    <p class="sub">Malibu exposes an OpenAI-compatible API with MacProvider tool calling (SPEC-018). Run the agent loop in your client — the console does this in Agent mode.</p>
    <div class="panel">
      <h2>Agent-readable onboarding</h2>
      <p class="hint">Point your coding agent at <a href="https://get.malibu.tech/skill.md"><code>https://get.malibu.tech/skill.md</code></a>. It can install the provider CLI, check status, recover a broken setup, update or uninstall, and connect this SDK.</p>
    </div>
    <div class="panel">
      <h2>OpenAI Python SDK</h2>
      <p class="hint">Point the official SDK at Malibu. Tool calling uses standard <code>tools=</code> and <code>tool_calls</code> deltas.</p>
      <pre class="code-pre" data-snippet></pre>
      <div class="row">
        <button class="btn ghost" type="button" data-copy>Copy snippet</button>
      </div>
    </div>
    <div class="panel">
      <h2>Cline (VS Code)</h2>
      <p class="hint">Use Malibu as a custom OpenAI-compatible provider.</p>
      <ul class="ws-list">
        <li><strong>API Provider:</strong> OpenAI Compatible</li>
        <li><strong>Base URL:</strong> <code>${base}</code></li>
        <li><strong>API Key:</strong> your <code>mp_*</code> key from <button type="button" class="linkish" data-workspace-link="keys">API keys</button></li>
        <li><strong>Model ID:</strong> e.g. <code>mlx-community/Qwen2.5-7B-Instruct-4bit</code> (pick from pool)</li>
      </ul>
      <p class="hint">Optional header for sticky KV cache: <code>X-MacProvider-Conversation: &lt;thread-id&gt;</code></p>
    </div>
    <div class="panel">
      <h2>Continue (VS Code / JetBrains)</h2>
      <ul class="ws-list">
        <li><strong>Provider:</strong> OpenAI</li>
        <li><strong>apiBase:</strong> <code>${base}</code></li>
        <li><strong>apiKey:</strong> <code>mp_…</code></li>
        <li>Enable tool use in Continue settings; Malibu returns streaming <code>tool_calls</code> per SPEC-018.</li>
      </ul>
    </div>
    <div class="panel">
      <h2>Built-in console tools</h2>
      <p class="hint">Agent mode in the chat UI runs these client-side after you approve each batch:</p>
      <ul class="ws-list">
        <li><code>calculator</code> — safe arithmetic</li>
        <li><code>json_validate</code> — parse/validate JSON text</li>
        <li><code>web_fetch</code> — fetch public URLs (browser CORS limits apply)</li>
      </ul>
      <p class="hint">MCP server URL can be configured in <button type="button" class="linkish" data-workspace-link="settings">Settings</button> (connector stub — full MCP routing is Phase 3).</p>
    </div>
    <div class="nav-links">
      <button type="button" class="linkish" data-action="chat">Chat</button>
      <button type="button" class="linkish" data-workspace-link="settings">Settings</button>
      <a href="/docs">API docs</a>
    </div>`;

  root.querySelector('[data-snippet]').textContent = snippet;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      const btn = root.querySelector('[data-copy]');
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy snippet'; }, 2000);
    } catch {
      alert('Could not copy — select the snippet manually.');
    }
  };

  const onClick = (e) => {
    const link = e.target.closest('[data-workspace-link]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.workspaceLink);
      return;
    }
    if (e.target.closest('[data-action="chat"]')) {
      e.preventDefault();
      navigate('chat');
    }
  };

  root.querySelector('[data-copy]').addEventListener('click', onCopy);
  root.addEventListener('click', onClick);

  return () => {
    root.removeEventListener('click', onClick);
  };
}
