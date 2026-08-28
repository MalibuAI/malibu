const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

function indexOfFolded(haystack, needle) {
  return haystack.toLowerCase().indexOf(needle);
}

function partialTagSuffixLength(text, tag) {
  const folded = text.toLowerCase();
  const max = Math.min(tag.length - 1, folded.length);
  for (let len = max; len > 0; len -= 1) {
    if (folded.slice(-len) === tag.slice(0, len)) return len;
  }
  return 0;
}

export function createThinkingContentFilter() {
  let pending = '';
  let inThinkingBlock = false;
  let emittedVisible = false;
  let trimNextVisible = false;
  let redacted = false;

  const appendVisible = (text) => {
    let visible = text;
    if (trimNextVisible && !emittedVisible) visible = visible.replace(/^\s+/, '');
    trimNextVisible = false;
    if (!visible) return '';
    emittedVisible = true;
    return visible;
  };

  return {
    push(chunk = '') {
      let text = pending + String(chunk);
      let output = '';
      pending = '';

      while (text) {
        if (inThinkingBlock) {
          const closeIdx = indexOfFolded(text, CLOSE_TAG);
          if (closeIdx === -1) {
            const keep = partialTagSuffixLength(text, CLOSE_TAG);
            pending = keep ? text.slice(-keep) : '';
            return output;
          }
          text = text.slice(closeIdx + CLOSE_TAG.length);
          inThinkingBlock = false;
          trimNextVisible = !emittedVisible;
          continue;
        }

        const openIdx = indexOfFolded(text, OPEN_TAG);
        if (openIdx === -1) {
          const keep = partialTagSuffixLength(text, OPEN_TAG);
          const visible = text.slice(0, text.length - keep);
          if (!emittedVisible && !keep && !visible.trim()) {
            pending = text;
            return output;
          }
          if (!emittedVisible && keep && !visible.trim()) {
            pending = text;
            return output;
          }
          output += appendVisible(visible);
          pending = keep ? text.slice(-keep) : '';
          return output;
        }

        const before = text.slice(0, openIdx);
        if (!emittedVisible && !before.trim()) {
          redacted = true;
          trimNextVisible = true;
          text = text.slice(openIdx + OPEN_TAG.length);
          inThinkingBlock = true;
        } else {
          output += appendVisible(text.slice(0, openIdx + OPEN_TAG.length));
          text = text.slice(openIdx + OPEN_TAG.length);
        }
      }

      return output;
    },

    flush() {
      if (inThinkingBlock) {
        redacted = true;
        pending = '';
        return '';
      }
      const visible = appendVisible(pending);
      pending = '';
      return visible;
    },

    get redacted() {
      return redacted;
    },
  };
}

export function stripThinkingContent(text) {
  const filter = createThinkingContentFilter();
  return filter.push(text) + filter.flush();
}

export function shouldFilterThinkingContent(modelId) {
  return /\bqwen/i.test(String(modelId || ''));
}

export function shouldSendNoThinkDirective(modelId) {
  const id = String(modelId || '');
  if (!/\bqwen3(?:\b|[\W_])/i.test(id)) return false;
  return !/\bqwen3[\w.-]*(?:thinking|instruct|base)(?:\b|[\W_])/i.test(id);
}

export function startsWithThinkingBlock(content) {
  return /^\s*<think>/i.test(String(content || ''));
}

export function sanitizeAssistantContent(content, { model } = {}) {
  if (typeof content !== 'string') return content;
  if (model && !shouldFilterThinkingContent(model)) return content;
  if (!model && !startsWithThinkingBlock(content)) return content;
  return stripThinkingContent(content);
}

export function sanitizeStoredThread(thread) {
  if (!thread || typeof thread !== 'object') return thread;
  if (!Array.isArray(thread.messages)) return thread;
  return {
    ...thread,
    messages: thread.messages.map((msg) => {
      if (!msg || msg.role !== 'assistant') return msg;
      const model = msg.model || (startsWithThinkingBlock(msg.content) ? '' : thread.model);
      const content = sanitizeAssistantContent(msg.content, { model });
      return content === msg.content ? msg : { ...msg, content };
    }),
  };
}

export function sanitizeStoredThreads(threads) {
  return Array.isArray(threads) ? threads.map(sanitizeStoredThread) : [];
}

export function withQwenNoThinkDirective(modelId, messages) {
  if (!shouldSendNoThinkDirective(modelId) || !Array.isArray(messages)) return messages;
  const next = messages.map((msg) => ({ ...msg }));
  const lastUserIndex = next.findLastIndex((msg) => msg?.role === 'user' && typeof msg.content === 'string');
  if (lastUserIndex === -1) return next;
  if (/\/no_think\s*$/i.test(next[lastUserIndex].content)) return next;
  next[lastUserIndex] = {
    ...next[lastUserIndex],
    content: `${next[lastUserIndex].content}\n\n/no_think`,
  };
  return next;
}
