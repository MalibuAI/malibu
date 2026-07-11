# Malibu PSEO — Automated SEO Content Drip

**Status:** Phases 1–2 merged (#33, #35); Phase 3 scaffolded, awaiting secrets · **Owner:** Augustas · **Doc created:** 2026-07-11

A proposal + build plan to give malibu.tech an unattended, quality-gated blog-content
routine, modeled on the Jellypod "PSEO daily content drip" workflow.

---

## 1. The workflow we're modeling

Jellypod runs an unattended Claude scheduled agent ("Routine") that behaves like a
disciplined junior content writer:

| Element | Behavior | Why it matters |
|---|---|---|
| Trigger | Cloud cron, daily | No human kicks it off |
| Guardrail | Ships **ONE** article as a **draft PR**, DMs founder, **never merges** | Human-in-the-loop; nothing bad ships |
| Quality gate | "If nothing clears the bar, post a note and stop" | No-junk days are allowed and expected |
| House style | Reads `CLAUDE.md` first and obeys it | Voice + brand rules enforced in code |
| Core principle | "Good SEO is good content" — write for humans, not bots | Matches how Google/ChatGPT/Perplexity rank now |
| Data sources | Ahrefs (keywords), PostHog+Supabase (real product data, read-only), WebSearch, WebFetch | Every article is grounded in real numbers + a real product angle |

The value is the **operating envelope** — draft-only, quality-gated, brand-constrained,
data-grounded — not the writing itself. That's what makes it safe to run unattended.

## 2. Where malibu stands (gap analysis, 2026-07-11)

Malibu's blog is a **Vite static multi-page site on Vercel** (`MalibuAI/malibu`).
It differs from Jellypod's Next.js/MDX setup in ways that shape the whole plan:

- **Content model is hand-rolled HTML.** Each post is a full `blog/<slug>/index.html`
  (~250 lines of inline-styled HTML).
- **Three manual edits per post:** write the HTML, register it in `vite.config.js`
  `rollupOptions.input`, and hand-paste a card into `blog/index.html`. This is the #1
  blocker to safe automation.
- **SEO plumbing ~40% present.** Has `og:` + Twitter tags. **Missing:** `sitemap.xml`,
  `robots.txt`, JSON-LD structured data, `canonical`, RSS feed, marketing-site `llms.txt`.
- **No analytics installed** (no PostHog/GA/Plausible). But real network data exists behind
  `stats.streamvc.live/v1/stats` and coordinator earnings endpoints — that's the honest
  "real product angle" data source.
- **No house-style `CLAUDE.md`.** Nothing codifies brand rules (e.g. never expose
  MacProvider / streamvc.live in the UI; Malibu is standalone).
- **Good foundations:** posts already ship as PRs (#11/#14/#16), Vercel preview deploys,
  an existing Node build-script + CI pattern (`scripts/*.mjs`, `docs-build.yml`), and a
  strong, consistent design system (`/src/styles.css`, brand palette).

**Takeaway:** ~60% of this project is building the content pipeline + SEO plumbing that
Next.js gave Jellypod for free. The routine is the easy last 40%.

## 3. Locked decisions (2026-07-11)

| Decision | Choice | Notes |
|---|---|---|
| Content model | **Markdown → HTML pipeline** | Agent writes ONE `.md` file; script generates HTML + index + sitemap + feed |
| SEO keyword data | **Free: Google Search Console + WebSearch** | GSC is empty until pages index (~weeks); early posts run on WebSearch + own network data |
| Notifications | **Telegram** | Needs a bot token (@BotFather) + chat ID — owner-created creds |
| Cadence | **2–3×/week (Mon/Wed/Fri)**, assumed | An early site has fewer genuine angles; quality over volume |
| Merge policy | **Draft PR, never auto-merge** | Human-in-the-loop for at least the first ~10 posts |

## 4. Architecture

```
PHASE 1 — FOUNDATION (useful regardless of AI)
  Content pipeline            SEO plumbing
  blog/posts/<slug>.md  ───►  sitemap.xml · robots.txt · JSON-LD
  scripts/build-blog.mjs      canonical · blog/feed.xml · llms.txt
  → blog/<slug>/index.html
  → regenerated blog/index.html
  → glob-based Vite input (no vite.config edits per post)

PHASE 2 — HOUSE STYLE + DATA
  blog/CLAUDE.md (voice + brand hard-rules + SEO checklist + honesty rules)
  keyword/topic backlog · point routine at malibu's own stats API for real numbers

PHASE 3 — THE ROUTINE
  Scheduled Claude agent → research → draft ONE post → npm run blog:build
  → draft PR → Telegram notify → NEVER merge → if nothing clears bar, notify + stop
```

### Content pipeline contract

A post is one Markdown file at `blog/posts/<slug>.md`:

```markdown
---
title: Turning on the world's biggest AI cloud
headline: Turning on the world's biggest AI cloud.   # optional; h1 display, defaults to title
category: Manifesto
date: 2026-07-06
description: <meta description, ~150 chars>
ogTitle: <optional, defaults to title>
ogDescription: <optional, defaults to description>
lede: <the large intro paragraph>
excerpt: <optional card text, defaults to lede then description>
heroImage: /images/brand/blog-hero-macbook-sunset-mesh.jpg   # optional
heroAlt: <descriptive alt text>
keywords: [apple silicon ai, decentralized inference]         # optional
canonical: <optional, defaults to https://malibu.tech/blog/<slug>/>
draft: false                                                  # optional; true = excluded from index/sitemap
---

Body in Markdown. ## headings, paragraphs, - lists, **bold**, *italic*,
`inline code`, fenced code blocks, and [links](https://...).
```

`npm run blog:build` then:
1. Renders each non-draft post into `blog/<slug>/index.html` using the shared template
   (nav, `.post-body` styles, footer, canonical, OG tags, JSON-LD, standard CTA grid).
2. Regenerates `blog/index.html` cards (newest first).
3. Emits `public/sitemap.xml` and `public/blog/feed.xml`.
4. `vite build` discovers blog HTML via glob — **no `vite.config.js` edit per post**.

## 5. Connector / tooling mapping (malibu ≠ Jellypod)

| Jellypod | malibu equivalent | Status |
|---|---|---|
| Ahrefs (keywords) | Google Search Console + WebSearch | Free; GSC useful after indexing |
| PostHog + Supabase (real data) | Own `stats.streamvc.live/v1/stats` + coordinator earnings | Honest numbers from own API |
| Linear (backlog) | `blog/ideas.md` (committed topic/keyword backlog) | To create in Phase 2 |
| Slack (notify) | **Telegram** bot | Owner creates bot token + chat ID |
| Vercel (previews) | Vercel | Already wired — draft PRs get preview URLs |
| GitHub (PR) | `gh pr create --draft` | Already used for posts |

## 6. Testing plan

1. **Pipeline:** hand-write `blog/posts/test.md`, run `npm run blog:build`, confirm render
   in dev preview (port 5173), sitemap/JSON-LD validate, `npm run build` stays green.
2. **Agent dry-runs (2–3×, manual):** run the routine prompt interactively, review draft
   PRs by hand, tune `CLAUDE.md` until output clears the bar without edits.
3. **Guardrails:** confirm draft (not ready) PR, confirm "nothing good today → stop" path,
   confirm it never touches `main`.
4. **SEO:** Lighthouse SEO score, Google Rich Results test on JSON-LD, verify preview
   meta/OG render.

## 7. Launch (phased)

- **Week 1:** Phase 1 (pipeline + SEO plumbing) — ship as normal human-authored PRs.
- **Week 2:** Phase 2 (`CLAUDE.md` + topic backlog + stats API wiring) + manual dry-runs.
- **Week 3:** Enable the scheduled routine in draft-PR + Telegram-notify mode; human merge
  for the first ~10 posts.
- **Later:** Consider auto-merge behind CI/Lighthouse gates only after trust is established
  (Jellypod deliberately never does this; recommend staying manual).

## 8. Owner action items (creds / accounts — cannot be automated)

Phase 3 is built (`.github/workflows/blog-drip.yml`, `blog/drip-routine.md`,
`scripts/blog-drip-notify.mjs`). To activate it:

- [ ] Create a Telegram bot via **@BotFather**; capture the bot token + chat ID.
- [ ] Add repo secrets (Settings → Secrets → Actions): **`ANTHROPIC_API_KEY`**,
      **`TELEGRAM_BOT_TOKEN`**, **`TELEGRAM_CHAT_ID`**. Optional **`DRIP_PAT`**
      (fine-grained PAT, contents+PR write) so CI runs on the drip's PRs.
- [ ] First run: trigger the workflow manually (**Run workflow** / `workflow_dispatch`)
      and watch the Actions log before trusting the schedule.
- [ ] Verify the **malibu.tech** property in Google Search Console (for keyword data).
- [ ] Confirm cadence (default Mon/Wed/Fri 16:00 UTC ≈ 09:00 PT; edit the cron).

## 9. Open flags

- The existing blog footer links to `github.com/Augustas11/macprovider`. Auto-memory says
  never expose MacProvider in the UI. The pipeline **preserves the existing footer as-is**;
  flag for a separate decision on whether to change it (not changed silently here).

---

*Phase 1 build manifest is tracked in the PR on branch `feat/blog-pipeline-pseo`.*
