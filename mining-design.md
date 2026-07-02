# $MALIBU Mining — Concept Summary

Foundation document for the mining side of the Malibu network. Companion to
`token-design.md`, which covers the buyer-economy and BME mechanics. This doc
scopes what mining is, how the work is defined, how block rewards flow to
miners, and what tokenomics variables need to be locked to ship v0.

**Status:** design consensus, 2026-07-01. Open decisions flagged for the
tokenomics workstream at the bottom.

---

## The idea in one paragraph

Malibu mining is a Pearl-shaped proof-of-useful-work network built on Apple
Silicon Macs. Miners run a small compute algorithm (~a few hundred MB, not a
full LLM) that produces cryptographically verifiable work. Block production
follows Bitcoin/Pearl mechanics: single global difficulty target, first valid
submission wins the block, constant block reward, halving schedule, fixed
supply cap. Emission is 100% block rewards to miners. There is no other source
of new supply in v0.

**The tokenomics team's job:** fix the emission curve (supply cap, initial
block reward, halving cadence, distribution split, DEX seed), knowing that
mining is the only issuance source and that BME/burn mechanics from the
original `token-design.md` are v1+ overlays, not v0-load-bearing.

---

## What miners actually do

Every miner runs `malibu-miner`, a small CLI binary. The mining algorithm is a
memory-bandwidth-bound compute kernel that:

1. Reads the current block header (prev hash, difficulty target, epoch seed).
2. Picks a nonce, generates a deterministic input seeded from `(header, nonce)`.
3. Runs a chain of dependent compute steps on a purpose-built kernel — the
   kernel's internal weights are pseudo-randomly regenerated per epoch from the
   epoch seed (Ethash-inspired, prevents precomputation and slows down ASIC
   development).
