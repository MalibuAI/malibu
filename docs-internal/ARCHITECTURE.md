# Malibu documentation architecture

**Published site:** [malibu.tech/docs](https://www.malibu.tech/docs)  
**Mintlify source:** [`docs/`](../docs/) (`docs.json` + MDX pages)  
**Production:** Vercel static export → `dist/docs/` (see `scripts/build-docs.mjs`)  
**Last updated:** 23 September 2026

This document defines how Malibu docs are organized, what each lane is for, and how to keep the Litepaper ambitious without letting it impersonate the shipped-features ledger.

---

## One-line positioning

> **Litepaper is the front door; reference is the manual; network status is the ledger.**

Visitors open `/docs` to understand **what Malibu is about** — not to read a journal of shipped code. Integration detail and live/planned truth live in separate lanes, linked from the Litepaper when needed.

---

## Three registers (do not merge)

| Register | Job | Tone | Default entry? |
|----------|-----|------|----------------|
| **Narrative** | Why Malibu exists, who it is for, the architectural bet | Vision, ambition, story | **Yes** — Litepaper |
| **Reference** | How to integrate; API shapes; trust boundaries; ops runbooks | Precise, falsifiable, copy-pasteable | No — sidebar |
| **Ledger** | What runs today vs what is planned; changelog; roadmap dates | Factual, dated, auditable | No — linked from Litepaper |

**Rule:** Narrative may cite live and planned features in one arc. Reference and ledger must never blur them without explicit status labels.

---

## Information architecture

```
/docs                          → Litepaper (default opening page)
/docs/getting-started/...      → integration path (buyers + providers)
/docs/api/...                  → API reference
/docs/network/...              → architecture, trust, billing, transport
/docs/guides/...               → task-oriented how-tos
/docs/cli/...                  → provider CLI (malibu-cli) + receipt verifier (macprovider-verify)
/docs/agentic/...              → tool calling, structured output, buyer validation
/docs/operations/...           → catalog, settlement, network stats (operator)
/docs/status                   → shipped vs planned ledger
/docs/roadmap                  → milestone timeline
/docs/changelog                → API + docs changelog
```

`llms.txt` should continue to list Litepaper first. Do not relocate Litepaper to `/vision` or demote it below Getting Started.

### Lane diagram

```
┌─────────────────────────────────────────────────────────────┐
│  /docs  —  Litepaper (opening)                            │
│  Why · opportunity · bet · economics vision · join          │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
    ┌───────────▼──────────┐   ┌──────────▼─────────┐
    │  Reference lane       │   │  Ledger lane        │
    │  (sidebar)            │   │  (linked, not opener)│
    │  · Getting started    │   │  · Network status   │
    │  · API                │   │  · Roadmap          │
    │  · Network & trust    │   │  · Changelog        │
    │  · Guides / CLI / Ops │   │                     │
    └───────────────────────┘   └─────────────────────┘
```

---

## Sidebar navigation (Litepaper-first)

```
DOCS  (mirrors docs/docs.json navigation groups)
├── Litepaper                         ← default opening page
├── Getting started
│   ├── getting-started/introduction
│   ├── getting-started/download-malibu
│   ├── getting-started/agent-onboarding
│   └── getting-started/api-key
├── Buyers
│   ├── api/chat-completions, api/responses, api/messages, api/models,
│   │   api/headers, api/usage-object, api/network-stats
│   ├── guides/openai-sdk, guides/receipts, guides/sticky-conversations,
│   │   guides/pinning, guides/pricing-comparison,
│   │   guides/tool-calling-and-structured-output
│   └── agentic/tool-calling, agentic/structured-output,
│       agentic/buyer-side-validation
├── Providers
│   ├── guides/payments, guides/economics, guides/provider-economics
│   ├── cli/malibu-cli, cli/malibu-verify, cli/headless-install,
│   │   cli/flags-and-config
│   └── operations/model-catalog, operations/verified-model-settlement,
│       operations/provider-autoupdate
├── Network & trust
│   ├── network/overview, network/security ← canonical for proof boundaries
│   ├── network/trust-disclosure ← live tier1_disclosure fields
│   ├── network/threat-model, network/receipts, network/toploc,
│   │   network/benchmarks-and-methodology, network/glossary
│   ├── network/metering-and-billing, network/discovery-and-routing,
│   │   network/transport, network/reputation
│   └── operations/network-stats
├── Guides index
│   └── guides/index
└── Ledger
    ├── status                        ← ledger (not homepage)
    ├── roadmap
    └── changelog
```

Litepaper opens the docs. Everything else is reference or ledger. If this tree and `docs/docs.json` disagree, `docs.json` wins.

---

## Litepaper rules (keep it as the feature)

The Litepaper stays the full narrative: premise, opportunity, why now, economics vision, competitive framing, join. These edits strengthen it without turning it into a runbook.

### 1. Status chips on mixed claims

Inline labels wherever a bullet spans live marketplace and planned protocol:

| Label | Meaning |
|-------|---------|
| `Live` | Running in production today; a parenthetical such as (partial) narrows the scope |
| `Beta` | Shipped but limited / experimental / operator-gated |
| `Preview` | Visible but not yet functional for its end use |
| `Pending` | Shipped but not working today until an update lands |
| `Default-off` | Built and shipped in code, disabled in production |
| `Off` | Built and switched off until a stated milestone |
| `Prototype` | Research code; not production-integrated |
| `Planned` | Not built or not released |
| `Planned v0` | Token / mining launch milestone |
| `Planned v1` | Buyer marketplace / TOPLOC milestone |
| `Planned v2` | Decentralization milestone |
| `Not available` | Not offered |

Keep this table identical to the legend on `docs/status.mdx` and the glossary's status-labels table.

Examples:

- Signed receipts: v0.4 settlement receipts → `Live`; buyer-visible v0.3 header → `Live` (partial)
- Coordinator + gateway inference path → `Live`
- 90% provider credit share → `Live`
- USDC-on-Base payout → `Planned (beta)` (pipeline built, off)
- $MALIBU emission, burn-and-mint (70/12/18) → `Planned v0`
- TOPLOC per-request verification → `Planned v1`
- On-chain reserves floor → `Planned v0`

### 2. Reality check strip (one box, not a second homepage)

Place near **What we've shipped**:

> *This section describes both the live inference marketplace and planned token-protocol features. For the current ledger of what is running vs scheduled, see [Network status](/docs/status).*

Keeps ambition on the page; points skeptics to the ledger.

### 3. Economics split in-place

Never mix live and launch economics in one sentence.

- **Today (pre-beta marketplace):** 90% provider share, 10% operator; credits accrue on the ledger. USDC-on-Base payout at public beta. Source: [Metering & billing](/docs/network/metering-and-billing).
- **At token launch (planned):** 70% provider / 12% reserves / 18% buy-and-burn. Source: whitepaper §tokenomics.

### 4. Trust pointer under buyer promises

After verifiability / privacy bullets:

> *What receipts prove and do not prove, and privacy boundaries → [Security & trust model](/docs/network/security).*

Litepaper may say "verifiable inference." Security page owns the precise boundary.

### 5. End-of-page CTAs (three intents)

| CTA | Destination | Reader intent |
|-----|-------------|---------------|
| Understand the bet | Stay on Litepaper | Vision |
| Integrate | Getting started → API key / Download | Build |
| Verify what's live | Network status | Audit |

### 6. Terminology

- Prefer **coordinated inference network** or **distributed providers, coordinated routing** in reference docs.
- Reserve **P2P** only if buyer↔provider direct paths are documented (not today).
- Credit **TOPLOC (Prime Intellect, 2025)** wherever cited as lineage.

### 7. Quantitative claims

Every number in the Litepaper needs a footnote or link:

- Hardware benchmarks → Benchmarks page (or Phase 1 report)
- Market size / Mac install base → cited source + date
- Provider earnings tables → Provider economics appendix with assumptions
- "20–40% cheaper" → Pricing comparison page with dated rate-card snapshot

PoMW 10×/watt vs RTX 5090 must be scoped to **memory-hard weight walks**, not inference TPS, unless a separate inference benchmark exists.

---

## Reference lane standards

Pages under API, network, guides, CLI, and operations are the **source of truth** for integrators and operators.

| Topic | Canonical page | Litepaper must not overrule |
|-------|----------------|------------------------------|
| What a receipt proves | `network/security.md`, `guides/receipts.md` | "No tampering" without TOPLOC `Live` |
| Privacy | `network/security.md`, `getting-started/introduction.md` | "Private inference" |
| Provider share today | `network/metering-and-billing.md`, `guides/payments.md` | 70% flywheel as if live |
| Tool-call trust | `agentic/buyer-side-validation.md` | Provider-verified intent |
| Model catalog today | `operations/model-catalog.md` | Frontier models without pool-warm qualifier |

When narrative and reference disagree, **update the Litepaper** or add a status chip — do not weaken reference pages to match marketing.

---

## Ledger lane (to build)

### Network status (`/docs/status`)

Single page answering:

- What components are `Live` / `Beta` / `Planned`
- Live provider share (90%) vs planned flywheel (70/12/18)
- Verification primitives: receipts `Live`, TOPLOC `Planned v1`, PoMW mining `Planned v0` (prototype public)
- Link to `/v1/network-stats` when available; note degraded state if endpoint is down

### Roadmap (`/docs/roadmap`)

Milestone view aligned with litepaper v0 / v1 / v2 — dates only when committed.

### Changelog (`/docs/changelog`)

API field additions, receipt version bumps, docs semantic changes. Mirror `Deprecation` headers on `/v1/network-stats`.

---

## Cross-lane linking

| From | To | When |
|------|-----|------|
| Litepaper "What we've shipped" | Network status | Any mixed live/planned list |
| Litepaper buyer section | Security & trust model | Verifiability, privacy |
| Litepaper economics | Metering & billing + whitepaper | Today vs launch split |
| Litepaper benchmarks | Benchmarks / Phase 1 report | 10×, 2.14M walks/s |
| Getting started | Introduction, not Litepaper | Integrators who skip story |
| API pages | Security, receipts | Every verification mention |

---

## Implementation phases

### Phase A — Credibility without demotion (1–2 weeks)

- [x] Add status chips + Reality check strip to published Litepaper
- [x] Fix privacy and verification copy in Litepaper; link Security page
- [x] Split 90% vs 70% economics on Litepaper with today vs launch labels
- [x] Publish `/docs/status` (minimal ledger)
- [x] Align terminology: coordinated network, TOPLOC lineage

### Phase B — Evidence supports the story (2–4 weeks)

- [x] Benchmarks & methodology page (PoMW vs inference, footnoted)
- [x] Pricing comparison page (rate card vs anchors, dated) — OpenRouter snapshot 23 Sep 2026
- [x] Provider economics appendix (assumptions, duty cycle)
- [x] Canonical [Economics](../docs/guides/economics.mdx) page (90/10 live vs 70/12/18 planned)
- [x] Threat model page under Network & trust
- [x] TOPLOC integration page (`Planned v1` until live)
- [x] Live public snapshot: `GET https://api.malibu.tech/v1/stats/overview` on status + API pages

### Phase C — IA polish (4–6 weeks)

- [x] Confirm `/docs` default remains Litepaper
- [x] Sidebar restructure per navigation spec above
- [x] Buyer / Provider / Network nav groups (Aug 2026)
- [x] CI: `validate-docs-claims.mjs` (evidence links, invite copy, stale API URLs, stale default model)
- [x] Changelog + roadmap pages
- [x] Glossary page

### Phase D — Voice governance (ongoing)

- [x] CI check: Litepaper links evidence pages (`npm run docs:validate`)
- [x] Superlative pass on Litepaper competitive copy (Aug 2026) — keep reviewing new claims
- [x] No live/planned merge without status chip (Litepaper + status)
- [x] Security page wins on trust boundaries
- [x] New features: reference page first, then Litepaper bullet with chip (process — stated here; CI does not enforce order)

---

## Anti-patterns (do not do)

| Anti-pattern | Why |
|--------------|-----|
| Replace Litepaper with Getting Started as `/docs` default | Loses "what is this about?" entry |
| Move Litepaper to `/vision` off-docs | Hides the story from doc visitors |
| Expand Litepaper into full API reference | Wrong register |
| Make Network status the homepage | Wrong audience; feels like an ops journal |
| Soften Security page to match Litepaper copy | Destroys credibility |
| Claim TOPLOC or BME as `Live` before integration ships | Partner / buyer trust failure |

---

## Related repo docs

| Doc | Scope |
|-----|-------|
| [`docs/litepaper.mdx`](../docs/litepaper.mdx) | Published narrative (Mintlify source) |
| [`roadmap.md`](../roadmap.md) | Console product roadmap (buyer UI) |
| [`docs/network/benchmarks-and-methodology.mdx`](../docs/network/benchmarks-and-methodology.mdx) | PoMW benchmark evidence (published summary) |
| [`docs/network/threat-model.mdx`](../docs/network/threat-model.mdx) | Threat model |

Console product roadmap and docs architecture are complementary: roadmap tracks `malibu.tech/console`; this doc tracks `malibu.tech/docs`.
