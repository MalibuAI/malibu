# Blog topic backlog

Seed queue for the SEO content routine. Each row is a genuine, non-commodity
topic with a real Malibu angle and a path to real data. Pick the highest-priority
unclaimed row that clears the §1 gate in `blog/CLAUDE.md`; if none does, research
a fresh angle (WebSearch for current-month trends) or ship nothing.

**Before picking:** check `blog/posts/` and open PRs so you don't duplicate a
published or in-flight post. When you ship one, set Status to `published` here in
the same PR. `idea` = open, `drafting` = a PR is in flight, `published` = live.

**Priority** reflects a mix of search intent and how strongly the topic leans on a
Malibu-only angle (receipts, mining=serving, per-watt honesty, idle-Mac economics).
Prefer High rows first. `⚑` = needs extra review before shipping; see notes.

| Priority | Status | Working title | Search intent / primary keyword | Malibu-only angle | Data / sources |
|---|---|---|---|---|---|
| High | drafting | The signed receipt your inference API doesn't ship | "verifiable AI inference", "how do I know which model served my request" | Signed Ed25519 receipt on every response; `malibu-verify`; TOPLOC. Malibu's sharpest differentiator | Litepaper, TOPLOC paper (WebFetch), receipt field list |
| High | idea | Why every decentralized-compute network stalled, and the one change that unlocks it | "decentralized AI compute", "why decentralized GPU failed" | The bootstrap wall; "mining state is serving state" as the fix | Manifesto; competitor post-mortems (WebFetch) ⚑ |
| High | idea | Apple Silicon vs datacenter GPUs for inference, per watt | "apple silicon vs GPU inference", "M-series inference efficiency" | The per-watt efficiency story, honestly benchmarked — where Macs win and where they don't | Primary benchmarks (WebFetch); verify every number before asserting |
| High | idea | Can a Mac run large language models? | "run LLM on Mac", "apple silicon LLM inference" | Unified memory + MLX make M-series genuinely good at serving 100B+ open models; Malibu turns that into paid capacity | `blog:stats`, MLX docs, model cards |
| Med | idea | The datacenter wall: why AI compute can't just be built | "AI datacenter energy", "GPU shortage inference" | Permitting/grid queues past 2030 vs 200M idle Macs already deployed | WebFetch grid-interconnect + datacenter reporting |
| Med | idea | Switching off the OpenAI API without changing your code | "OpenAI compatible API", "drop-in OpenAI replacement" | `api.malibu.tech` is OpenAI-compatible: streaming, tools, JSON schema — change one URL | Manifesto curl example, docs |
| Med | idea | Cutting AI inference cost without trusting your provider | "reduce AI inference cost", "cheaper OpenAI alternative" | Open-source frontier on idle Macs, *verifiable*, USDC settlement, base-URL swap. Lead with verifiability, not just price | OpenRouter pricing (WebFetch), `blog:stats` |
| Med | idea | What "live today" means: reading the Malibu network snapshot | "malibu network stats", brand/navigational | Transparent, real-time numbers — even when small — as a trust signal | `blog:stats` (the honest, live-data post; bump `updated` as numbers move) |
| Med | idea | Turn your Mac into paid inference capacity: how hosting works | "use my Mac for AI compute", "run an inference node on Mac" | One-command install, cooperative scheduling, weekly USDC for compute provided | `/host/`, litepaper economics ⚑ |
| Low | idea | The verifiable open-model catalog: not just wide, but auditable | "run gpt-oss", "host Qwen3", "open source model serving" | Reframe away from a generic "run model X" listicle: what's served AND that every response is receipt-verifiable | Model cards (WebFetch), catalog |
| Low | idea | Buyer's guide: running a 235B open model you can actually audit | "run Qwen3-235B", "large open model API" | Cost *and* verifiability comparison vs closed APIs — the auditability is the hook, not the price | `blog:stats`, OpenRouter (WebFetch) |

## Notes

- **⚑ Row "Why every decentralized-compute network stalled"** names real
  competitors (Bittensor, Akash, Gensyn, Prime Intellect, io.net, Render). Per
  `CLAUDE.md` §5, every characterization of a named competitor's failure needs a
  specific primary source — do not assert motive or blanket failure unsourced.
- **⚑ Row "Turn your Mac into paid inference capacity"** is the highest financial-
  framing risk. Per `CLAUDE.md` §5, describe payouts as compensation for compute,
  never as investment/yield/passive income. Give this one extra review.
- Prioritize the differentiated topics (verifiable receipts, mining=serving,
  per-watt honesty) over commodity explainers — they rank on expertise, not volume.
- Any benchmark or market figure needs a linked primary source before it ships.
  Working titles here are provisional; do not bake an unverified number or
  superlative into a published headline.
- Network numbers come only from `npm run blog:stats`.
- USDC-on-Base payment mechanics can support a post but are a thin standalone
  topic; fold them into the hosting/payout story rather than a generic
  crypto-payments explainer.
