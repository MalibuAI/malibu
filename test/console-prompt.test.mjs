import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agentSource = await readFile(new URL('../console/agent.js', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../console/api.js', import.meta.url), 'utf8');
const consoleSource = await readFile(new URL('../console/index.html', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../console/views/settings.js', import.meta.url), 'utf8');

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
