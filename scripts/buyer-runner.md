# Buyer runner

Keeps the [/network](https://www.malibu.tech/network/) dashboard showing live
activity by sending real chat-completions requests to the gateway on a
schedule. This is real traffic — every request is billed and settled like any
buyer request — not synthetic/mock data. Run it at a rate you're comfortable
paying for.

## Endpoint

The live gateway is **`https://api.streamvc.live/v1`** (verified: OpenAI-shape,
Bearer auth). The branded `api.malibu.tech` host is **not in DNS yet** — the
script defaults to `api.streamvc.live` and will need `MALIBU_API_BASE` updated
once the branded hostname is cut over. The buyer API key lives in the
`macprovider` repo and is minted against this gateway.

The script auto-discovers which models the pool is actually serving from
`GET /v1/models` at startup (biasing toward the smallest weights to stay cheap),
so it stays correct as the catalog changes — no hardcoded model IDs to go stale.

## Setup

1. Create `.env.local` in the repo root (gitignored, never committed). Copy the
   buyer key from the `macprovider` repo:

   ```
   MALIBU_API_KEY=<buyer key from macprovider>
   # Optional — only if the gateway host changes:
   # MALIBU_API_BASE=https://api.streamvc.live/v1
   ```

2. Test it once manually:

   ```
   node scripts/buyer-runner.mjs
   ```

   You should see one log line per request, e.g.:

   ```
   [buyer-runner] mlx-community/Qwen2.5-7B-Instruct-4bit served_by=provider-air5 tokens=142 (in=22 out=120) 812ms
   ```

## Deployed schedule (launchd)

Installed as a macOS LaunchAgent: **every 2 minutes, 3 staggered requests per
run**, which keeps the 30-minute `rpm_30m` / `tpm_30m` windows on `/network`
continuously populated. The agent reads `MALIBU_API_KEY` from `.env.local`, so
the secret never lives in the plist.

- Plist: `~/Library/LaunchAgents/tech.malibu.buyer-runner.plist`
- Log:   `~/Library/Logs/malibu-buyer-runner.log`

Manage it:

```bash
# status (shows PID/last-exit)
launchctl list | grep buyer-runner

# run once now (don't wait for the interval)
launchctl kickstart -k gui/$(id -u)/tech.malibu.buyer-runner

# stop it
launchctl bootout gui/$(id -u)/tech.malibu.buyer-runner

# start it again after editing the plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/tech.malibu.buyer-runner.plist

# tail the log
tail -f ~/Library/Logs/malibu-buyer-runner.log
```

The plist is NOT in the repo (it lives under `~/Library/LaunchAgents`). To
recreate it on another machine, copy the block below and adjust the node path
(`which node`) and repo path:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>tech.malibu.buyer-runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/augstar/projects/malibu/scripts/buyer-runner.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/augstar/projects/malibu</string>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><false/>
  <key>EnvironmentVariables</key>
  <dict><key>BUYER_RUNNER_REQUESTS</key><string>3</string></dict>
  <key>StandardOutPath</key><string>/Users/augstar/Library/Logs/malibu-buyer-runner.log</string>
  <key>StandardErrorPath</key><string>/Users/augstar/Library/Logs/malibu-buyer-runner.log</string>
  <key>ThrottleInterval</key><integer>120</integer>
</dict>
</plist>
```

## Tuning

- `BUYER_RUNNER_REQUESTS` — requests per invocation (default 3; set in the plist).
- `BUYER_RUNNER_MAX_TOKENS` — cap on completion length per request (default 120).
- `MALIBU_API_BASE` — override the gateway base URL (default `https://api.streamvc.live/v1`).
- Cadence lives in the plist `StartInterval` (currently 120s). Lower it or raise
  `BUYER_RUNNER_REQUESTS` for more visible activity; raise it to spend less.

The log is a single growing file; rotate or truncate it periodically if it gets
large (`: > ~/Library/Logs/malibu-buyer-runner.log`).

## Notes

- On a busy pool a single model can return `503 no_provider_available`; the
  runner automatically rolls the request over to another served model so a
  minute-bucket doesn't end up empty.
- `/network` counts only settled, non-quarantined requests from authenticated
  providers, read through the coordinator's billing rollup (see
  [macprovider#607](https://github.com/Augustas11/macprovider/issues/607)).
  Traffic surfaces on the dashboard with a ~1–2 minute rollup lag.
