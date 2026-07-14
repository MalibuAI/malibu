---
title: Turning on the world's biggest AI cloud
headline: Turning on the world's biggest AI cloud.
category: Manifesto
date: 2026-07-06
description: Two hundred million Apple Silicon Macs are already deployed, already paid for, and idle twenty hours a day. Malibu turns them on.
ogTitle: Turning on the world's biggest AI cloud
ogDescription: The world's biggest AI cloud already exists. It's sitting on desks. Malibu is the network that turns it on.
lede: Two hundred million Apple Silicon Macs are already deployed, already paid for, and idle twenty hours a day. Together they hold more consumer AI compute than the top three hyperscalers combined. The only thing missing is a network that turns them on.
heroImage: /images/brand/blog-hero-macbook-sunset-mesh.jpg
heroAlt: A MacBook on a warm-lit desk in front of open windows overlooking the Malibu coast at sunset, with a mesh of glowing coral lines flowing from the screen into a network of distant Macs across the sky.
keywords: [apple silicon ai, decentralized inference, open source models, ai compute marketplace, mac inference]
draft: false
---

The world's biggest AI cloud already exists. It's sitting on desks.

Two hundred million Apple Silicon Macs have shipped since 2020. Each one delivers roughly ten times the per-watt inference efficiency of an RTX 5090 on open-source model workloads. Almost all of them are idle twenty hours a day. Together they represent more consumer AI compute than the top three hyperscalers combined.

Nobody has to build it. Nobody has to permit it. Nobody has to wait three years for a substation upgrade. It's already there. The only thing missing is a network that turns it on.

**That network is Malibu, and it is live today.**

## The market everyone can see

AI inference is a fifty-billion-dollar market growing three-to-five times a year. Three companies own most of it. Open-source models — Llama, Qwen, gpt-oss, Gemma — have caught up on quality. Supply hasn't. Buyers pay four to twenty times what the underlying compute actually costs, because the underlying compute is locked behind hyperscaler pricing and multi-year GPU allocations.

Meanwhile the datacenter answer is stalling. New capacity takes billions of dollars and years to permit. Grid interconnect queues stretch past 2030 in the US. Water rights, zoning, community pushback — the physical world is refusing to keep up with the software world.

And while all of that plays out, hundreds of millions of AI-capable Macs sit at four percent utilization, waiting for their owner to come off a Zoom call.

The mismatch is obvious. Fixing it isn't.

## Why nobody has fixed it yet

Every prior decentralized AI network — Bittensor, Akash, Gensyn, Prime Intellect, io.net, Render — hit the same wall: **buyers won't come without providers; providers won't stay without buyers.** A decade of permanent bootstrap, dressed up as tokenomics.

The wall isn't a hardware problem or a cryptography problem. It's a sequencing problem. You cannot ask a provider to keep a machine warm for a buyer who hasn't arrived. And you cannot ask a buyer to route production traffic through a network that hasn't proven it can serve.

Malibu breaks the wall by paying providers to be *ready* before buyers arrive. Mining pays for the state the network needs anyway — model weights resident, memory substrate warm, provider online. When a buyer request lands, the miner yields in about fifty milliseconds and starts serving. **Mining state is serving state.** That equivalence is the architectural bet everything else is built on.

## Why this couldn't happen five years ago

Four preconditions are simultaneously true for the first time. Miss any one and the network doesn't work.

- **Apple Silicon.** Unified-memory Macs capable of serving 100B+ parameter open-source models are shipping in consumer hardware. No datacenter GPU can match Apple's per-watt inference efficiency on these workloads.
- **Open-source frontier models.** Llama, Qwen, gpt-oss now match closed-model quality on most workloads. Verified inference on open weights is finally worth paying for.
- **Cheap inference verification.** TOPLOC (Prime Intellect, 2025) verifies buyer responses at roughly one percent of serving cost. Cryptographic trust no longer requires trusted hardware.
- **Stablecoin payments.** USDC on Base settles global micropayments in seconds at sub-cent cost. Weekly provider payouts to a hundred countries are a smart-contract call, not a payroll department.

Malibu is not early to any of these. It is the network that combines all four.

## What "live today" actually means

This is not a whitepaper for something we intend to build. Every component below is running in production right now, serving real requests to real buyers on real hardware:

- A coordinator that admits providers, routes requests, meters usage, and settles weekly in USDC on Base.
- An OpenAI-compatible gateway. Point any OpenAI SDK client at one URL and it works — Cursor, Aider, Claude Code SDK, plain `curl`. Streaming, tool calling, JSON-schema structured output, sticky conversations, prefix-cache reuse.
- A signed public installer that turns a stock Apple Silicon Mac into a provider in one command. Auto-detects the memory tier, pulls the right MLX model, registers, and starts serving.
- A signed inference receipt on every response. Nine fields — model hash, output hash, prompt hash, provider pubkey, token count, latency, timestamp, version — signed with the provider's Ed25519 key. Verifiable in microseconds with our open-source `malibu-verify` CLI.
- Weekly automated USDC payouts to providers, 90% default provider share, priced live against the OpenRouter frontier.

Here is what pointing a client at Malibu looks like from the buyer side:

```
curl https://api.malibu.tech/v1/chat/completions \
  -H "Authorization: Bearer $MALIBU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [{"role": "user", "content": "Hello."}]
  }'
```

Every response comes back with an `X-Malibu-Receipt` header. You can hand that receipt to `malibu-verify` and prove — cryptographically, without trusting us — that the response ran on the model it claims to have run on, from the provider it claims to have come from. No swap. No silent quantization. No cache substitution.

This has never been standard in commercial AI inference. On Malibu it is the default.

## What this means if you own a Mac

Imagine opening your laptop in the morning and realizing it earned money while you slept. No fans screaming. No datacenter. No rack space. No electricity bill worth noticing. Just your Mac, quietly serving AI requests to buyers who needed them, all day.

Your Mac is no longer just a laptop. It's an income-producing asset — not a hobby, not a lottery ticket, an actual asset.

Cooperative scheduling keeps the machine yours. Mining runs in the background; serving interrupts for milliseconds at a time. You can use your Mac exactly the way you used it yesterday. It's just also, quietly, an inference-as-a-service business.

Everything after hardware payback is compound income on a machine you were going to buy anyway.

## What this means if you buy AI inference

Companies are massively overpaying. Malibu cuts inference cost by 20 to 40 percent without asking anyone to trust anyone. The catalog is the open-source frontier — gpt-oss-20b and 120b, Gemma families, Qwen3 and Qwen3-Coder, Llama-3.3 70B, Nemotron. Every response is cryptographically verifiable. Every payment settles in USDC on Base.

There is no vendor to be deprecated by. No closed-model API to be repriced against you next quarter. No lock-in beyond a base URL. When a better open-source model ships, the network serves it — and your integration doesn't change.

Malibu is designed to be adopted without changing anything on the buyer side except the endpoint.

## The compounding loop

Every new provider increases coverage. Better coverage attracts more buyers. Buyer revenue increases provider earnings. Higher earnings attract more providers. **Every new participant makes the next one more valuable.**

Nobody else has a reason to build this. Apple sells hardware — running a token-incentivized inference marketplace is not their business model. OpenAI sells closed models — open-source inference cannibalizes them. Hyperscalers own datacenters they need to keep utilized. The network that turns consumer Macs into AI infrastructure has to come from outside all three, and it has to be a token network — because only a token network can pay providers to be ready before buyers arrive.

The edge is hardware Malibu doesn't own, and a mechanism its competitors have no reason to build.

## Turn it on

The world's biggest AI cloud already exists. Malibu turns it on.
