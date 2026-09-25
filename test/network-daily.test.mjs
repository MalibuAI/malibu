import assert from 'node:assert/strict';
import test from 'node:test';

import { compareText, formatDay, growthWindow, sumTokens } from '../src/network-daily.mjs';

function day(t, tokens, requests = 1) {
  return { t, requests, input_tokens: tokens, output_tokens: 0 };
}

test('90-day window uses the published days and refuses a prior window that is not there', () => {
  const points = Array.from({ length: 90 }, (_, i) => day('2026-06-' + String((i % 28) + 1).padStart(2, '0'), 1000 * (i + 1)));
  const view = growthWindow({ bucket: '1d', points }, 90);
  assert.equal(view.current.length, 90);
  assert.equal(view.comparable, false);
  assert.match(compareText(view), /90 complete UTC days/);
  assert.equal(compareText(view).includes('sample'), false);
});

test('30-day window compares the previous 30 complete days', () => {
  const points = Array.from({ length: 60 }, (_, i) => day('2026-07-' + String((i % 28) + 1).padStart(2, '0'), i < 30 ? 1_000_000 : 2_000_000));
  const view = growthWindow({ points }, 30);
  assert.equal(view.current.length, 30);
  assert.equal(view.comparable, true);
  assert.equal(sumTokens(view.current), 60_000_000);
  assert.equal(sumTokens(view.prior), 30_000_000);
  assert.equal(compareText(view), 'vs prior 30 days: +100% · +30M tokens');
});

test('a short series does not invent the missing days', () => {
  const view = growthWindow({
    points: [
      day('2026-09-23', 10),
      { t: 'not-a-day', requests: 1, input_tokens: 1, output_tokens: 1 },
      day('2026-09-24', 5, 2),
    ],
  }, 7);
  assert.equal(view.current.length, 2);
  assert.equal(view.current[0].t, '2026-09-23');
  assert.equal(view.current[1].tokens, 5);
  assert.equal(view.comparable, false);
  assert.equal(formatDay(view.current[1].t), 'Sep 24');
});

test('missing daily series stays empty', () => {
  const view = growthWindow(undefined, 30);
  assert.deepEqual(view.current, []);
  assert.equal(compareText(view), 'No complete days in this snapshot.');
});