4. Hashes the final output. If `hash < target`: win.
5. Submits `(nonce, TOPLOC-style commitment, miner_address)` to the chain.
6. Chain verifies the commitment (parallel prefill, ~100× cheaper than the
   miner's chain), records the block, credits the block reward.

**Key protocol properties:**

- **Universal algorithm.** Same binary on every Mac. No per-model choice, no
  tier menus, no fragmentation.
- **Memory-bandwidth-bound.** Chain dependency between steps forces every
  attempt to stream state through memory — favors Apple Silicon's per-watt
  advantage at the consumer power envelope.
- **Small footprint.** ~a few hundred MB. Fits alongside any inference model
  the seller may also choose to host for buyers (v1+).
- **Verifiable cheaply.** TOPLOC-style commitment on the final state; verifier
  does a single parallel prefill against the same seeded input.

---

## Hardware scaling (pure PoW shape)

Same algorithm across all hardware. Reward scales via attempts-per-second, driven
by memory bandwidth and parallel chain count. Illustrative numbers (actual
benchmarks TBD in the determinism probe):

| Hardware | Memory | Bandwidth | Parallel chains | Attempts/sec | Reward ratio |
|---|---|---|---|---|---|
| M1 / M2 base (8GB) | 8 GB | 100 GB/s | 1 | ~25 | 1× |
| M2 Pro (16GB) | 16 GB | 200 GB/s | 3 | ~150 | 6× |
| M3 Max (64GB) | 64 GB | 400 GB/s | 15 | ~1,500 | 60× |
| M3 Ultra (192GB) | 192 GB | 800 GB/s | 47 | ~9,400 | 380× |

An Ultra earns ~380× an Air, automatically. No per-tier multipliers. No
protocol-level tiering. Identical to the algebra a Bitcoin ASIC vs a laptop CPU
would produce.

---

## Block production and rewards

Pure Bitcoin shape:

- **Single global difficulty target.** All miners face the same target.
- **First valid TOPLOC-proven submission wins the block.**
- **Constant block reward per block.** No per-submission multipliers.
- **Difficulty adjustment**: WTEMA family, targeting proposed 60-second block time.
- **Halving on schedule.** Reward halves every N blocks per the tokenomics curve.
- **Fixed supply cap.**
- **Reward = 100% to winning miner in v0.** Distribution splits (foundation,
  treasury) can be layered on if tokenomics decides.

---

## Emissions design — variables for the tokenomics team

**All new MALIBU supply in v0 comes from mining block rewards.** No premine
allocation is required by the protocol, but tokenomics may choose one. No
staking, no burn, no reserve emissions in v0. Everything else is a v1+ overlay.

### Variables to lock

| Variable | Purpose |
|---|---|
| Total supply cap | Hard ceiling on ever-minted MALIBU |
| Initial block reward | MALIBU minted per valid block at launch |
| Halving cadence | Blocks between halvings (Bitcoin: 210,000 blocks ≈ 4 years) |
| Block time target | Cadence difficulty adjusts to (proposed: 60s) |
| Distribution split per block | Fraction to winning miner vs treasury/foundation |
| Initial distribution | Any premine, team allocation, DEX liquidity seed |
| DEX seed liquidity | Initial LP on Base (Aerodrome/Uniswap), size and opening price |

### Rough sizing example (illustrative — not a recommendation)

Assuming:
- Supply cap: 21,000,000 MALIBU (Bitcoin-analog for narrative)
- Initial block reward: 50 MALIBU/block
- Block time: 60s
- Halving: every 210,000 blocks (~146 days)

Year 1 issuance (with halvings) ≈ ~4M MALIBU. Full curve asymptotes at 21M over
~30 years. This is one point in a large design space — the team should decide
based on:

- Desired early-miner accrual vs long-tail supply
- DEX liquidity absorption capacity (how much emission can the market handle
  without immediate price collapse)
- Bootstrap length (aggressive early emission vs slow build)

### Design decisions the team owns

1. **Supply cap**: what number? 21M carries Bitcoin symbolism; 1B feels more
   like an inflation-friendly commodity token. Both defensible.
2. **Halving cadence**: Bitcoin-analog (~4y) is battle-tested but slow.
   Aggressive (6-12mo halvings) matures the emission curve faster but may
   spook early miners. Slow (8y) gives a long bootstrap but delays scarcity.
3. **Emission curve shape**: strict halving (Bitcoin) vs continuous exponential
   decay (some newer L1s) vs linear vesting. Halving is miner-friendly
   psychologically because it's understood; continuous decay is smoother.
4. **Distribution split**: 100% to miner (pure Bitcoin) vs miner + treasury +
   foundation (Zcash-style dev fund). Any tax on block rewards changes
   effective miner economics.
5. **Premine / initial distribution**: any team/foundation allocation before
   mining starts? Amount, vesting, purpose.
6. **DEX seed**: size of the initial LP position determines opening price
   discovery. Small LP = high volatility; large LP = capital-heavy launch.
7. **Early-miner premium**: any bonus mechanism for first N blocks / first N
   miners? Argument against: halving already rewards early miners naturally,
   additional premium creates farming incentives.

---

## Mining and serving coexistence (v1+ context)

In v0, mining runs 24/7 on each miner's Mac. There is no buyer economy yet.

In v1, when the buyer marketplace launches, each Mac can also host inference
models for paying buyers. Mining and serving coexist on the same hardware via
cooperative scheduling:

- **Idle time**: miner runs full mining hashrate, earning MALIBU emissions.
- **Serving time**: mining pauses (~50ms yield), buyer's request runs, seller
  earns USDC from the buyer.

**Economic implication for tokenomics**: sellers with heavy buyer traffic earn
more USDC and fewer MALIBU emissions. The two revenue streams inversely
correlate. This reduces individual seller variance and provides an implicit
demand ceiling on emissions (heavy-buyer sellers naturally consume less
emission).

The tokenomics model may want to account for this — mining emission demand
depends on the seller / miner split of the network's Macs, and on buyer traffic
volume.

---

## How this reconciles with `token-design.md`

The original doc contemplated a full BME loop: 30% protocol fee funding reserves
that back miner emissions + a market-buy-and-burn leg. That design assumed
buyer USDC revenue as the mint anchor.

**What's changed in this document:**
- **Mining emissions no longer require buyer revenue.** Block rewards are the
  primary issuance mechanism, funded by protocol supply (halving schedule).
  This solves the chicken-and-egg problem: sellers can mine (and be paid) on
  day one, with zero buyers.
- **BME burn becomes a v1+ overlay.** When buyer USDC starts flowing, the
  ~18¢/$1 buy-and-burn leg from the original design still applies — it just
  operates as a demand-side supply-tightener on top of mining emissions,
  rather than as the primary mint mechanism.
- **The 30% protocol fee is v1+.** No fee applies in v0 because there is no
  buyer USDC to fee. Sellers who mine keep 100% of block rewards.
- **Staking-weighted emissions are dropped.** The original doc mentioned
  time-locked $MALIBU positions influencing emission distribution. Removed:
  staking-as-utility is circular. Miner reward is a function of actual work
  proven, not capital locked.

**What survives from the original design:**
- Buyer settlement in USDC, IC (Inference Credits) as accounting layer.
- Protocol-side market-buy-and-burn (economic equivalent of EIP-1559 gas burn).
- Reserve-backed accounting for the buyer economy when it launches.
- Governance-committed fee glide path (30% → 20% → 10% → 5%) as the network
  matures.

The two documents are consistent when viewed as **v0: mining-only** →
**v1: mining + buyer economy with BME overlay**.

---

## What the miner sees (UX for context)

```
$ malibu-miner
Hardware: M3 Ultra 192GB, 800 GB/s bandwidth
Algorithm: malibu-mine-v1 (128 MB, epoch 47 weights loaded)
Running 47 parallel chains at ~9,400 hash/sec

Network hashrate: 4.2M hash/sec
Your share: 0.22%
Block time: 62s (target: 60s)
Current block reward: 50 MALIBU

Last 24h:
  Blocks found: 23
  MALIBU earned: 1,150
  MALIBU/USD: $0.42
  Revenue equivalent: $483
```

One binary, one algorithm, standard Bitcoin/Pearl mental model. The Ultra
above is earning ~$483/day at these illustrative parameters; the emission
curve chosen by tokenomics will move this number materially.

---

## What ships in v0 (the full mining-and-token loop)

Load-bearing components — all must be complete for launch:

- Mining algorithm binary (`malibu-miner`), Metal / MLX implementation
- On-chain verification of TOPLOC-style commitments
- Difficulty adjustment mechanism (WTEMA)
- Block production and longest-chain rule
- Emission schedule (block reward + halving + supply cap) as fixed by tokenomics
- $MALIBU token contract on Base
- DEX liquidity seeded at launch (Aerodrome/Uniswap)
- Coordinator / verifier node set (centralized at v0, path to decentralize
  documented but not shipped)

Explicitly deferred to v1+ (do not block v0):
- Buyer marketplace, USDC settlement rails, 30% protocol fee, BME burn
- Multi-model registry for seller-side serving
- Inference-credit redemption
- Programmable-compute / agent-runtime features

---

## Direct questions for the tokenomics workstream

1. Supply cap number, and the narrative justification (why that number).
2. Initial block reward and halving cadence.
3. Distribution split per block (miner vs treasury vs foundation).
4. Premine / initial allocation policy (any, and if so, size + vesting).
5. DEX seed liquidity size and opening price.
6. Emission curve shape (strict halving vs continuous decay).
7. Any early-miner premium mechanism (my argument: no, halving already rewards
   early miners).
8. Reconciliation with the original `token-design.md` BME parameters — do
   the 30% → 5% fee glide path and the 12/18 reserves/burn split from that
   document carry into v1 as the buyer-economy overlay, or does the buyer
   economy launch trigger a tokenomics revision?

Once these are locked, the mining loop is fully specified end-to-end and
implementation can start.
