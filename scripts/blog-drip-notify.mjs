#!/usr/bin/env node
/**
 * Send the blog-drip outcome to Telegram. Runs as a deterministic workflow step
 * AFTER the routine, so the bot token never enters the model's context.
 *
 * Reads:  .drip/result.json  ({action, title, reason, slug})
 * Env:    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (required to actually send)
 *         DRIP_OUTCOME  = post | skip | failed  (from the assemble step)
 *         DRIP_PR_URL   = the draft PR URL (when outcome=post)
 *         DRIP_DRY_RUN  = 1  → print the message instead of sending (for local tests)
 */
import { readFileSync, existsSync } from 'node:fs';

const RESULT = '.drip/result.json';

function readResult() {
  try {
    if (existsSync(RESULT)) return JSON.parse(readFileSync(RESULT, 'utf8'));
  } catch {
    /* fall through to null */
  }
  return null;
}

function buildMessage() {
  const result = readResult();
  const outcome = process.env.DRIP_OUTCOME || result?.action || (result ? 'post' : 'failed');
  const prUrl = process.env.DRIP_PR_URL || '';

  if (outcome === 'post') {
    const title = result?.title || 'Untitled draft';
    return (
      `🌴 Malibu blog — draft ready for review\n\n` +
      `“${title}”\n` +
      (prUrl ? `${prUrl}\n\n` : '\n') +
      `Draft PR, not merged. Review and merge if it clears the bar.`
    );
  }
  if (outcome === 'skip') {
    const reason = result?.reason || 'nothing cleared the quality bar';
    return `🌴 Malibu blog — no post today.\n\nReason: ${reason}`;
  }
  return (
    `⚠️ Malibu blog drip — run did not complete.\n\n` +
    `No usable result was produced. Check the GitHub Actions log.`
  );
}

async function main() {
  const text = buildMessage();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (process.env.DRIP_DRY_RUN === '1' || !token || !chatId) {
    if (!process.env.DRIP_DRY_RUN) {
      console.error('blog-drip-notify: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — printing only.');
    }
    console.log('--- Telegram message (not sent) ---\n' + text);
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`blog-drip-notify: Telegram API ${res.status} — ${body.slice(0, 300)}`);
    process.exit(1);
  }
  console.log('blog-drip-notify: sent.');
}

main().catch((err) => {
  console.error(`blog-drip-notify: ${err.message}`);
  process.exit(1);
});
