# Malibu blog — house style and authoring guide

Read this in full before writing or editing any post, then obey it. It governs
both human and automated authoring. When a rule here conflicts with a general
instinct, this file wins.

> **Non-negotiables:** §5 (brand hard-rules) and §6 (honesty and data) are the
> two sections that prevent real harm — legal, reputational, factual. If you
> read nothing else carefully, read those twice.

---

## 0. The one principle

**Good SEO is good content.** Google, ChatGPT, Perplexity, and every other
search surface rank the same thing: genuinely helpful, expert content written
for people. There is no separate "AI SEO" trick. Optimizing for AI answers *is*
optimizing for humans — clear writing, specific expertise, real data, direct
answers. Do not chase bots, do not keyword-stuff, do not write inauthentic
signals. One non-commodity piece with a real Malibu angle beats ten generic
listicles. If a post would not be worth a reader's time, do not ship it.

## 1. Before you write (the quality gate)

A post can satisfy every checkbox in §7 and still be forgettable. Clear this gate
first, or the topic is not ready:

- **Thesis.** State the post's argument in one sentence — a *claim*, not a topic.
  "Verifiable receipts make Malibu the only inference you can audit" is a thesis;
  "about inference verification" is not. Every post argues for something.
- **So what.** State in one sentence what the reader can now do, decide, or
  believe that they couldn't before. If you can't state the thesis and the
  so-what, research more or skip the topic. A no-post day is a valid outcome.
- **Only-we angle.** Name the thing that makes this piece Malibu's and not
  interchangeable with a Together / Fireworks / Groq / generic-crypto post. If the
  angle is a feature bullet anyone could write, find the sharper one or drop it.
- **Depth.** Target ~900–1,800 words for a flagship post, ~500–900 for a narrow
  single-question post. Never pad to a number — if the topic can't sustain ~600
  words of genuine substance, fold it into a bigger post or skip it.

**Post-draft cut test:** delete any sentence that could appear unedited on a
competitor's blog. If much of the draft survives that test, the angle was too
generic.

## 2. How to add a post (content model)

The blog is generated from Markdown. **Never** hand-edit generated HTML,
`blog/index.html`, `blog/<slug>/index.html`, `sitemap.xml`, `feed.xml`, or
`vite.config.js`.

1. Create one file: `blog/posts/<slug>.md` (kebab-case slug = the URL).
2. Fill the frontmatter (§3) and write the body in Markdown.
3. Run `npm run blog:build`. It generates the post page, updates the index,
   sitemap, and RSS feed, and prunes anything orphaned.
4. Run `npm run build` to confirm the whole site still builds.

That is the entire surface area. Adding a post never touches config.

Write Markdown only — `##`/`###` headings, `- ` lists, `**bold**`, `*italic*`,
`` `code` ``, fenced code blocks, `[text](https://…)` links. The build strips any
HTML tag not on a safe allowlist and drops `javascript:` links, so raw `<script>`,
event handlers, and inline HTML will not survive; don't rely on them. Every
heading gets an anchor ID automatically, and a table of contents is generated
when a post has 3 or more H2 sections.

## 3. Frontmatter reference

Rules: one `key: value` per line, nothing after the value. **Inline `#` comments
are NOT supported** — anything after the colon is part of the value. `draft` must
be exactly `draft: true` to hold a post back.

