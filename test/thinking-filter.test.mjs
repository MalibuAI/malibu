import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createThinkingContentFilter,
  sanitizeAssistantContent,
  sanitizeStoredThread,
  shouldFilterThinkingContent,
  stripThinkingContent,
} from '../j/thinking-filter.mjs';

test('strips a leading Qwen thinking block from assistant content', () => {
  const text = '<think>\nprivate reasoning\n</think>\n\nVisible answer.';
  assert.equal(stripThinkingContent(text), 'Visible answer.');
});

test('marks filters as redacted when hidden thinking is stripped', () => {
  const filter = createThinkingContentFilter();
  assert.equal(filter.redacted, false);
  assert.equal(filter.push('<think>hidden</think>Visible'), 'Visible');
  assert.equal(filter.redacted, true);
});

test('strips thinking blocks when tags are split across stream chunks', () => {
  const filter = createThinkingContentFilter();
  const chunks = ['\n<th', 'ink>private</th', 'ink>\n\nVisible', ' answer.'];
  const streamed = chunks.map((chunk) => filter.push(chunk)).join('') + filter.flush();
  assert.equal(streamed, 'Visible answer.');
});

test('strips thinking when a leading whitespace chunk arrives before the open tag', () => {
  const filter = createThinkingContentFilter();
  const streamed = ['\n\n', '<think>hidden</think>Visible']
    .map((chunk) => filter.push(chunk))
    .join('') + filter.flush();

  assert.equal(streamed, 'Visible');
  assert.equal(filter.redacted, true);
});

test('preserves leading whitespace before ordinary visible content', () => {
  const filter = createThinkingContentFilter();
  const streamed = ['\n\n', 'Visible answer.']
    .map((chunk) => filter.push(chunk))
    .join('') + filter.flush();

  assert.equal(streamed, '\n\nVisible answer.');
  assert.equal(filter.redacted, false);
});

test('preserves literal think tags after visible content starts', () => {
  assert.equal(stripThinkingContent('Intro <think>literal</think> outro'), 'Intro <think>literal</think> outro');
});

test('discards an unclosed thinking block', () => {
  assert.equal(stripThinkingContent('<think>private reasoning'), '');
});

test('preserves unclosed literal think tags after visible content starts', () => {
  assert.equal(stripThinkingContent('Use <think> as literal text'), 'Use <think> as literal text');
});

test('flushes ordinary text that only looks like a partial tag', () => {
  assert.equal(stripThinkingContent('Use <thi as text'), 'Use <thi as text');
});

test('scopes thinking filtering to Qwen-family models', () => {
  assert.equal(shouldFilterThinkingContent('mlx-community/Qwen3-8B-4bit'), true);
  assert.equal(shouldFilterThinkingContent('openai/gpt-oss-20b'), false);
  assert.equal(
    sanitizeAssistantContent('<think>literal</think>', { model: 'openai/gpt-oss-20b' }),
    '<think>literal</think>',
  );
});

test('sanitizes saved Qwen assistant history before rendering or replay', () => {
  const thread = sanitizeStoredThread({
    id: 'saved-qwen',
    model: 'mlx-community/Qwen3-8B-4bit',
    messages: [
      { role: 'user', content: 'tell me more' },
      { role: 'assistant', content: '<think>hidden</think>\n\nVisible saved answer.' },
    ],
  });

  assert.equal(thread.messages[0].content, 'tell me more');
  assert.equal(thread.messages[1].content, 'Visible saved answer.');
});

test('sanitizes legacy assistant history with no per-message model when a thinking block leads', () => {
  const thread = sanitizeStoredThread({
    id: 'legacy-mixed-model',
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'assistant', content: '<think>hidden qwen turn</think>\n\nVisible legacy answer.' },
    ],
  });

  assert.equal(thread.messages[0].content, 'Visible legacy answer.');
});

test('preserves saved non-Qwen literal think tags', () => {
  const thread = sanitizeStoredThread({
    id: 'saved-other',
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'assistant', model: 'openai/gpt-oss-20b', content: '<think>literal</think>\n\nVisible saved answer.' },
    ],
  });

  assert.equal(thread.messages[0].content, '<think>literal</think>\n\nVisible saved answer.');
});
