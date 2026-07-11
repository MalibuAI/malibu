#!/usr/bin/env node
/**
 * Report the blog-drip outcome to Telegram. Runs as a deterministic workflow
 * step AFTER the routine, so the bot token never enters the model's context.
 *
 * FAIL-CLOSED: the outcome comes only from DRIP_OUTCOME (set fail-closed by the
 * assemble step) — never inferred from a stale result.json. A "post" without a
 * real PR URL is downgraded to "failed", so a build/publish failure can never be
 * announced as a ready draft.
 *
 * Reads:  .drip/result.json  (title, reason, thesis, topic_hint_used — detail only)
 * Env:    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   (required to actually send)
 *         DRIP_OUTCOME  = post | skip | failed | dormant | alert
 *         DRIP_PR_URL   = the draft PR URL (required for a "post" to count)
 *         DRIP_ALSO_EDITED = comma-separated files changed besides the new post
 *         DRIP_RUNWAY   = idea count remaining
 *         DRIP_SALVAGE_URL = artifact URL when a failed run salvaged a draft
 *         DRIP_COST / DRIP_TURNS / DRIP_DURATION = run telemetry
 *         DRIP_MAX_TURNS / DRIP_TIMEOUT_S = caps, to flag near-limit runs
 *         DRIP_PRIOR_FAILURES = consecutive prior failed runs (for escalation)
 *         DRIP_ALERT_MSG = full message body for outcome=alert (liveness check)
 *         DRIP_DRY_RUN  = 1  → print instead of sending (local tests)
 *         GITHUB_STEP_SUMMARY = path (Actions) → outcome always written here too
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const RESULT = '.drip/result.json';

function readResult() {
  try {
    if (existsSync(RESULT)) return JSON.parse(readFileSync(RESULT, 'utf8'));
  } catch {
    /* ignore */
  }
  return null;
}

function resolveOutcome() {
  let outcome = process.env.DRIP_OUTCOME || 'failed';
  const prUrl = process.env.DRIP_PR_URL || '';
  // A post is only real if a PR was actually opened.
  if (outcome === 'post' && !prUrl) outcome = 'failed';
  return { outcome, prUrl };
}

const intEnv = (name) => {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : null;
};

// Flag a run that brushed the turn or time cap, so a near-runaway looks
// different from a comfortable run instead of being an identical number.
function nearCapLine() {
  const flags = [];
  const turns = intEnv('DRIP_TURNS');
  const maxTurns = intEnv('DRIP_MAX_TURNS');
  if (turns !== null && maxTurns && turns >= 0.9 * maxTurns) flags.push(`turns ${turns}/${maxTurns}`);
  const durMatch = /^(\d+)s$/.exec(process.env.DRIP_DURATION || '');
  const timeoutS = intEnv('DRIP_TIMEOUT_S');
  if (durMatch && timeoutS && Number(durMatch[1]) >= 0.9 * timeoutS) {
    flags.push(`duration ${durMatch[1]}s/${timeoutS}s`);
  }
  return flags.length
    ? `\n⚠ Near limits: ${flags.join(', ')} — raise the cap or narrow scope.`
    : '';
}

function buildMessage() {
  const result = readResult();
  const { outcome, prUrl } = resolveOutcome();

  // Liveness check sends a fully-formed message.
  if (outcome === 'alert') {
    return process.env.DRIP_ALERT_MSG || '⚠️ Malibu blog drip — liveness alert.';
  }

  const alsoEdited = (process.env.DRIP_ALSO_EDITED || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const runway = process.env.DRIP_RUNWAY;
  const runwayLine =
    runway && /^\d+$/.test(runway) ? `\nBacklog: ${runway} idea(s) remaining.` : '';

  const telem = [
    process.env.DRIP_TURNS && process.env.DRIP_TURNS !== 'n/a' ? `${process.env.DRIP_TURNS} turns` : null,
    process.env.DRIP_DURATION && process.env.DRIP_DURATION !== 'n/a' ? process.env.DRIP_DURATION : null,
    process.env.DRIP_COST && process.env.DRIP_COST !== 'n/a' ? process.env.DRIP_COST : null,
  ].filter(Boolean);
  const telemLine = telem.length ? `\nRun: ${telem.join(' · ')}` : '';
  const nearCap = nearCapLine();

  // Whether a manual topic hint was honored (routine only sets this when a hint
  // was actually given).
  const topicLine =
    typeof result?.topic_hint_used === 'boolean'
      ? `\nTopic hint: ${result.topic_hint_used ? 'used' : 'not used (a stronger angle cleared the bar)'}.`
      : '';

  if (outcome === 'post') {
    const title = result?.title || 'Untitled draft';
    const thesis = result?.thesis ? `\n${result.thesis}\n` : '\n';
    const edited = alsoEdited.length
      ? `\n⚠ Also edited existing file(s): ${alsoEdited.join(', ')} — review these too.\n`
      : '';
    return (
      `🌴 Malibu blog — draft ready for review\n\n` +
      `“${title}”\n${thesis}${prUrl}\n${edited}\n` +
      `Draft PR, not merged. Review against CLAUDE.md §5/§6 and merge if it clears the bar.${runwayLine}${topicLine}${telemLine}${nearCap}`
    );
  }
  if (outcome === 'skip') {
    const reason = result?.reason || 'nothing cleared the quality bar';
    return `🌴 Malibu blog — no post today.\n\nReason: ${reason}${runwayLine}${topicLine}${telemLine}${nearCap}`;
  }
  if (outcome === 'dormant') {
    return (
      `🌴 Malibu blog drip is DORMANT.\n\n` +
      `ANTHROPIC_API_KEY is not set, so no posts will be produced. ` +
      `If you didn't expect this, the key may have been removed or revoked — the drip has stopped working.`
    );
  }
  // failed — escalate wording when it's a repeated failure.
  const streak = (intEnv('DRIP_PRIOR_FAILURES') ?? 0) + 1;
  const header =
    streak >= 3
      ? `🚨 Malibu blog drip — FAILED ${streak} runs in a row. This needs a human.`
      : `⚠️ Malibu blog drip — run did NOT complete.`;
  const salvage = process.env.DRIP_SALVAGE_URL
    ? `\n\nA partial draft may be recoverable from the run's artifacts:\n${process.env.DRIP_SALVAGE_URL}`
    : '';
  return (
    `${header}\n\n` +
    `No draft PR was opened. Check the GitHub Actions log — do not assume a post exists.${salvage}${telemLine}${nearCap}`
  );
}

function writeSummary(text) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  try {
    appendFileSync(path, `### Blog drip result\n\n\`\`\`\n${text}\n\`\`\`\n`);
  } catch {
    /* best effort */
  }
}

async function main() {
  const text = buildMessage();
  writeSummary(text); // durable, visible even if Telegram is down
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (process.env.DRIP_DRY_RUN === '1' || !token || !chatId) {
    if (!process.env.DRIP_DRY_RUN) {
      console.error('blog-drip-notify: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — printing only.');
    }
    console.log('--- Telegram message (not sent) ---\n' + text);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Do NOT fail the run — the PR (if any) already exists; the summary carries it.
      console.error(`blog-drip-notify: Telegram API ${res.status} — ${body.slice(0, 300)}`);
      writeSummary(`Telegram delivery FAILED (${res.status}). Message above was not delivered.`);
      return;
    }
    console.log('blog-drip-notify: sent.');
  } catch (err) {
    console.error(`blog-drip-notify: Telegram send error — ${err.message}`);
    writeSummary(`Telegram delivery errored (${err.message}). Message above was not delivered.`);
  }
}

main();