```markdown
---
title: Turning on the world's biggest AI cloud
date: 2026-07-11
headline: Turning on the world's biggest AI cloud.
category: Manifesto
author: The Malibu team
description: One-sentence meta description, roughly 150 characters.
lede: The large intro paragraph shown under the title.
excerpt: Optional index-card text.
ogTitle: Optional social title override.
ogDescription: Optional social description override.
heroImage: /images/brand/blog-hero-macbook-sunset-mesh.jpg
heroAlt: Descriptive alt text for the hero image.
ogImage: /images/brand/some-other-social-card.jpg
keywords: [primary keyword, secondary, tertiary]
slug: custom-url-slug
updated: 2026-08-01
canonical: https://malibu.tech/blog/custom/
draft: false
---
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Used in `<title>`, og:title, and cards. ~50–60 chars. |
| `date` | yes | `YYYY-MM-DD`. |
| `headline` | no | H1 display; defaults to `title`. |
| `category` | no | e.g. Manifesto, Engineering, Network, Guide. Defaults to `Notes`. |
| `author` | no | Defaults to `The Malibu team`. |
| `description` | in practice | Meta description; one real sentence, ~150 chars. |
| `lede` | recommended | Large intro paragraph. |
| `excerpt` | no | Card text; defaults to `lede`, then `description`. |
| `ogTitle` / `ogDescription` | no | Social overrides; default to `title` / `description`. |
| `heroImage` / `heroAlt` | no | `heroAlt` is required whenever `heroImage` is set. |
| `ogImage` | no | Social card image if different from the hero; must be a real image. |
| `keywords` | no | Array. Also accepts a bare `a, b, c` list. |
| `slug` | no | Overrides the URL slug (defaults to the filename). |
| `updated` | no | Sets `dateModified`; bump it on a real content refresh. |
| `canonical` | no | Defaults to `https://malibu.tech/blog/<slug>/`. |
| `draft` | no | `draft: true` excludes the post from the build. |

## 4. Voice and style

Match the launch manifesto (`blog/posts/turning-on-the-worlds-biggest-ai-cloud.md`).

- **Declarative and concrete.** Short sentences. Lead with the strongest claim.
  "The world's biggest AI cloud already exists. It's sitting on desks."
- **Specific over vague.** Real numbers, real model names, real mechanisms
  (MLX, TOPLOC, Ed25519 receipts, USDC on Base, OpenAI-compatible gateway).
- **Rhythm.** Vary sentence length. Short fragments in threes are a signature
  move ("Nobody has to build it. Nobody has to permit it. Nobody has to wait.").
- **Openings and endings.** Open with the sharpest claim, not a warm-up. Close
  with a line that echoes or answers the opening — not a "in conclusion" summary.
- **Second person for reader value** ("What this means if you own a Mac").
- **Confident, never hype.** No exclamation points. No emojis.
- **Punctuation:** em-dashes are fine but not a crutch — more than one in a
  paragraph, reach for a period instead. Straight quotes and straight apostrophes
  only, never smart/curly. Serial comma.
- **Format for extraction.** AI answer engines lift clean structure. Give a
  direct answer near the top, use descriptive H2s, and put dense facts (prices,
  specs, numbers) in short lists rather than burying them in prose.

**Banned words and phrases** (they mark AI-generated filler — never use):
revolutionary, game-changing, game-changer, unlock, supercharge, seamless,
seamlessly, robust, leverage (as a verb), delve, landscape (figurative),
ecosystem (figurative), cutting-edge, state-of-the-art, empower, harness the
power of, elevate, unprecedented, transformative, best-in-class, "in today's
fast-paced world", "it's important to note that", "at the end of the day",
"in conclusion", "when it comes to", "the world of".

## 5. Brand hard-rules (non-negotiable)

- **Malibu is a standalone product.** Never mention, link, or expose the backend
  origins in content: no `MacProvider`, no `*.streamvc.live` (console/api/stats/
  coordinator). Those exist only in build config, never in a post.
- **Use Malibu-branded URLs** in examples: `https://api.malibu.tech/v1/...`,
  `https://malibu.tech/console`, `https://malibu.tech/host`, `https://malibu.tech/docs`.
- **Production domain is `malibu.tech`.** Do not invent other domains.
- **Do not cite AntFeed** as a Malibu partner, buyer, integration, or customer.
  AntFeed is a separate, unrelated project.
