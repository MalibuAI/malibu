# Malibu Miner Prototype — Phase 1: Metal Port of PoM Walk

This document instructs a fresh session (or new engineer) on how to execute
Phase 1 of the Malibu miner prototype. Everything needed to pick up cold
is here.

---

## Session context — read this first

**Malibu is an Apple Silicon-only decentralized AI inference network.**
Providers are Mac owners; the miner runs on Metal and produces token emissions
as proof-of-model work. When buyers arrive (v1+), the same Macs will serve
real inference. Phase 1 is not about launching anything — it's a **research
prototype** to validate that a Keryx-style memory-hard walk over quantized
LLM weights runs correctly and efficiently on Apple Silicon.

Do NOT compare to NVIDIA GPUs. Malibu is not competing with NVIDIA-based
networks. The goal is to characterize the algorithm's behavior on the
substrate we are targeting (Apple Silicon), not benchmark cross-hardware.

For the wider mining/network design, read [mining-design.md](mining-design.md)
first. It covers the token economics, block reward shape, mining vs serving
coexistence, and how this Phase 1 prototype feeds into the final protocol.

---

## What Phase 1 produces

A standalone Rust project (suggested name: `malibu-miner-probe`) that:

1. Loads a canonical GGUF-quantized LLM into unified memory via `candle-core`.
2. Runs a 256-step memory-hard, data-dependent walk over those weights on the
   Metal GPU (algorithm ported from Keryx's Proof of Model / `pom_gpu.rs`).
3. Produces byte-exact PoM output identical to a Rust CPU reference
   implementation.
4. Reports hashrate (walks/sec) on the running Mac.
5. Ships a benchmark harness that can be run on any Mac class (M1 base through
   M3 Ultra) and captures the numbers the tokenomics team needs.

**Not shippable production code. Research prototype.** The output feeds
tokenomics decisions and validates the algorithm choice before we invest in
protocol implementation.

---

## Reference material — read in this order

1. **Keryx miner repository**:
   [Keryx-Labs/keryx-miner](https://github.com/Keryx-Labs/keryx-miner).
   Apache/MIT licensed. Prior art for the exact algorithm we're porting.
2. **Keryx whitepaper**:
   [keryx-labs.com/whitepaper](https://keryx-labs.com/whitepaper).
   The "Proof of Model" section has the algorithm spec.
3. **Keryx `src/pom.rs`** (52KB, Rust) — reference implementation of the walk.
   Read: `mix64`, `transition`, `pom_block_seed`, `pom_pow_value`, and the
   main walk loop. These are the primitives to port.
4. **Keryx `src/pom_gpu.rs`** (18KB, CUDA glue) — use as the shape reference
   for the Metal kernel dispatch.
5. **Keryx `src/models.rs`** — SHA-256 model-ID pattern and GGUF tier registry.

---

## Concrete technical spec

### Algorithm — byte-exact port of Keryx PoM

Do not innovate on the algorithm in Phase 1. Reproduce Keryx's PoM walk
byte-identically on Metal. Innovation comes later, in Phase 2+, once we know
the port works.

Constants (from Keryx `pom.rs`):
- `POM_WALK_STEPS = 256`
- `POM_OPENINGS = 32` (for future proof generation, not needed in Phase 1)
- `CHUNK_WORDS = 4` (32-byte chunks)
- `SEED_SALT`: use Keryx's `0x4B65727978500` for byte-exact comparison during
  validation. Later swap to a Malibu-specific salt (`0x4D616C6962755000` for
  "Malibu\x00" or similar) once determinism is proven.

Primitives that must match Keryx's Rust reference bit-for-bit:
- `mix64(u64) -> u64` — SplitMix64 mixer
- `transition(state, chunk) -> state` — XOR chunk words into state, then mix64
- `pom_block_seed(pre_pow_hash, timestamp, nonce) -> u64` — initial walk state
- `pom_pow_value(final_state, pre_pow_hash) -> [u8; 32]` — final output

Copy these directly from `pom.rs`. Do not rewrite them from the spec.

### CPU reference implementation

Write `walk_cpu.rs` first. Just port `pom.rs`'s walk directly to your project.
This is the ground truth for determinism testing. Should be ~100 lines of
straightforward Rust.

### Metal kernel

Write in Metal Shading Language (MSL). Structure (simplified):

```metal
kernel void pom_walk(
    device const uchar* weights          [[buffer(0)]],
    constant uint64_t& weight_size       [[buffer(1)]],
    constant uint4& pre_pow_hash         [[buffer(2)]],
    constant uint64_t& timestamp         [[buffer(3)]],
    constant uint64_t& base_nonce        [[buffer(4)]],
    constant uint4& target               [[buffer(5)]],  // 256-bit LE
    device uint64_t* winners             [[buffer(6)]],
    device atomic_uint* winner_count     [[buffer(7)]],
    uint tid [[thread_position_in_grid]]
) {
    uint64_t nonce = base_nonce + tid;
    uint64_t state = pom_block_seed(pre_pow_hash, timestamp, nonce);

    uint64_t num_chunks = weight_size / 32;
    for (int i = 0; i < 256; i++) {
        uint64_t offset = (state % num_chunks) * 32;
        uint64_t c0 = *(device const uint64_t*)(weights + offset);
        uint64_t c1 = *(device const uint64_t*)(weights + offset + 8);
        uint64_t c2 = *(device const uint64_t*)(weights + offset + 16);
        uint64_t c3 = *(device const uint64_t*)(weights + offset + 24);
        state = transition(state, c0, c1, c2, c3);
    }

    uint4 pow_value = pom_pow_value(state, pre_pow_hash);
    if (le_leq(pow_value, target)) {
        uint idx = atomic_fetch_add_explicit(winner_count, 1u, memory_order_relaxed);
        if (idx < MAX_WINNERS) {
            winners[idx] = nonce;
        }
    }
}
```

Notes:
- Metal's `uint64_t` arithmetic is exact — no floating point anywhere in the
  walk. If you see FP in the port, you introduced it — remove it.
- Use `device const` on weights so it's cached in the L2/tile cache. Metal's
  memory hierarchy behaves differently from CUDA; test whether marking
  `[[access::read_only]]` helps.
- Dispatch grid size: start with 1M threads (each does one nonce) and tune up
  based on hashrate.

### GGUF loading

Use `candle-core` with Metal feature:

```toml
[dependencies]
candle-core = { version = "0.9", features = ["metal"] }
metal = "0.29"        # metal-rs — Rust bindings to Metal
objc2 = "0.5"
```

Load a small model — recommended: Gemma-3-4B Q4_K_M (~4 GB), same as Keryx's
Tier 0 baseline. Pull from HuggingFace or the Keryx IPFS gateway; the exact
file used by Keryx has SHA-256 model_id `ad50ad0b...` (see `models.rs`).

The weight blob lives in a `metal::Buffer` allocated with
`MTLResourceStorageModeShared` — that's Apple's unified memory mode where CPU
and GPU see the same bytes with no copy. This is the key architectural
advantage we're testing.

### Determinism verification (MANDATORY before any perf measurement)

The Metal kernel must produce byte-identical output to the CPU reference on
every test vector. If they diverge, STOP and debug. Do not measure
performance until determinism holds.

Recommended test:

```rust
#[test]
fn metal_matches_cpu_on_100_vectors() {
    let weights = load_gemma_gguf();
    for i in 0..100 {
        let hash = [i as u8; 32];
        let ts = 1_700_000_000 + i as u64;
        let nonce = i as u64 * 1_000_000;

        let cpu = walk_cpu(&hash, ts, nonce, &weights);
        let gpu = walk_metal(&hash, ts, nonce, &weights);

        assert_eq!(cpu, gpu, "vector {} diverged: cpu={:?} gpu={:?}", i, cpu, gpu);
    }
}
```

Metal's integer arithmetic should be exact but corner cases can bite:
endianness on chunk reads, u64 overflow behavior, unsigned modulo. Debug at
the per-step level if divergence appears — dump intermediate `state` values
from both CPU and GPU and find the first mismatch.

---

## Benchmark harness

Once determinism holds, add a `benchmark` subcommand:

```
malibu-miner-probe benchmark --duration 30m --report benchmark.json
```

Captured metrics:

| Metric | Source |
|---|---|
| Hashrate (walks/sec) | Count winners + attempts across the run |
| Peak power draw (W) | `powermetrics --samplers cpu_power,gpu_power` sampled every 1s |
| Sustained hashrate (30 min) | Rolling average over the run — flag if it drops >10% from peak |
| Memory footprint (GB) | Resident set + Metal buffer size |
| Memory bandwidth utilization | Estimate: `walks_per_sec × 256 × 32 bytes` — compare vs theoretical GB/s of the Mac |

Report per-run to a JSON file; include hardware detection (model, memory,
theoretical bandwidth) so results from different Macs are comparable.

---

## Success criteria

Phase 1 succeeds if all of the following hold:

- [ ] Metal kernel produces byte-exact match to CPU reference on ≥100 test
      vectors, using both random and adversarial inputs (zeros, all-ones,
      boundary nonces).
- [ ] Hashrate scales monotonically across Mac classes tested: M1 → M2 → M3,
      base → Pro → Max → Ultra (higher hardware = higher hashrate).
- [ ] M3 Ultra (or the largest Mac available) sustains ≥90% of its peak
      hashrate over a 30-minute run without thermal collapse.
- [ ] Measured memory bandwidth utilization is ≥60% of the Mac's theoretical
      bandwidth — validates that this is truly a memory-bound workload
      (Apple Silicon's actual strength).
- [ ] No memory allocation errors when running on an M1 base 8GB with a 4GB
      model loaded (leaves headroom for OS + inference server coexistence).

---

## Deliverables at end of Phase 1

Commit a report to this repo alongside the code:

1. **Working repository** with:
   - CPU reference (`walk_cpu.rs`)
   - Metal kernel (`shaders/pom_walk.metal`)
   - Metal glue (`walk_metal.rs`)
   - Determinism test (`tests/determinism.rs`)
   - Benchmark harness (`src/benchmark.rs`)
   - README with build + run instructions
2. **Benchmark results JSON** from each Mac class tested.
3. **Report** (`mining-prototype-phase1-results.md` in this dir) with:
   - Hashrate curve across Mac classes (chart or table)
   - Sustained-vs-peak numbers per Mac (thermal behavior)
   - Bandwidth utilization percentage (validates memory-bound claim)
   - Estimated $/day per Mac class at a target MALIBU price (rough — feeds
     partner's unit-economics calculator)
   - Any deviations from Keryx's algorithm and why
   - Recommended next-phase actions (e.g., tune walk length, add Merkle proof
     generation, integrate with mock chain)

---

## What NOT to do in Phase 1

- Do NOT implement OPoI, escrow, or fraud proofs — later phase.
- Do NOT implement the Merkle proof / Fiat-Shamir opening generation — Phase
  1 is just the walk and its output. Proof generation is Phase 2+.
- Do NOT target NVIDIA / CUDA — Apple Silicon only.
- Do NOT attempt to serve real inference from the miner — that's the coexistence
  problem for a later phase.
- Do NOT connect to any live chain — this is standalone.
- Do NOT change the algorithm from Keryx's until determinism is proven.
  Malibu-specific tuning happens later.

---

## Getting Apple Silicon hardware for testing

Ideal: one of each of M1 base, M2 Pro, M3 Max, M3 Ultra. If not owned:

- **Mac Studio rental services**: several exist, ~$10/hour for M3 Ultra.
  Search "Mac Studio cloud rental" or "MacinCloud M3 Ultra."
- **Ask around**: Mac Studios and Mac Pros are common in creative/ML
  professional circles. A few hours of hands-on testing per machine is
  usually easy to arrange.
- **Minimum viable test set**: M1 or M2 base (floor) + M3 Max or Ultra
  (ceiling). Two data points is enough for the initial scaling curve, more
  is better.

---

## How to start (step-by-step for a new session)

1. `git clone https://github.com/Keryx-Labs/keryx-miner.git` — read the four
   files listed in "Reference material" above (~1 hour).
2. Read the Keryx whitepaper's PoM section (~30 min).
3. Confirm you have at least one Apple Silicon Mac accessible for testing.
4. `cargo new malibu-miner-probe` in a suitable working directory (NOT inside
   this repo — this is a research prototype, keep it separate).
5. Implement the CPU reference by porting Keryx's `pom.rs` walk primitives
   directly (~4 hours).
6. Validate CPU reference against a known Keryx output on a test vector.
7. Implement the Metal kernel and glue (~1–2 days).
8. Run determinism tests until they pass. Do NOT skip this step.
9. Run benchmarks on available Mac hardware. Capture JSON outputs.
10. Write the results report and commit alongside the code.

Estimated total: **2–3 focused engineering days** for a Rust + Metal engineer,
plus benchmark time on multiple Macs.

**First priority is determinism.** Performance measurement is meaningless if
the algorithm doesn't produce correct output. Get bit-exact match before
touching anything else.

---

## Contact / handoff notes

Once Phase 1 is complete, the results feed into:
- The `mining-design.md` update — the hashrate numbers replace the illustrative
  estimates in the hardware scaling section.
- The tokenomics workstream — real hashrate data lets the emission curve be
  tuned against realistic network hashrate expectations.
- The Phase 2 spec — Merkle proof generation, chain integration, and
  Malibu-specific algorithm tuning.
