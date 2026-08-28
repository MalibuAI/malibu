import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolsSource = await readFile(new URL('../console/tools.js', import.meta.url), 'utf8');
const {
  normalizeToolArguments,
  normalizeToolCallForReplay,
} = Function(`${toolsSource.replaceAll('export ', '')}
return { normalizeToolArguments, normalizeToolCallForReplay };`)();

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
