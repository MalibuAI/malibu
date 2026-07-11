# Malibu blog — house style and authoring guide

Read this in full before writing or editing any post, then obey it. It governs
both human and automated authoring. When a rule here conflicts with a general
instinct, this file wins.

---

## 0. The one principle

**Good SEO is good content.** Google, ChatGPT, Perplexity, and every other
search surface rank the same thing: genuinely helpful, expert content written
for people. There is no separate "AI SEO" trick. Optimizing for AI answers *is*
optimizing for humans — clear writing, specific expertise, real data, direct
answers. Do not chase bots, do not keyword-stuff, do not write inauthentic
signals. One non-commodity piece with a real Malibu angle beats ten generic
listicles. If a post would not be worth a reader's time, do not ship it.

## 1. How to add a post (content model)

The blog is generated from Markdown. **Never** hand-edit generated HTML,
`blog/index.html`, `blog/<slug>/index.html`, `sitemap.xml`, `feed.xml`, or
`vite.config.js`.

1. Create one file: `blog/posts/<slug>.md` (kebab-case slug = the URL).
2. Fill the frontmatter (section 2) and write the body in Markdown.
3. Run `npm run blog:build`. It generates the post page, updates the index,
   sitemap, and RSS feed, and prunes anything orphaned.
4. Run `npm run build` to confirm the whole site still builds.

That is the entire surface area. Adding a post never touches config.

Raw HTML in the body is stripped by the sanitizer — write Markdown only
(`##`/`###` headings, `- ` lists, `**bold**`, `*italic*`, `` `code` ``, fenced
code blocks, `[text](https://…)` links). Headings get anchor IDs and a table of
contents automatically when a post has 3+ H2 sections.

## 2. Frontmatter reference

```markdown
---
title: <plain title — used in <title>, og:title, cards>        # required
date: 2026-07-11                                                # required, YYYY-MM-DD
headline: <optional h1 display; defaults to title>
category: <e.g. Manifesto, Engineering, Network, Guide>         # defaults to "Notes"
author: <defaults to "The Malibu team">
description: <meta description, ~150 chars, one sentence>       # required in practice
lede: <the large intro paragraph shown under the title>
excerpt: <index-card text; defaults to lede, then description>
ogTitle / ogDescription: <optional social overrides>
heroImage: /images/brand/<file>                                 # optional
heroAlt: <descriptive alt text — required if heroImage is set>
keywords: [primary keyword, secondary, tertiary]                # optional
updated: 2026-08-01                                             # optional; sets dateModified
canonical: <optional; defaults to https://malibu.tech/blog/<slug>/>
draft: true                                                     # optional; excludes from build
---
```

## 3. Voice and style

Match the launch manifesto (`blog/posts/turning-on-the-worlds-biggest-ai-cloud.md`).

- **Declarative and concrete.** Short sentences. Lead with the strongest claim.
  "The world's biggest AI cloud already exists. It's sitting on desks."
- **Specific over vague.** Real numbers, real model names, real mechanisms
  (MLX, TOPLOC, Ed25519 receipts, USDC on Base, OpenAI-compatible gateway).
- **Confident, never hype.** No exclamation points. No emojis. No "revolutionary",
  "game-changing", "unlock", "supercharge", "in today's fast-paced world".
- **Second person for reader value** ("What this means if you own a Mac").
- **Punctuation:** em-dashes are fine (Malibu uses them). Use straight quotes and
  straight apostrophes only — no smart/curly quotes. Serial comma.
- **Format for extraction.** AI answer engines lift clean structure. Give a direct
  answer near the top, use descriptive H2s, and put dense facts (prices, specs,
  numbers) in short lists rather than burying them in prose.

## 4. Brand hard-rules (non-negotiable)

- **Malibu is a standalone product.** Never mention, link, or expose the backend
  origins in content: no `MacProvider`, no `*.streamvc.live` (console/api/stats/
  coordinator). Those exist only in build config, never in a post.
- **Use Malibu-branded URLs** in examples: `https://api.malibu.tech/v1/...`,
  `https://malibu.tech/console`, `https://malibu.tech/host`, `https://malibu.tech/docs`.
- **Production domain is `malibu.tech`.** Do not invent other domains.
- **Do not cite AntFeed** as a Malibu partner, buyer, integration, or customer.
  AntFeed is a separate, unrelated project.
- Company/legal name: **Malibu AI, Inc.**

## 5. Honesty and data (this is what makes it "expert content")

- **Never invent or inflate a number.** Every network statistic must come from
  `npm run blog:stats` (reads the live public snapshot). Cite it verbatim.
- **The network is early.** As of writing, it is a small number of nodes. Frame
  the 200M-idle-Macs thesis as the *opportunity*, and any live figure as proof
  the *mechanism works today* — not proof of scale. Do not imply size it lacks.
- For external facts (market size, competitor claims, model benchmarks), use
  `WebFetch` on a primary source and link it. No unsourced statistics.
- Mirror the docs' claim discipline: if you cannot verify it, do not assert it.

## 6. Per-post SEO checklist

- [ ] One `title` (~50–60 chars) that a human would click and matches search intent.
- [ ] One `description` (~150 chars), a real sentence, not keyword soup.
- [ ] Exactly one H1 (the template renders it from `headline`/`title`); body uses H2/H3.
- [ ] A direct answer to the post's core question in the first two paragraphs.
- [ ] 2–4 relevant internal links (to `/host/`, `/console/`, `/docs`, other posts).
- [ ] `keywords` set with a genuine primary term (not stuffed).
- [ ] `heroImage` + descriptive `heroAlt` where it adds value.
- [ ] canonical, JSON-LD, OG tags, sitemap, RSS — all automatic; do not hand-add.

## 7. Tooling protocol

- `npm run blog:stats` — live Malibu network numbers. The only source for network stats.
- `WebSearch` — current-month trends, competitor moves, keyword discovery.
- `WebFetch` — read and cite primary sources.
- Google Search Console — real query/impression data once pages are indexed
  (empty for new posts; useful after a few weeks).

## 8. How a post gets published

Posts ship as a **draft pull request** for human review and are **never
auto-merged**. Quality over volume: if nothing clears the bar on a given run,
post a short note and stop — a no-post day is a valid, expected outcome, not a
failure. (The scheduled routine that enforces this is defined separately.)
