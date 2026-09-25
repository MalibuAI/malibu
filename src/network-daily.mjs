// Daily bars for /network/. Points come from timeseries.daily_90d:
// complete UTC days, oldest first, today omitted.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const GROWTH_WINDOWS = [7, 30, 90];

export function formatCompact(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  const abs = Math.abs(num);
  const trim = (v) => v.toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e12) return trim(num / 1e12) + 'T';
  if (abs >= 1e9) return trim(num / 1e9) + 'B';
  if (abs >= 1e6) return trim(num / 1e6) + 'M';
  if (abs >= 1e4) return Math.round(num).toLocaleString('en-US');
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatDay(iso) {
  if (typeof iso !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return month + ' ' + Number(match[3]);
}

function finiteCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function normalizeDailyPoints(series) {
  const points = series && Array.isArray(series.points) ? series.points : [];
  const out = [];
  for (const point of points) {
    if (!point || typeof point.t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(point.t)) continue;
    const input = finiteCount(point.input_tokens);
    const output = finiteCount(point.output_tokens);
    const requests = finiteCount(point.requests);
    if (input == null || output == null || requests == null) continue;
    out.push({ t: point.t, requests, tokens: input + output });
  }
  return out;
}

export function growthWindow(series, days) {
  const windowDays = GROWTH_WINDOWS.includes(days) ? days : 30;
  const points = normalizeDailyPoints(series);
  const current = points.slice(-windowDays);
  const prior = points.slice(-windowDays * 2, -windowDays);
  return {
    windowDays,
    current,
    prior,
    comparable: current.length === windowDays && prior.length === windowDays,
  };
}

export function sumTokens(points) {
  return points.reduce((acc, point) => acc + point.tokens, 0);
}

export function rollingAverage(values, size = 7) {
  return values.map((_, i) => {
    const start = Math.max(0, i - (size - 1));
    const slice = values.slice(start, i + 1);
    const total = slice.reduce((acc, n) => acc + n, 0);
    return total / slice.length;
  });
}

export function compareText(view) {
  const days = view.windowDays;
  const count = view.current.length;
  if (!count) return 'No complete days in this snapshot.';
  if (!view.comparable) {
    const noun = count === 1 ? 'day' : 'days';
    return count + ' complete UTC ' + noun + '. No full earlier ' + days + '-day window to compare.';
  }
  const currentSum = sumTokens(view.current);
  const priorSum = sumTokens(view.prior);
  const delta = currentSum - priorSum;
  const pct = priorSum > 0 ? (delta / priorSum) * 100 : null;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const pctText = pct == null ? '' : sign + Math.abs(pct).toFixed(0) + '% · ';
  return 'vs prior ' + days + ' days: ' + pctText + sign + formatCompact(Math.abs(delta)) + ' tokens';
}