- **No investment or income-security framing.** Malibu pays USDC as compensation
  for compute provided — it is not an investment product. Never frame payouts as
  investment returns, yield, ROI, dividends, interest, or guaranteed/passive
  income; never promise or project earnings. "Earn for the compute your Mac
  provides" is fine; "passive income", "guaranteed returns", "your Mac pays you
  X/month" are not. When in doubt, describe the mechanism, not a financial promise.
- **Sourced competitor claims only.** When characterizing a named competitor's
  failure, limitation, or motive, cite a specific primary source (their own docs
  or a reputable outlet) for that specific claim. No unsourced disparagement.
- **Pre-publish leakage check.** Before opening the PR, search the draft for
  `streamvc`, `MacProvider`, and any internal hostname. If any appears, a research
  source leaked into the copy — remove it and re-cite from a public source.
- Company/legal name: **Malibu AI, Inc.**

## 6. Honesty and data (this is what makes it "expert content")

- **Never invent or inflate a number.** Every network statistic must come from
  `npm run blog:stats` (reads the live public snapshot). Cite it verbatim.
- **The network is early.** As of writing it is a small number of nodes. Frame
  the 200M-idle-Macs thesis as the *opportunity*, and any live figure as proof
  the *mechanism works today* — not proof of scale. Do not imply size it lacks.
- **Even the thesis figures need sources.** The manifesto's headline claims —
  "~200M Apple Silicon Macs", "~10x the per-watt efficiency of an RTX 5090",
  "more consumer AI compute than the top three hyperscalers combined" — are strong
  and currently unsourced in the post body. Before reusing any of them, link a
  primary source or soften to a clearly-labelled estimate. Do not treat a prior
  post's number as a citation.
- For external facts (market size, competitor claims, model benchmarks), use
  `WebFetch` on a primary source and link it. No unsourced statistics.
- **Freshness.** A post built around a live stat goes stale fast. When a cited
  network number drifts materially from the current `blog:stats` snapshot,
  revisit the post and bump its `updated` field.
- Mirror the docs' claim discipline: if you cannot verify it, do not assert it.

## 7. Per-post SEO checklist

- [ ] The §1 gate is cleared (thesis, so-what, only-we angle, depth).
- [ ] One `title` (~50–60 chars) that a human would click and matches search intent.
- [ ] One `description` (~150 chars), a real sentence, not keyword soup.
- [ ] A direct answer to the post's core question in the first two paragraphs.
- [ ] Exactly one H1 (rendered from `headline`/`title`); body uses H2/H3.
- [ ] **Forward links:** 2–4 relevant internal links (to `/host/`, `/console/`,
      `/docs`, or other posts).
- [ ] **Backward links:** add a link *into* this new post from 1–2 existing posts
      in the same topic cluster, in the same PR. This is how the blog builds
      topical authority — do not skip it.
- [ ] `keywords` set with a genuine primary term. (Note: search engines ignore the
      keywords meta tag for ranking; it's for our own tracking — don't over-invest.)
- [ ] `heroImage` + descriptive `heroAlt` where it adds value.
- [ ] canonical, JSON-LD, OG tags, sitemap, RSS — all automatic; do not hand-add.

## 8. Tooling protocol

- `npm run blog:stats` — live Malibu network numbers. The only source for network
  stats. Prints `n/a` for any missing field; if it exits non-zero, do NOT guess —
  drop the data-backed claim or try again later.
- `WebSearch` — current-month trends, competitor moves, keyword discovery.
- `WebFetch` — read and cite primary sources.
- Google Search Console — real query/impression data once pages are indexed
  (empty for new posts; useful after a few weeks).

## 9. How a post gets published

Posts ship as a **draft pull request** for human review and are **never
auto-merged**. Quality over volume: if nothing clears the bar on a given run,
post a short note and stop — a no-post day is a valid, expected outcome.

> **Status:** the scheduled routine that enforces cadence, opens the draft PR, and
> posts the "nothing today" note is **not yet implemented** (Phase 3). Until it
> exists, treat this section as the intended contract, not a live safety net —
> a human is still opening and reviewing every PR by hand.
