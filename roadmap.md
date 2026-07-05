# Malibu Chat Product Roadmap

**Product:** [malibu.tech/console](https://www.malibu.tech/console/)  
**Backend:** MacProvider gateway (`api.streamvc.live`) — OpenAI-compatible inference marketplace  
**Positioning:** Buyer-facing chat that turns MacProvider's agentic + verifiable inference stack into a product buyers trust and pay for.

---

## 1. Competitive landscape

| Pattern | ChatGPT | Claude.ai | Cursor | Cline | Malibu target |
|--------|---------|-----------|--------|-------|---------------|
| Zero-friction first use | Free tier | Free + Pro upsell | Hobby free | BYOK / provider | Demo session on first prompt |
| Auth | Email/Google/Apple | Email + Google | GitHub/Google (Teams: SAML) | API key per provider | **GitHub OAuth** + API key fallback |
| Usage visibility | Settings → Usage | Settings → Usage + credits | Credit pool + model burn | Token/cost in task header | Daily token bar + per-message settlement |
| Billing | Subscription + API credits | Plan limits + pay-as-you-go | $N monthly credit pool | Pay provider | Free 100k/day → credits / USDC |
| Chat persistence | Sidebar + Projects | Projects + artifacts | Shared chats (Teams) | Task history + checkpoints | localStorage threads → server history |
| Agentic UX | Agents, Codex | Artifacts | Agent mode, MCP, hooks | Task timeline, tool calls | **Core differentiator** — tool loop + timeline |
| Trust signals | Brand | Transparency | Billing implicit | Checkpoints, diffs | **Signed receipts + provider ID** |

**Wedge:** Malibu is not another ChatGPT skin. It is verifiable, pool-routed, tool-capable inference on Apple Silicon.

---

## 2. Current state (pre-Phase 0)

| Surface | Real | Mock / gap |
|---------|------|------------|
| Console streaming | Yes | — |
| Console pool status | Yes | Loading copy feels dead |
| Console auth | Partial | OAuth callback mismatch with gateway |
| Console usage/billing | — | `getUsage()` unused |
| Console history | — | Recent section hidden |
| Workspace nav | — | `href="#"` dead links |
| Landing stats | — | Randomized node counts |
| MacProvider surface used | ~20% | No demo, sticky, tools, receipts |

---

## 3. MacProvider capabilities to capitalize on

| Capability | API | Malibu use |
|------------|-----|------------|
| Sticky conversations | `X-MacProvider-Conversation` | Per-thread KV cache, cheaper multi-turn |
| Multi-turn tool calling | SPEC-018 `tools`, `tool_calls[]` | Agent mode (Phase 2) |
| Structured output | `response_format: json_schema` | API-only; not a console mode |
| Signed receipts | `X-MacProvider-Receipt` | Verified inference badge |
| Settlement | `X-MacProvider-Settlement-*` | Per-message trust UX |
| Demo mode | `POST /auth/demo-session` | Anonymous first chat |
| Usage & quotas | `GET /v1/usage` | Header bar + dashboard |
| Rate card | `GET /v1/rate-card` | Model picker pricing (Phase 1) |

---

## 4. Roadmap phases

### Phase 0 — Alive product (shipped in this repo)

**Goal:** Console feels live, trustworthy, and complete enough to demo.

| # | Initiative | Status |
|---|------------|--------|
| 0.1 | Fix auth proxy (`/auth/*`, `/account`) | Done |
| 0.2 | Demo mode on first prompt | Done |
| 0.3 | Live pool chrome (skeleton → real status) | Done |
| 0.4 | Quota in header (`GET /v1/usage`) | Done |
| 0.5 | Per-message metadata (tokens, cached, receipt, node) | Done |
| 0.6 | Chat history (localStorage threads) | Done |
| 0.7 | Sticky conversations header | Done |
| 0.8 | Wire workspace nav (dashboard, keys, settings) | Done |
| 0.9 | Landing live stats from `stats.streamvc.live` | Done |
| 0.10 | Quota errors → sign-in CTA | Done |

**Success:** New visitor chats in <10s, sees pool + quota, gets reply with token metadata, returns to saved thread.

---

### Phase 1 — Buyer account & monetization (shipped)

| # | Initiative | Status |
|---|------------|--------|
| 1.1 | Usage dashboard — today + 7d/30d local analytics | Done |
| 1.2 | API key CRUD via `/auth/api-keys` | Done |
| 1.3 | Rate card in model picker | Done |
| 1.4 | Credits / USDC top-up | Coming soon (UI placeholder) |
| 1.5 | Plans display (Free / capacity tier) | Done |
| 1.6 | Receipt viewer + verify CLI link | Done |
| 1.7 | Settings: alerts, default model, spend limit | Done |

---

### Phase 2 — Agentic Chat (6–10 weeks) — differentiator

| # | Initiative | Status |
|---|------------|--------|
| 2.1 | Tool-call streaming in client (SPEC-018) | Done |
| 2.2 | Agent mode toggle (Chat ↔ Agent) | Done |
| 2.3 | Task timeline (Cline-style) | Done |
| 2.4 | Built-in client tools: web_fetch, json_validate, calculator | Done |
| 2.5 | Human-in-the-loop approve/reject | Done |
| 2.6 | MCP connector in Settings | Stub (URL field; full MCP in Phase 3) |
| 2.7 | Structured output mode for JSON prompts | Removed (out of product scope) |
| 2.8 | OpenAI SDK export snippet per thread | Done (`/console/agent-docs/`) |
| 2.9 | Cline / Continue compatibility docs | Done |

**Positioning:** *ChatGPT talks. Malibu proves what ran, on which node, and can act.*

---

### Phase 3 — Platform & growth (10–16 weeks)

| # | Initiative |
|---|------------|
| 3.1 | Team workspace + shared billing |
| 3.2 | Usage analytics by surface (Chat / Agent / API) |
| 3.3 | Model allow/block lists |
| 3.4 | $MALIBU token credits integration |
| 3.5 | Server-side encrypted thread sync |
| 3.6 | Embeddable chat widget |
| 3.7 | Provider transparency (hardware, region) |

---

## 5. Information architecture

```
/console/                 Chat (default)
/console/dashboard/       Usage, tokens, settlement
/console/keys/            API keys
/console/                 Settings modal (account)
/network/                 Public pool stats
/host/                    Provider onboarding
/seller-portal/           Provider dashboard
/docs/                    API reference
```

---

## 6. Auth recommendation

| Method | When | Notes |
|--------|------|-------|
| **Demo session** | First visit, no signup | 1k tokens/IP/day via `X-Demo-Token` |
| **GitHub OAuth** | Primary signed-in path | Opens gateway account; paste `mp_*` key |
| **API key paste** | Power users, CI | localStorage `malibu.mp.key` |
| Google OAuth | Phase 2 | Broader consumer funnel |
| Email/password | Not planned | Dev-first ICP |

---

## 7. Metrics

| Metric | Phase 0 | Phase 1 | Phase 2 |
|--------|---------|---------|---------|
| Time to first token (anonymous) | <15s | <10s | <10s |
| D1 return (local history) | 20% | 30% | — |
| GitHub sign-in after demo quota | — | 25% | — |
| Agent mode adoption | — | — | 15% sessions |
| Cached token % (sticky) | track | track | >20% |

---

## 8. Build order (next 90 days)

```
Week 1–2:  Phase 0 — alive product ✓
Week 3–4:  Phase 1 dashboard, keys, settings, rate card ✓
Week 5–6:  Billing/credits + rate card + receipt viewer (credits pending gateway)
Week 7–10: Phase 2 agent mode v1 ✓
Week 11+:  MCP, teams, $MALIBU, server history
```

---

*Last updated: July 2026*
