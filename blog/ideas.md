# Blog topic backlog

Seed queue for the SEO content routine. Each row is a genuine, non-commodity
topic with a real Malibu angle and a path to real data. Pick the highest-value
unclaimed row that clears the bar in section 0 of `blog/CLAUDE.md`; if none does,
research a fresh angle (WebSearch for current-month trends) or ship nothing.

**Before picking:** check `blog/posts/` and open PRs so you don't duplicate a
published or in-flight post. When you ship one, set Status to `published` here in
the same PR. `idea` = open, `drafting` = a PR is in flight, `published` = live.

| Status | Working title | Search intent / primary keyword | Malibu angle | Data / sources |
|---|---|---|---|---|
| idea | Can a Mac run large language models? | "run LLM on Mac", "apple silicon LLM inference" | Unified memory + MLX make M-series genuinely good at serving 100B+ open models; Malibu turns that into paid capacity | `blog:stats` (RAM/cores/tokens), MLX docs, model cards |
| idea | What a verifiable inference receipt is (and why your API doesn't have one) | "verifiable AI inference", "how do I know which model served my request" | Signed Ed25519 receipt on every response; `malibu-verify`; TOPLOC. This is Malibu's sharpest differentiator | Litepaper, TOPLOC paper (WebFetch), receipt field list |
| idea | How to cut AI inference costs 20–40% without trusting anyone | "reduce AI inference cost", "cheaper OpenAI alternative" | Open-source frontier on idle Macs, verifiable, USDC settlement, base-URL swap | OpenRouter pricing (WebFetch), `blog:stats` |
| idea | Switching off the OpenAI API without changing your code | "OpenAI compatible API", "drop-in OpenAI replacement" | `api.malibu.tech` is OpenAI-compatible: streaming, tools, JSON schema. Change one URL | Manifesto curl example, docs |
| idea | The datacenter wall: why AI compute can't just be built | "AI datacenter energy", "GPU shortage inference" | Permitting/grid queues past 2030 vs 200M idle Macs already deployed | WebFetch grid-interconnect + datacenter reporting |
| idea | Make your Mac earn while it sleeps: how host payouts work | "make money with your Mac", "idle Mac compute income" | One-command install, cooperative scheduling, weekly USDC, 90% provider share | `/host/`, litepaper economics |
| idea | Running gpt-oss, Qwen3, and Llama without your own GPU | "run gpt-oss", "host Qwen3", "open source model serving" | The served catalog + why open weights finally match closed quality | Model cards (WebFetch), catalog |
| idea | Apple Silicon vs datacenter GPUs for inference, per watt | "apple silicon vs GPU inference", "M-series inference efficiency" | Per-watt efficiency claim, honestly benchmarked; where Macs win and don't | Primary benchmarks (WebFetch) — verify before asserting |
| idea | Why every decentralized-compute network stalled, and the one change that unlocks it | "decentralized AI compute", "why decentralized GPU failed" | The bootstrap wall; "mining state is serving state" as the fix | Manifesto, competitor post-mortems (WebFetch) |
| idea | Settling compute in stablecoins: USDC on Base for global payouts | "pay for compute with crypto", "USDC micropayments" | Sub-cent, seconds, 100+ countries, no payroll dept | Base/USDC docs (WebFetch) |
| idea | Buyer's guide: the cheapest honest way to run a 235B open model | "run Qwen3-235B", "cheapest large model API" | Cost + verifiability comparison table vs closed APIs | `blog:stats`, OpenRouter (WebFetch) |
| idea | What "live today" means: reading the Malibu network snapshot | "malibu network stats", brand/navigational | Transparent, real-time numbers — even when small — as a trust signal | `blog:stats` (this is the honest, live-data post) |

## Notes

- Prioritize the differentiated topics (verifiable receipts, mining=serving,
  per-watt honesty) over commodity explainers — they rank on expertise, not volume.
- Any benchmark or market figure needs a linked primary source before it ships.
- Network numbers come only from `npm run blog:stats`.
