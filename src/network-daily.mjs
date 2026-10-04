// Daily history for /network/. Points come from timeseries.daily_90d:
// complete UTC days, oldest first, today omitted.
//
// The growth chart is two stacked plots, not one dual axis. A shared plot
// put the running total on the same heights as the daily labels, so a total
// near 500M was read as about 25M.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const GROWTH_WINDOWS = [7, 30, 90];
export const DEFAULT_GROWTH_DAYS = 90;

// Upper plot is the running total. Lower plot is each day, on its own scale.
export const GROWTH_CHART = {
  width: 720,
  height: 372,
  padL: 56,
  padR: 18,
  cumulative: { top: 26, height: 188 },
  daily: { top: 260, height: 72 },
  axisY: 356,
};

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

export function growthWindow(series, days = DEFAULT_GROWTH_DAYS) {
  const windowDays = GROWTH_WINDOWS.includes(days) ? days : DEFAULT_GROWTH_DAYS;
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

export function cumulativeTokens(points) {
  let total = 0;
  return points.map((point) => {
    total += point.tokens;
    return total;
  });
}

export function niceCeil(max) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const n = max / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * base;
}

// Layout for the stacked growth chart. Cumulative y lives entirely above
// daily y, so a daily tick can never sit on the running-total line.
export function growthChartGeometry(dailyValues, cumulativeValues) {
  const dailySeries = Array.isArray(dailyValues) ? dailyValues : [];
  const cumulativeSeries = Array.isArray(cumulativeValues) ? cumulativeValues : [];
  const count = Math.min(dailySeries.length, cumulativeSeries.length);
  const cumulativeMax = niceCeil(count ? Math.max(...cumulativeSeries.slice(0, count)) : 0);
  const dailyMax = niceCeil(count ? Math.max(...dailySeries.slice(0, count)) : 0);
  const { width, height, padL, padR, cumulative, daily, axisY } = GROWTH_CHART;
  const innerW = width - padL - padR;
  const slot = count ? innerW / count : 0;
  const gap = count > 40 ? 2 : 4;
  const barWidth = Math.max(1.5, slot - gap);
  const cumulativeBase = cumulative.top + cumulative.height;
  const dailyBase = daily.top + daily.height;
  const points = [];
  for (let i = 0; i < count; i++) {
    const value = dailySeries[i];
    const total = cumulativeSeries[i];
    const barHeight = dailyMax > 0 ? (value / dailyMax) * daily.height : 0;
    const drawn = Math.max(value > 0 ? 1 : 0, barHeight);
    points.push({
      x: padL + i * slot + slot / 2,
      cumulativeY: cumulativeBase - (cumulativeMax > 0 ? (total / cumulativeMax) * cumulative.height : 0),
      barX: padL + i * slot + (slot - barWidth) / 2,
      barY: dailyBase - drawn,
      barHeight: drawn,
      barWidth,
    });
  }

  const grid = (panel, max) => [0, 1, 2].map((i) => {
    const value = max - (max / 2) * i;
    return {
      y: panel.top + (panel.height / 2) * i,
      value,
      label: formatCompact(value),
    };
  });

  const end = points[count - 1];
  let endLabel = null;
  if (end) {
    const above = end.cumulativeY - 14;
    endLabel = {
      x: end.x - 8,
      y: above >= cumulative.top + 11 ? above : end.cumulativeY + 16,
      anchor: 'end',
      text: formatCompact(cumulativeSeries[count - 1]),
    };
  }

  return {
    width,
    height,
    padL,
    padR,
    axisY,
    cumulative,
    daily,
    cumulativeMax,
    dailyMax,
    cumulativeBase,
    dailyBase,
    points,
    cumulativeGrid: grid(cumulative, cumulativeMax),
    dailyGrid: grid(daily, dailyMax),
    endLabel,
  };
}

// A 90-day view usually has no earlier 90-day window. The recent 30-vs-30
// pace is still in the series, and it is the growth comparison worth showing.
function inWindowPace(points) {
  if (points.length < 60) return '';
  const recent = points.slice(-30);
  const before = points.slice(-60, -30);
  const currentSum = sumTokens(recent);
  const priorSum = sumTokens(before);
  const delta = currentSum - priorSum;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  if (priorSum === 0) {
    return currentSum > 0
      ? 'Last 30 of these days · +' + formatCompact(currentSum) + ' tokens'
      : '';
  }
  const multiple = currentSum / priorSum;
  const multipleText = multiple.toLocaleString('en-US', {
    minimumFractionDigits: multiple < 10 ? 1 : 0,
    maximumFractionDigits: multiple < 10 ? 1 : 0,
  });
  return 'Last 30 of these days · ' + multipleText + '× the 30 before · ' + sign + formatCompact(Math.abs(delta)) + ' tokens';
}

export function compareText(view) {
  const days = view.windowDays;
  const dayLabel = days === 1 ? 'day' : 'days';
  const count = view.current.length;
  if (!count) return 'No complete days in this snapshot.';
  if (!view.comparable) {
    const pace = inWindowPace(view.current);
    if (pace) return pace;
    const noun = count === 1 ? 'day' : 'days';
    return count + ' complete UTC ' + noun + '. No full earlier ' + days + '-day window to compare.';
  }
  const currentSum = sumTokens(view.current);
  const priorSum = sumTokens(view.prior);
  const delta = currentSum - priorSum;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  if (priorSum === 0) {
    return currentSum > 0
      ? 'New activity · +' + formatCompact(currentSum) + ' tokens'
      : 'No token activity in either ' + days + '-' + dayLabel + ' window.';
  }
  const multiple = currentSum / priorSum;
  const multipleText = multiple.toLocaleString('en-US', {
    minimumFractionDigits: multiple < 10 ? 1 : 0,
    maximumFractionDigits: multiple < 10 ? 1 : 0,
  });
  return multipleText + '× the prior ' + days + ' ' + dayLabel + ' · ' + sign + formatCompact(Math.abs(delta)) + ' tokens';
}
