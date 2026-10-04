import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareText,
  cumulativeTokens,
  DEFAULT_GROWTH_DAYS,
  formatCompact,
  formatDay,
  growthChartGeometry,
  growthWindow,
  sumTokens,
} from '../src/network-daily.mjs';

function day(t, tokens, requests = 1) {
  return { t, requests, input_tokens: tokens, output_tokens: 0 };
}

test('90-day window is the default and shows the recent pace when no earlier 90 days exist', () => {
  const points = Array.from({ length: 90 }, (_, i) => day('2026-06-' + String((i % 28) + 1).padStart(2, '0'), 1000 * (i + 1)));
  const view = growthWindow({ bucket: '1d', points });
  assert.equal(DEFAULT_GROWTH_DAYS, 90);
  assert.equal(view.windowDays, 90);
  assert.equal(view.current.length, 90);
  assert.equal(view.comparable, false);
  assert.equal(compareText(view), 'Last 30 of these days · 1.7× the 30 before · +900,000 tokens');
  assert.equal(compareText(view).includes('sample'), false);
});

test('a short 90-day request does not invent a 30-day pace', () => {
  const points = Array.from({ length: 40 }, (_, i) => day('2026-08-' + String((i % 28) + 1).padStart(2, '0'), 1000));
  const view = growthWindow({ points }, 90);
  assert.equal(view.current.length, 40);
  assert.equal(view.comparable, false);
  assert.equal(compareText(view), '40 complete UTC days. No full earlier 90-day window to compare.');
});

test('30-day window compares the previous 30 complete days', () => {
  const points = Array.from({ length: 60 }, (_, i) => day('2026-07-' + String((i % 28) + 1).padStart(2, '0'), i < 30 ? 1_000_000 : 2_000_000));
  const view = growthWindow({ points }, 30);
  assert.equal(view.current.length, 30);
  assert.equal(view.comparable, true);
  assert.equal(sumTokens(view.current), 60_000_000);
  assert.equal(sumTokens(view.prior), 30_000_000);
  assert.equal(compareText(view), '2.0× the prior 30 days · +30M tokens');
  assert.deepEqual(cumulativeTokens(view.current).slice(-3), [56_000_000, 58_000_000, 60_000_000]);
});

test('cumulative totals preserve plateaus and end at the selected-period total', () => {
  const points = growthWindow({
    points: [day('2026-09-27', 5), day('2026-09-28', 0), day('2026-09-29', 7)],
  }, 7).current;
  assert.deepEqual(cumulativeTokens(points), [5, 5, 12]);
  assert.equal(cumulativeTokens(points).at(-1), sumTokens(points));
});

test('comparison copy tells the growth multiple without an inflated percentage', () => {
  const points = [];
  for (let i = 1; i <= 60; i += 1) {
    const date = new Date(Date.UTC(2026, 6, i));
    points.push(day(date.toISOString().slice(0, 10), i <= 30 ? 1_000_000 : 16_000_000));
  }
  const view = growthWindow({
    points,
  }, 30);
  assert.equal(compareText(view), '16× the prior 30 days · +450M tokens');
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

test('the running total and each day use separate vertical scales', () => {
  const daily = [
    ...Array.from({ length: 60 }, () => 1_300_000),
    ...Array.from({ length: 30 }, (_, i) => 10_000_000 + i * 1_000_000),
  ];
  const cumulative = cumulativeTokens(daily.map((tokens) => ({ tokens })));
  const geo = growthChartGeometry(daily, cumulative);
  const total = cumulative.at(-1);

  assert.equal(total, 813_000_000);
  assert.equal(geo.cumulativeMax, 1_000_000_000);
  assert.equal(geo.dailyMax, 50_000_000);
  assert.ok(geo.daily.top > geo.cumulative.top + geo.cumulative.height);

  const end = geo.points.at(-1);
  const cumulativeMid = geo.cumulative.top + geo.cumulative.height / 2;
  assert.ok(end.cumulativeY < cumulativeMid);
  assert.equal(geo.endLabel.text, formatCompact(total));
  assert.ok(geo.endLabel.y < geo.daily.top);
  assert.ok(geo.dailyGrid[0].y > geo.cumulative.top + geo.cumulative.height);
  assert.ok(Math.abs(end.cumulativeY - geo.dailyGrid[1].y) > geo.daily.height);

  for (const point of geo.points) {
    assert.ok(point.cumulativeY >= geo.cumulative.top - 0.01);
    assert.ok(point.cumulativeY <= geo.cumulative.top + geo.cumulative.height + 0.01);
    assert.ok(point.barY >= geo.daily.top - 0.01);
    assert.ok(point.barY + point.barHeight <= geo.daily.top + geo.daily.height + 0.01);
  }
});
