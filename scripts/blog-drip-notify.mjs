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
 * Reads:  .drip/result.json  (title, reason, thesis — for message detail only)
 * Env:    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   (required to actually send)
 *         DRIP_OUTCOME  = post | skip | failed
 *         DRIP_PR_URL   = the draft PR URL (required for a "post" to count)
 *         DRIP_ALSO_EDITED = comma-separated files changed besides the new post
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

function buildMessage() {
  const result = readResult();
  const { outcome, prUrl } = resolveOutcome();
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

  if (outcome === 'post') {
    const title = result?.title || 'Untitled draft';
    const thesis = result?.thesis ? `\n${result.thesis}\n` : '\n';
    const edited = alsoEdited.length
      ? `\n⚠ Also edited existing file(s): ${alsoEdited.join(', ')} — review these too.\n`
      : '';
    return (
      `🌴 Malibu blog — draft ready for review\n\n` +
      `“${title}”\n${thesis}${prUrl}\n${edited}\n` +
      `Draft PR, not merged. Review against CLAUDE.md §5/§6 and merge if it clears the bar.${runwayLine}${telemLine}`
    );
  }
  if (outcome === 'skip') {
    const reason = result?.reason || 'nothing cleared the quality bar';
    return `🌴 Malibu blog — no post today.\n\nReason: ${reason}${runwayLine}${telemLine}`;
  }
  return (
    `⚠️ Malibu blog drip — run did NOT complete.\n\n` +
    `No draft PR was opened. Check the GitHub Actions log — do not assume a post exists.${telemLine}`
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
