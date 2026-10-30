import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agentSource = await readFile(new URL('../console/agent.js', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../console/api.js', import.meta.url), 'utf8');
const consoleSource = await readFile(new URL('../console/index.html', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../console/views/settings.js', import.meta.url), 'utf8');
const agentDocsSource = await readFile(new URL('../console/views/agent-docs.js', import.meta.url), 'utf8');
const { buildSdkSnippet, DEFAULT_MODEL } = Function('location', `${agentSource
  .replace(/^import .*;\n/gm, '')
  .replaceAll('export ', '')}
return { buildSdkSnippet, DEFAULT_MODEL };`)({ origin: 'https://malibu.tech' });

test('SDK snippets use the signed catalog default and preserve explicit model selection', () => {
  assert.equal(DEFAULT_MODEL, 'zai-org/glm-5.3-flash');
  for (const model of [undefined, null, '']) {
    assert.ok(buildSdkSnippet({ model }).includes(`model="${DEFAULT_MODEL}"`));
  }
  const snippet = buildSdkSnippet({ model: 'user-selected-model', apiKey: 'mp_example', threadId: 'thread-123' });
  assert.ok(snippet.includes('model="user-selected-model"'));
  assert.ok(snippet.includes('api_key="mp_example"'));
  assert.ok(snippet.includes('"X-MacProvider-Conversation": "thread-123"'));
});

test('agent docs share the SDK default and explain authenticated model discovery', () => {
  const { mount } = Function('buildSdkSnippet', 'DEFAULT_MODEL', 'loadKey', 'location', `${agentDocsSource
    .replace(/^import .*;\n/gm, '')
    .replaceAll('export ', '')}
return { mount };`)(buildSdkSnippet, DEFAULT_MODEL, () => null, { origin: 'https://malibu.tech' });
  const snippetEl = {};
  const root = {
    innerHTML: '',
    querySelector: (selector) => selector === '[data-snippet]' ? snippetEl : { addEventListener() {} },
    addEventListener() {},
  };
  mount(root, { navigate() {} });
  assert.ok(snippetEl.textContent.includes(`model="${DEFAULT_MODEL}"`));
  assert.ok(root.innerHTML.includes(`<code>${DEFAULT_MODEL}</code>`));
  assert.match(root.innerHTML, /GET \/v1\/models<\/code> with your API key/);
});

test('agent mode does not inject a console-authored system prompt', () => {
  assert.doesNotMatch(agentSource, /AGENT_SYSTEM_PROMPT/);
  assert.doesNotMatch(agentSource, /role: 'system', content:/);
  assert.match(agentSource, /return apiMessagesFromConversation\(conversation\)\.filter\(\(m\) => m\.role !== 'system'\)/);
});

test('chat mode sends the user and assistant conversation through unchanged', () => {
  assert.match(consoleSource, /import \{ runAgentLoop \} from '\.\/agent\.js';/);
  assert.match(consoleSource, /messages: conversation\.filter\(\(m\) => m\.role === 'user' \|\| m\.role === 'assistant'\)/);
  assert.doesNotMatch(consoleSource, /chatMessagesFromConversation/);
});

test('console clamps reply tokens to the live gateway cap', () => {
  assert.match(apiSource, /export const MAX_REPLY_TOKENS = 512/);
  assert.match(apiSource, /maxTokens: MAX_REPLY_TOKENS/);
  assert.match(apiSource, /settings\.maxTokens = clampReplyTokens\(settings\.maxTokens\)/);
  assert.match(settingsSource, /max="\$\{MAX_REPLY_TOKENS\}"/);
  assert.match(settingsSource, /maxTokEl\.value = s\.maxTokens \|\| MAX_REPLY_TOKENS/);
});

test('agent mode recovers tool calls dumped as assistant text', () => {
  assert.match(agentSource, /extractToolCallsFromContent\(content, tools\)/);
});

test('skips Qwen no-think on tool-calling turns and retries route snapshot failures', () => {
  assert.match(apiSource, /const outgoingMessages = tools\?\.length \? messages : withQwenNoThinkDirective\(model, messages\)/);
  assert.match(apiSource, /code === 'route_snapshot_failed'/);
  assert.match(apiSource, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(consoleSource, /Could not route this request/);
});
