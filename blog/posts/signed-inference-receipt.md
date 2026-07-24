---
title: The signed receipt your inference API doesn't ship
headline: The signed receipt your inference API doesn't ship.
category: Engineering
date: 2026-07-23
description: Every Malibu response carries a nine-field Ed25519 receipt you can verify offline with an open-source CLI. No other commercial inference API ships one.
ogTitle: The signed receipt your inference API doesn't ship
ogDescription: Every Malibu response carries a signed cryptographic receipt. Nine fields, Ed25519, verifiable offline. Here is what that changes for buyers.
lede: Your inference API returns some tokens and a model field that says whatever the vendor wants it to say. There is no signed statement, from the machine that actually ran the request, tying the output you got to the model you paid for. Malibu attaches one to every response, and you can verify it in a second without trusting Malibu.
heroImage: /images/brand/blog-hero-macbook-sunset-mesh.jpg
heroAlt: A MacBook on a warm-lit desk overlooking the Malibu coast at sunset, with a glowing coral seal and signature line drawn across the screen as a signed cryptographic receipt.
keywords: [verifiable inference, signed inference receipt, ed25519 receipt, ai audit trail, inference verification]
draft: false
---

Ask any commercial inference API, from any hyperscaler or serving startup, for cryptographic proof that the model you paid for is the model that answered you. You will not get one. There is nothing to hand back. The `model` string in the response body is a claim by the vendor, verified only by the vendor. Every audit trail in commercial AI inference bottoms out in vendor honesty.

Malibu ships something different. Every response from the network comes with an `X-Malibu-Receipt` header: a nine-field tuple signed with the provider's Ed25519 key. You can verify it in a second, offline, with an open-source CLI. If it verifies, a specific machine, using specific weights, produced the exact bytes you received at the exact time it says it did.

That primitive is the difference between an inference bill you have to trust and an inference bill you can audit.

## What is in a Malibu inference receipt

The current wire format is v0.3. Nine fields, canonicalized in a fixed order, then signed:

- `model_hash` — SHA-256 of the model weights actually loaded on the provider, anchored to the network's signed model catalog.
- `model_id` — the model identifier, for example `mlx-community/Qwen2.5-7B-Instruct-4bit`.
- `prompt_hash` — SHA-256 of the canonicalized request body.
- `output_hash` — SHA-256 of the canonicalized response body.
- `provider_pubkey` — the Ed25519 public key that signed the receipt.
- `receipt_version` — `0.3.x`.
- `tokens_out` — completion tokens generated.
- `ttft_ms` — time to first token, in milliseconds.
- `unix_ts` — signing timestamp, seconds since epoch.

