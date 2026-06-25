# $MALIBU — Core Token Design

Foundation artifact for the Malibu AI token. Source for the landing-page narrative,
marketing presentation, eventual whitepaper, and smart-contract spec.

**Status:** seed concept, 2026-06-13. Open design decisions flagged explicitly at
the bottom. Iterate from here.

---

## The economic loop in one sentence

Buyers pay USDC for AI inference on Apple Silicon. A launch-phase **30% protocol
fee** is split: part funds reserves that back new $MALIBU emissions to sellers,
the rest market-buys $MALIBU and **burns** it. Every session both grows the
token's real backing AND tightens supply; the buyer never has to touch the
token. The fee ratchets down on a governance-committed glide path as the
network matures.

---

## The core BME concept, adapted

Classic **Burn-and-Mint Equilibrium (BME)** — tokens destroyed on the demand side,
minted on the supply side, with the protocol seeking balance.

$MALIBU keeps the spirit, fixes the failure modes:

| Classic BME (e.g. Helium HNT) | $MALIBU adaptation |
|---|---|
| Buyer **burns tokens** to mint USD-pegged credits (Data Credits) | Buyer pays USDC directly; credits (IC) become a pure accounting layer — **burn happens protocol-side from the fee, never in the buyer's payment path** |
| Seller earns freshly-minted tokens out of thin air | Seller earns tokens minted *against* the reserves the fee just funded |
| No supply destruction beyond buyer-burn | Protocol-side **market-buy-and-burn** on every transaction (funded by the fee) — supply tightens with usage |
| Token has no floor — exposed to speculation cycles | Token has a backed floor that grows with every transaction |
| Buyer UX exposed to token volatility | Buyer UX is USD-stable. Buyer never touches the token |
| Oracle in the critical path (manipulation risk) | No oracle in the payment leg |

---

## Inference Credits (IC) — the metering layer

$MALIBU separates **payment** from **metering**. Buyers pay in USDC; consumption
is measured in **Inference Credits (IC)**. IC is an accounting unit, **not a
token** — it has a fixed USD denomination (e.g. 1 IC = $0.0001) and never leaves
the coordinator's ledger.

Why two units:

- **IC stays stable.** Sellers publish rate cards in IC — for example,
  `Llama-3-70B output: 25 IC per token`. The IC unit itself never floats.
- **USDC is the settlement leg.** At session close: `(IC consumed × per-IC USD)
  = USDC owed`, split 95% to seller, 5% to reserves.
- **No oracle, no burn, no on-chain credit token.** IC is purely accounting —
  receipts, billing, rate cards. There's no IC contract to manipulate, no
  buyer-side burn step, no oracle in the critical path.

This preserves the accounting benefit of Helium-style Data Credits (stable unit,
clean per-model pricing) while dropping the mechanism (burn-to-mint against an
oracle) that made classic BME fragile.

---

## The two flows

**Buyer side — USDC in, IC metered, no token exposure:**

1. Buyer opens a session (or deposits USDC into a channel).
2. Inference is metered in IC against the seller's published rate card.
3. At session close: `IC consumed × per-IC USD rate = USDC owed`.

**Settlement — USDC split three ways (launch phase, 30% protocol fee):**

1. **70¢ of every $1** → seller as inference revenue (USDC).
2. **12¢ → Malibu protocol reserves** — backs future $MALIBU mints; grows the floor (BLV).
3. **18¢ → market-buy + burn** — protocol swaps the 18¢ for $MALIBU on the DEX and destroys it. Immediate supply reduction. No oracle, no buyer involvement.

**Seller side — USDC + $MALIBU:**

1. Receives 70% USDC for work done (settled per session).
2. Earns $MALIBU emissions from protocol reserves on an epoch cadence, distributed by:
   - **Verified capacity** — ZK-proven model warm + responsive during idle windows
   - **Quality** — uptime, SLA hit rate, latency
   - **Staking weight** — time-locked $MALIBU positions

**Per-$1 supply math at launch** (assuming BLV = $0.50, market price = $1.00):
mints ~**0.24 MALIBU** against the 12¢ reserves, burns ~**0.18 MALIBU** from the
18¢ DEX skim. Net +0.06 MALIBU per $1 — meaningfully smaller inflation than
mint-only designs, with real burn $ exceeding mint $.

---

## The load-bearing invariant

> **Every minted $MALIBU is backed by USDC that just flowed through the network.
> Every transaction also destroys $MALIBU from circulating supply. Mint side
> grows the floor; burn side tightens the float.**

No free emissions. No death spiral. No oracle in the payment path. No buyer-side
volatility. Burn $ ≥ mint $ at launch parameters, so above-floor trading is
mildly inflationary and at-floor trading is deflationary — anti-cyclical by
design.

---

## Why $MALIBU has economic-primitive status

A pure utility token sits on top of a USDC economy and can be removed without
breaking the loop. $MALIBU is structurally different:

- Every transaction grows reserves → grows the token's real backing.
- Sellers must hold $MALIBU to access top emission tiers (stake-weighted).
- Governance over fee size, model directory, and emission curve flows through
  $MALIBU.

Token is required infrastructure, not a wrapper.

---

## Protocol fee & glide path

Mac idle inference today captures **$0** of value. Sellers start at a zero
baseline — anything above $0 is consumer surplus. Unlike mature platforms where
competition has compressed take rates, MacProvider's launch phase has a real
from-zero gap to capture; that capture funds the token engine.

