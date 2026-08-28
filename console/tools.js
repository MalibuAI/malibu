/** Built-in client-side tools for Malibu Agent mode (SPEC-018 buyer-side execution). */

export const BUILTIN_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Evaluate a safe arithmetic expression. Supports +, -, *, /, parentheses, and decimals.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Arithmetic expression, e.g. (42 * 1.5) + 8' },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'json_validate',
      description: 'Parse and validate a JSON string. Returns ok or the parse error.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'JSON text to validate' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a public HTTP/HTTPS URL and return the first 8k characters of the response body (CORS-permitting hosts only).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http(s) URL' },
        },
        required: ['url'],
      },
    },
  },
];

function safeCalc(expression) {
  const expr = String(expression || '').trim();
  if (!expr) throw new Error('Empty expression');
  if (!/^[\d\s+\-*/().%]+$/.test(expr)) throw new Error('Expression contains unsupported characters');
  // eslint-disable-next-line no-new-func
  const val = Function(`"use strict"; return (${expr})`)();
  if (!Number.isFinite(val)) throw new Error('Result is not a finite number');
  return val;
}

function parseToolArgs(argsJson) {
  const raw = String(argsJson ?? '').trim();
  if (!raw) return { kind: 'object', value: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { kind: 'object', value: parsed };
    }
    if (typeof parsed === 'string') return { kind: 'string', value: parsed };
    return { kind: 'value', value: parsed };
  } catch {
    return { kind: 'string', value: raw };
  }
}

function pickStringArg(parsed, keys) {
  if (parsed.kind === 'string') return parsed.value;
  if (parsed.kind !== 'object') return String(parsed.value ?? '');
  for (const key of keys) {
    const value = parsed.value?.[key];
    if (value != null) return String(value);
  }
  return '';
}

function normalizeHttpUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  return url;
}

export function normalizeToolArguments(name, argsJson) {
  const parsed = parseToolArgs(argsJson);

  switch (name) {
    case 'calculator':
      return JSON.stringify({ expression: pickStringArg(parsed, ['expression', 'expr', 'input']) });
    case 'json_validate': {
      const text = parsed.kind === 'object' && parsed.value?.text == null
        ? JSON.stringify(parsed.value)
        : pickStringArg(parsed, ['text', 'json', 'input']);
      return JSON.stringify({ text });
    }
    case 'web_fetch':
      return JSON.stringify({ url: normalizeHttpUrl(pickStringArg(parsed, ['url', 'href', 'uri', 'link', 'input'])) });
    default:
      return parsed.kind === 'object' ? JSON.stringify(parsed.value) : JSON.stringify({ value: String(argsJson ?? '') });
  }
}

export function normalizeToolCallForReplay(toolCall, index = 0) {
  const name = String(toolCall?.function?.name || '');
  return {
    id: String(toolCall?.id || `call_${index}`),
    type: toolCall?.type || 'function',
    function: {
      name,
      arguments: normalizeToolArguments(name, toolCall?.function?.arguments),
    },
  };
}

export async function executeTool(name, argsJson) {
  let args = {};
  try {
    args = JSON.parse(normalizeToolArguments(name, argsJson));
  } catch (e) {
    throw new Error(`Invalid tool arguments JSON: ${e.message}`);
  }

  switch (name) {
    case 'calculator': {
      const result = safeCalc(args.expression);
      return JSON.stringify({ result });
    }
    case 'json_validate': {
      try {
        const parsed = JSON.parse(args.text);
        return JSON.stringify({ valid: true, type: Array.isArray(parsed) ? 'array' : typeof parsed });
      } catch (e) {
        return JSON.stringify({ valid: false, error: e.message });
      }
    }
    case 'web_fetch': {
      const url = String(args.url || '').trim();
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Invalid URL');
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs allowed');
      const r = await fetch(url, { headers: { Accept: 'text/plain,text/html,application/json,*/*' } });
      const text = await r.text();
      return JSON.stringify({
        status: r.status,
        ok: r.ok,
        content_type: r.headers.get('content-type') || '',
        body: text.slice(0, 8000),
        truncated: text.length > 8000,
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function toolsForMode(mode, mcpTools = []) {
  if (mode !== 'agent') return undefined;
  return [...BUILTIN_TOOL_SCHEMAS, ...mcpTools];
}