The signature covers all nine. Streaming responses emit a settlement-capable receipt at the end of the stream. Full field reference: [Docs — Receipts](https://malibu.tech/docs/network/receipts).

## What a valid receipt proves, and what it doesn't

This is the part most vendors would skip. We won't.

A `valid` result from `malibu-verify` proves two things:

1. A holder of the provider signing key signed the canonical tuple.
2. The verifier resolved that public key through the configured trust source, either the coordinator's `/v1/receipt-keys/{provider_id}` registry or an offline `--pubkey` you pinned yourself.

It does not, by itself, prove that the provider actually ran a forward pass over the claimed weights. `model_hash` matching the catalog rules out silent model swaps and stealth quantizations, because the loaded-weights hash is what the provider signs. It doesn't yet rule out a sophisticated provider replaying a cached completion or fabricating one from a cheaper model whose output happens to match. The gap is small and it is real, and closing it is the job of the next layer, described below.

Being explicit about this is the point. A receipt is a real cryptographic commitment, not a marketing badge, and the honest scope of what it commits to is what makes it worth building on.

## Verifying a receipt in thirty seconds

You capture the receipt as an HTTP header, then hand it to `malibu-verify`. From Python:

```
raw = client.chat.completions.with_raw_response.create(
    model="mlx-community/Qwen2.5-7B-Instruct-4bit",
    messages=[{"role": "user", "content": "Hello"}],
)
resp = raw.parse()
receipt = raw.headers.get("X-Malibu-Receipt")
```

Then:

```
malibu-verify \
  --receipt "$RECEIPT" \
  --prompt-hash "$PROMPT_SHA256_HEX" \
  --output-hash "$OUTPUT_SHA256_HEX" \
  --provider-id m1-anon \
  --json
```

Exit `0` means valid. Exit `1` means invalid, either the signature didn't check out or the canonicalization didn't match or the key rotated outside the operator's grace window. Exit `2` means inconclusive, usually because the pubkey was unresolvable when you ran the verifier. Full contract: [Docs — CLI: `malibu-verify`](https://malibu.tech/docs/cli/malibu-verify).

These names are standardizing across the network as it rolls out. If you are on an early provider build, confirm the exact receipt header and verifier command from your onboarding before you script against them.

Most buyers don't verify on every request. Per-request verification adds a round trip, and receipts stay verifiable forever. The pragmatic pattern is a nightly job: batch a day's receipts, run `malibu-verify` over the lot, keep the verdicts alongside your [usage logs](https://malibu.tech/console) for dispute resolution.

## Why no other API ships one

Nothing about signing a receipt is technically hard. Ed25519 signatures are cheap, hashing is cheap, and the fields already exist inside every serving stack. The reason commercial inference APIs don't attach one is closer to a business decision than an engineering one.

- A signed `model_hash` commits the operator to a specific set of weights on that request. Vendors who route the same `model` string to several backends, quantize under load, or swap in a distilled variant on quota pressure would be attaching a public receipt to a practice they'd rather keep private.
- A signed `output_hash` makes it trivial for a buyer to prove, after the fact, that a specific response came out of a specific request. That is exactly the artifact you want when disputing a bill and exactly the artifact a vendor doesn't want you to have.
- A signed `provider_pubkey` names the machine that served the request. In a hyperscaler's fleet the machine is an implementation detail; on Malibu it is a settlement primitive.

Every one of those properties is a feature for the buyer and a liability for a vendor whose margins depend on the ambiguity. Malibu's incentive model runs the other way. The network is designed to pay providers only when receipts verify, and the settlement pipeline that turns receipt verdicts into buyer debits and provider credits is the design's next milestone — a stricter v0.4 receipt profile is already going into the settlement ledger today, with the money-movement leg on top of it landing behind [verified model settlement](https://malibu.tech/docs/operations/verified-model-settlement) and the USDC-on-Base payout rail.

## What changes when receipts are the default

A signed receipt on every response reshapes a handful of things at once.

- **Audit trail.** A buyer can prove, months later, that a given response ran on the model it claims to have run on, from the provider it claims to have come from. The proof survives the vendor going away.
- **Disputes.** Arguments over output quality, downtime, or wrong-model routing stop being arguments about anyone's memory. They become a signature check.
- **Settlement.** Coordinator receipt verdicts are what will drive debit and refund once the on-chain payout leg is live; missing or invalid receipts are already ineligible for provider credit inside the ledger.
- **Composition.** Receipts can be replayed into systems that don't trust the issuer but do trust the signature. Escrow, reputation, on-chain settlement, and third-party audit all become straightforward to layer on.

The bigger the model you're paying for, the more each of those is worth. When you're routing serious volume against a frontier open-source model, a signed attestation is the only way to know the endpoint ran the weights you paid for and not a cheaper stand-in. Signed receipts are the same idea, one layer down.

## What comes next: forward-pass attestation

Signed receipts are the live primitive. Per-request forward-pass attestation, which closes the gap between "the provider signed this" and "the provider ran this," is the next companion protocol on the road to the v1 marketplace. The design pattern follows TOPLOC (Prime Intellect, 2025), which verifies at roughly one percent of serving cost that a claimed forward pass over the claimed weights actually happened. When it ships, forward-pass verdicts route alongside receipt verdicts through the same settlement pipeline, and buyer-visible status distinguishes receipt-only `valid` from forward-pass-attested `valid`. Design in [Docs — Forward-pass attestation](https://malibu.tech/docs/network/toploc).

Receipts today, forward-pass attestation next, both cheap enough to run on every request.

## The one-line version

Every commercial inference API asks you to trust a `model` field. Malibu hands you a signature over the model, the prompt, the output, and the machine. You can verify it yourself. That's the difference.
