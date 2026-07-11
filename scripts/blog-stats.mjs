#!/usr/bin/env node
/**
 * Fetch the current, REAL Malibu network numbers for use in blog posts.
 *
 * The blog's honesty rule is absolute: never invent or inflate network stats.
 * Run `npm run blog:stats` and cite only what this prints. It reads the public
 * malibu.tech proxy (never a streamvc.live URL), so nothing internal leaks into
 * content, and it deliberately surfaces how SMALL the network is today so posts
 * stay truthful about scale.
 *
 * Usage:
 *   npm run blog:stats            # human-readable summary + freshness
 *   npm run blog:stats -- --json  # raw network JSON only (for piping)
 */
const ENDPOINT = 'https://malibu.tech/v1/stats/overview';
const jsonOnly = process.argv.includes('--json');

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n));

async function main() {
  let payload;
  try {
    const res = await fetch(ENDPOINT, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    console.error(`blog-stats: could not reach ${ENDPOINT} — ${err.message}`);
    console.error('Do NOT guess numbers. Skip data-backed claims or try again later.');
    process.exit(1);
  }

  const n = payload.network || {};
  if (jsonOnly) {
    process.stdout.write(JSON.stringify(n, null, 2) + '\n');
    return;
  }

  const gen = payload.generated_at || 'unknown';
  const rows = [
    ['Nodes online', fmt(n.nodes_online)],
    ['Models serving', fmt(n.models_serving)],
    ['Requests served (total)', fmt(n.requests_total)],
    ['Tokens served (total)', fmt(n.tokens_served_total)],
    ['  · input tokens', fmt(n.tokens_in_total)],
    ['  · output tokens', fmt(n.tokens_out_total)],
    ['Avg tokens / request', fmt(n.avg_tokens_per_request)],
    ['Unified RAM (GB, total)', fmt(n.unified_ram_gb_total)],
    ['GPU cores (total)', fmt(n.gpu_cores_total)],
    ['CPU cores (total)', fmt(n.cpu_cores_total)],
    ['Network power (kW)', fmt(n.network_power_kw)],
    ['Utilization (%)', fmt(n.network_utilization_pct)],
  ];
  const width = Math.max(...rows.map((r) => r[0].length));

  console.log(`\nMalibu network — live snapshot (generated ${gen})`);
  console.log('Source: ' + ENDPOINT + '\n');
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(width)}   ${value}`);
  }

  const nodes = Number(n.nodes_online) || 0;
  console.log('\nHonesty guardrail:');
  if (nodes <= 5) {
    console.log(
      `  The network is EARLY (${fmt(n.nodes_online)} node(s) online). Do NOT imply scale it\n` +
        '  does not have. Frame the thesis (200M idle Macs) as the OPPORTUNITY, and any\n' +
        '  live number as proof the mechanism works today — not proof of size.',
    );
  } else {
    console.log('  Cite these figures verbatim. Do not round up or extrapolate.');
  }
  console.log('');
}

main();
