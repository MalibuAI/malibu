import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolsSource = await readFile(new URL('../console/tools.js', import.meta.url), 'utf8');
const {
  normalizeToolArguments,
  normalizeToolCallForReplay,
  extractToolCallsFromContent,
} = Function(`${toolsSource.replaceAll('export ', '')}
return { normalizeToolArguments, normalizeToolCallForReplay, extractToolCallsFromContent };`)();

test('normalizes raw web_fetch arguments into JSON with an absolute URL', () => {
  assert.equal(
    normalizeToolArguments('web_fetch', 'malibu.tech'),
    JSON.stringify({ url: 'https://malibu.tech' }),
  );
});

test('normalizes alternate web_fetch URL keys for gateway replay', () => {
  assert.equal(
    normalizeToolArguments('web_fetch', JSON.stringify({ input: 'www.malibu.tech/docs' })),
    JSON.stringify({ url: 'https://www.malibu.tech/docs' }),
  );
});

test('repairs web_fetch JSON arguments with trailing model punctuation', () => {
  assert.equal(
    normalizeToolArguments('web_fetch', '{"url":"https://malibu.tech"}}'),
    JSON.stringify({ url: 'https://malibu.tech' }),
  );
});

test('normalizes built-in tool calls before replaying them to the model', () => {
  assert.deepEqual(
    normalizeToolCallForReplay({
      id: 'call_1',
      type: 'function',
      function: { name: 'web_fetch', arguments: 'malibu.tech' },
    }),
    {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'web_fetch',
        arguments: JSON.stringify({ url: 'https://malibu.tech' }),
      },
    },
  );
});

test('preserves calculator and json_validate as schema-shaped JSON', () => {
  assert.equal(
    normalizeToolArguments('calculator', '2 + 2'),
    JSON.stringify({ expression: '2 + 2' }),
  );
  assert.equal(
    normalizeToolArguments('json_validate', '{"hello":true}'),
    JSON.stringify({ text: '{"hello":true}' }),
  );
});

const builtinTools = [
  { type: 'function', function: { name: 'calculator' } },
  { type: 'function', function: { name: 'json_validate' } },
  { type: 'function', function: { name: 'web_fetch' } },
];

test('extracts Llama markdown test-case calculator JSON dumped as assistant text', () => {
  const content = `Here are two test cases:

**Test Case 1:**

**Response should be:**

\`\`\`json
{
  "name": "calculator",
  "parameters": {
    "expression": "(42 * 1.5) + 8"
  }
}
\`\`\`
`;
  const calls = extractToolCallsFromContent(content, builtinTools);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'calculator');
  assert.equal(JSON.parse(calls[0].function.arguments).expression, '(42 * 1.5) + 8');
});

test('extracts schema-echo calculator JSON dumped as assistant text', () => {
  const content = "Here is a JSON object representing a call to the 'calculator' function with a valid argument: {'name': 'calculator', 'parameters': {'properties': {'expression': '42 + 1.5 * 8'}}}";
  const calls = extractToolCallsFromContent(content, builtinTools);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'calculator');
  assert.equal(JSON.parse(calls[0].function.arguments).expression, '42 + 1.5 * 8');
});

test('extracts Qwen <tool_call> markup dumped as assistant text', () => {
  const content = '<tool_call>{"name":"web_fetch","arguments":{"url":"https://malibu.tech"}}</tool_call>';
  const calls = extractToolCallsFromContent(content, builtinTools);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'web_fetch');
  assert.equal(JSON.parse(calls[0].function.arguments).url, 'https://malibu.tech');
});

test('ignores assistant JSON that is not a declared tool', () => {
  const content = '{"name":"shell","arguments":{"cmd":"ls"}}';
  assert.deepEqual(extractToolCallsFromContent(content, builtinTools), []);
});
