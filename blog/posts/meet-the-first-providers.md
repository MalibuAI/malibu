---
title: Malibu's pre-beta is rolling out, one Mac at a time
headline: The pre-beta is rolling out, one Mac at a time.
category: Field notes
date: 2026-08-01
author: The Malibu team
description: Malibu's private pre-beta is rolling out to its first Apple Silicon providers. They are serving real inference before the network has paid a cent.
heroImage: /images/brand/blog-hero-pre-beta.svg
heroAlt: A stylized Malibu sunrise over the ocean; a scattered constellation of Mac nodes sits above the horizon with the first few lit in coral and wired to the rising sun, while the rest wait dim — the first providers coming online, one at a time.
ogImage: /images/brand/blog-hero-macbook-sunset-mesh.jpg
lede: The case for Malibu rests on two hundred million idle Apple Silicon Macs. That is the opportunity. The proof is much smaller and already running: a handful of Macs, owned by ordinary people, are serving real inference on the network today, before it has paid any of them a cent.
keywords: [malibu providers, apple silicon inference node, decentralized ai, run llm on mac]
draft: false
---

The world's biggest AI cloud is still a thesis. The proof that it works is already here, and it is small on purpose.

As of August 1, 2026, four provider Macs were online, serving three open-source models. Between them they have handled 13,344 requests and served 4,806,891 tokens, about 360 tokens per request. Four machines is not a swarm, and it is not meant to be one yet. It is enough to show the mechanism runs end to end: real hardware, real models, real buyers, real responses. Everything after this is the same loop, repeated.

This is one of those four machines.

## Zero yen and an idle Mac

His handle is @Zeroyen_jp. The display name on the account translates from Japanese as "starting crypto from zero yen," and that is close to how he arrived: no budget, one idle Mac in Japan, and a question about what it could do while he wasn't using it. He installed Malibu, and within a day his machine was quietly serving requests for a small open model, `meta-llama/llama-3.2-3b-instruct`, in the background.

He joined, in his own words, to get off "a balance of 0 yen."

The first thing he did after setting up was find bugs. He hit rough edges during install, wrote them up, and sent the feedback to the team. The issues were fixed quickly, and he was tipped for the report. He has been candid in public about where things stand: the operators responded fast and left him with a good impression, the network is still small, and he does not expect much in the way of rewards yet. He plans to keep his Mac running and report on how it goes.

None of that is a pitch. It is a person trying a new thing early, poking at it, and telling other people what he finds. That is exactly what the first days of a real network look like.

## Why turn it on before it pays

Here is the part worth being straight about: the payout rails are not switched on. Providers are compensated in USDC on Base for the compute they contribute, and that settlement is still being brought online. Right now the counter on a provider's screen reads close to zero.

So why run a Mac on Malibu at all?

Because the interesting thing was never the first week's numbers. It was whether the loop closes: a host comes online, serves real requests, hits a rough edge, reports it, the edge gets fixed, and the network gets a little more real. That loop is running now, with actual people on the other end of it. The providers online today are the ones who wanted to see it work before it was obviously going to, and who will have been here since the first four nodes.

## What every response already carries

Even at four nodes, one thing holds that no major inference API offers: every response comes back with a signed receipt binding the model, the output, and the provider that served it. Small network, same guarantee. The verification is not something switched on later at scale; it has been the default since request one. For what a receipt does and does not prove, see [the signed receipt your inference API doesn't ship](/blog/signed-inference-receipt/).

## Getting in

Malibu is in private pre-beta. Providers join by invite, a wave at a time. That is how the Macs online today got on, and it is why the network is four nodes and not four thousand: every provider so far was onboarded by hand. There is no open self-serve join yet.

The thesis is two hundred million Macs. The reality today is four, serving live traffic, with the next wave being invited in now. Both are true at once, and the distance between them is the whole opportunity.

If you have an Apple Silicon Mac and want to be in the first wave, request an invite on the [host page](/host/). Once you have a code, Malibu installs and registers in a few minutes and serves the same open models on the same network as the Macs already online. If you want the longer argument for why any of this works, start with the [manifesto](/blog/turning-on-the-worlds-biggest-ai-cloud/).

The first Macs are on. The loop is closing. More coming.
