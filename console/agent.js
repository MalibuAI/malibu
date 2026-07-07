import { chatStream } from './api.js';
import { executeTool } from './tools.js';

const MAX_AGENT_STEPS = 8;

export function createToolAccumulator() {
  const acc = {};
  return {
    merge(deltaToolCalls) {
      for (const tc of deltaToolCalls || []) {
        const i = tc.index ?? 0;
        if (!acc[i]) acc[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (tc.id) acc[i].id = tc.id;
        if (tc.type) acc[i].type = tc.type;
        if (tc.function?.name) acc[i].function.name += tc.function.name;
        if (tc.function?.arguments != null) acc[i].function.arguments += tc.function.arguments;
      }
    },
    list() {
      return Object.keys(acc)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ ...acc[k] }));
    },
    reset() {
      for (const k of Object.keys(acc)) delete acc[k];
    },
  };
}

export function apiMessagesFromConversation(conversation) {
  return conversation.map((m) => {
    if (m.role === 'assistant' && m.tool_calls) {
      return { role: 'assistant', content: m.content ?? null, tool_calls: m.tool_calls };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * Stream one model turn. Yields chatStream events plus:
 * { type: 'tool_status', toolCalls } when complete with tools.
 */
export async function* streamTurn({
  model,
  messages,
  maxTokens,
  conversationId,
  tools,
  responseFormat,
  signal,
  onToolDelta,
}) {
  let content = '';
  let usage = null;
  let meta = {};
  let finishReason = '';
  let lastToolCalls = [];

  for await (const event of chatStream({
    model,
    messages,
    maxTokens,
    conversationId,
    tools,
    toolChoice: tools?.length ? 'auto' : undefined,
    responseFormat,
    signal,
  })) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (event.type === 'tool_delta') {
      lastToolCalls = event.toolCalls || [];
      onToolDelta?.(lastToolCalls);
      yield event;
    } else if (event.type === 'delta') {
      content += event.text;
      yield event;
    } else if (event.type === 'done') {
      usage = event.usage;
      meta = event.meta || {};
      finishReason = event.finishReason || '';
      const toolCalls = event.toolCalls?.length ? event.toolCalls : lastToolCalls;
      yield {
        type: 'done',
        content: event.content ?? content,
        usage,
        meta,
        finishReason,
        toolCalls,
      };
    }
  }
}

export async function requestToolApproval(toolCalls, { autoApprove, signal }) {
  if (autoApprove) return true;
  if (signal?.aborted) return false;
  return new Promise((resolve) => {
    const onAbort = () => {
      resolve(false);
      cleanup();
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const evt = new CustomEvent('malibu:tool-approval', {
      detail: {
        toolCalls,
        resolve: (approved) => {
          cleanup();
          resolve(approved);
        },
      },
    });
    window.dispatchEvent(evt);
  });
}

export async function runAgentLoop({
  model,
  conversation,
  maxTokens,
  conversationId,
  tools,
  responseFormat,
  autoApprove,
  signal,
  onTimeline,
  onStreamDelta,
  onStreamToolDelta,
}) {
  let steps = 0;
  let lastUsage = null;
  let lastMeta = {};
  let lastContent = '';

  while (steps < MAX_AGENT_STEPS) {
    if (signal?.aborted) {
      return {
        content: lastContent || 'Generation stopped.',
        usage: lastUsage,
        meta: lastMeta,
        cancelled: true,
        steps,
      };
    }

    steps += 1;
    onTimeline?.({ kind: 'step', label: `Model turn ${steps}`, status: 'running' });

    let content = '';
    let toolCalls = [];
    let finishReason = '';

    for await (const event of streamTurn({
      model,
      messages: apiMessagesFromConversation(conversation),
      maxTokens,
      conversationId,
      tools,
      responseFormat,
      signal,
      onToolDelta: onStreamToolDelta,
    })) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (event.type === 'delta') {
        content += event.text;
        onStreamDelta?.(content);
      } else if (event.type === 'done') {
        content = event.content ?? content;
        toolCalls = event.toolCalls || [];
        finishReason = event.finishReason || '';
        lastUsage = event.usage;
        lastMeta = event.meta || {};
      }
    }

    if (!toolCalls.length) {
      onTimeline?.({ kind: 'step', label: `Reply complete`, status: 'done' });
      return { content, usage: lastUsage, meta: lastMeta, toolCalls: null, steps };
    }

    lastContent = content;

    onTimeline?.({
      kind: 'tools',
      label: `${toolCalls.length} tool call${toolCalls.length === 1 ? '' : 's'}`,
      status: 'pending',
      toolCalls,
    });

    const approved = await requestToolApproval(toolCalls, { autoApprove, signal });
    if (!approved) {
      onTimeline?.({ kind: 'tools', label: 'Tool calls rejected', status: 'rejected', toolCalls });
      return {
        content: content || (signal?.aborted ? 'Generation stopped.' : 'Tool execution cancelled.'),
        usage: lastUsage,
        meta: lastMeta,
        cancelled: true,
        steps,
      };
    }

    conversation.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type || 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    for (const tc of toolCalls) {
      if (signal?.aborted) {
        return {
          content: lastContent || 'Generation stopped.',
          usage: lastUsage,
          meta: lastMeta,
          cancelled: true,
          steps,
        };
      }
      const name = tc.function?.name;
      const args = tc.function?.arguments || '{}';
      onTimeline?.({ kind: 'tool', label: `${name}(…)`, status: 'running', tool: tc });

      let result;
      try {
        result = await executeTool(name, args);
        onTimeline?.({ kind: 'tool', label: `${name} ✓`, status: 'done', tool: tc, result });
      } catch (e) {
        result = JSON.stringify({ error: e.message });
        onTimeline?.({ kind: 'tool', label: `${name} failed`, status: 'error', tool: tc, result });
      }

      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content: result,
      });
    }
  }

  return {
    content: 'Agent stopped after maximum tool steps.',
    usage: lastUsage,
    meta: lastMeta,
    maxSteps: true,
    steps,
  };
}

export function buildSdkSnippet({ model, threadId, apiKey }) {
  const key = apiKey || 'mp_YOUR_KEY';
  const conv = threadId ? `\n  default_headers={"X-MacProvider-Conversation": "${threadId}"},` : '';
  return `from openai import OpenAI

client = OpenAI(
    api_key="${key}",
    base_url="${location.origin}/api/mp/v1",${conv}
)

# Agent loop: pass tools= and handle tool_calls in your client.
resp = client.chat.completions.create(
    model="${model || 'mlx-community/Qwen2.5-7B-Instruct-4bit'}",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
)
for chunk in resp:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;
}