| Phase | Trigger | Fee | Reserves : Burn | Seller take per $1 |
|---|---|---|---|---|
| **Launch** | Pre-revenue → N sellers | **30%** | 12¢ / 18¢ | 70¢ USDC + ~0.24 MALIBU |
| **Growth** | N → 10N sellers | 20% | 8¢ / 12¢ | 80¢ USDC + ~0.16 MALIBU |
| **Mature** | 10N+ sellers | 10% | 4¢ / 6¢ | 90¢ USDC + ~0.08 MALIBU |
| **Long-tail** | Network-scale milestone | 5% | 2¢ / 3¢ | 95¢ USDC + ~0.04 MALIBU |

Triggers are **public, on-chain, and governance-enforced**. Sellers see the
long-term equilibrium at onboarding; the high-fee phase is **transparent
bootstrap funding**, not exploitation. The N value and milestone metric become
explicit launch parameters.

### Why the launch fee is higher than mature platforms

Reference cuts: App Store 30% (15% small dev), Uber/Lyft 20–30%, Airbnb 14–20%,
Stripe 2.9%, pure DEX <1%. MacProvider delivers more than commodity payment
rails (coordinator, gateway, verification, payment routing, supported-model
directory) — closer to the platform tier. Combined with the from-zero seller
baseline, **15–30% during bootstrap is defensible**; 5% would leave the token
engine starved.

### Why higher fees make the token economics actually work

The protocol fee IS the budget for $MALIBU's mint + burn engine. Tiny fee →
tiny engine → vapor token. Real fee → real reserves growing the floor + real
burn tightening supply + real emissions for sellers to value.

At 30% fee with 12/18 split, per $1: mints 0.24 MALIBU and burns 0.18 MALIBU —
both legs are real numbers. At 5%, both legs are rounding errors.

### What sellers get for the launch-phase 30% cut

Per $1 of inference:
- **70¢ USDC** (immediate, stable)
- **~0.24 MALIBU emission** (delayed, claim against floor + speculation upside)

| MALIBU market price | Effective seller take per $1 |
|---|---|
| $1.00 (2× floor) | 70¢ + 24¢ = **94¢** — better than most platforms |
| $0.50 (at floor) | 70¢ + 12¢ = **82¢** — still better than App Store |

The deal only works if the token is real. Vapor → sellers see 70¢ and leave.
Real → sellers are paid in two currencies, the second of which captures the
network's growth.

---

## The 5-year-old version (for landing-page hero)

Imagine an arcade where:

- Players pay normal dollars at the front desk.
- The desk hands them **paper tickets** — each ticket is worth a small fixed
  amount, no matter what's happening outside.
- Players spend tickets on games. Cheap games cost a few tickets, big games
  cost many.
- About a third of every dollar is split: part drops into a **vault** behind
  the counter, the rest is sent to the **shredder**.
- The vault gives out **$MALIBU tokens** to the best machine operators every
  week as a bonus.
- The shredder buys $MALIBU tokens from the world and destroys them — fewer
  tokens around, the rest worth a little more.
- More players → more dollars → bigger vault, busier shredder → more rewards
  for great operators AND scarcer tokens overall.
- Operators never have to gamble on token prices — every token they earn is
  backed by real arcade revenue.

That's $MALIBU. The arcade is AI inference. **The tickets are Inference Credits
(IC).** The machines are Apple Silicon Macs. The vault and the shredder are the
protocol.

---

## Marketing one-liners (drafts)

**Hero candidate:**
> Real AI inference. Real USDC payments. A token backed by every dollar that
> flows through the network.

**Technical buyer angle:**
> Pay for AI in USDC. The token is the network's coordination layer, not your
> invoice.

**Seller angle:**
> Get paid USDC for inference. Get paid $MALIBU for being excellent.

**Crypto-native angle:**
> Every dollar of revenue grows the floor AND burns supply. No emissions out of
> thin air. No oracle in the payment path. No death spiral.

---

## Explicit non-goals

This design does NOT:

- Force buyers to hold or interact with $MALIBU.
- Mint tokens against synthetic or unpaid work.
- Use $MALIBU as the unit of account for inference pricing.
- Put an oracle in the payment leg.
- Take on money-transmission exposure (USDC stays USDC end-to-end).

---

## Open design decisions (to close before launch)

1. **IC denomination & role** — fixed 1 IC = $0.0001 metering only, or also
   used as a prepaid channel balance (deposit USDC → IC balance → spend down)?
2. **Floor mechanism** — Baseline-style protocol-owned liquidity, simpler
   treasury commitment, or neither.
3. **Verification primitive** — sandwich ZK (first + last token), VeriLLM
   statistical test, or coordinator-receipt only.
4. **Glide-path milestone metric** — active sellers, USDC TPV, network-month
   revenue, or a composite? Defines when the fee ratchets from 30% → 20% → 10% → 5%.
5. **Reserves : burn ratio** — locked at 40/60 (12¢/18¢ at launch) or
   governance-adjustable within bounds?
6. **Seller cashflow** — auto-convert $MALIBU to USDC at emission, or hold
   by default.
7. **Governance scope** — parameter tuning only, or extending to directory
   and model approval.
8. **Regulatory packaging** — utility, security, hybrid; jurisdiction.
9. **Cold-start funding** — presale, treasury, or founder commitment.

---

## Provenance

Distilled from strategic conversation 2026-06-13, exploring:

- PRL (Pearl Network) token design as comparison point — see arxiv
  [2606.04819](https://arxiv.org/abs/2606.04819) for context on PRL's PoUW model
- Pure BME failure modes (Helium HNT 2021–2023 trajectory)
- ZK-verifiable inference as integrity primitive (sandwich vs VeriLLM v1)
- Baseline Markets (BLV / POL) as floor mechanism — see baseline.markets/docs
- **Pattern B (revenue-funded emissions with backed mints) selected** as the
  design that composes cleanly without forcing volatility on buyers.
