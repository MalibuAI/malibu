# Malibu Agent Guide

This file is the canonical instruction surface for coding agents working in the
Malibu web repo. Keep root guidance compact; put page-specific or channel-
specific rules near the files they govern.

## Project Overview

Malibu is the public web, docs, console, provider-host, and blog surface for the
Malibu distributed inference network. It is a Vite/Node static site with custom
build scripts for blog posts, docs, referral/download checks, and generated
assets.

## Project Structure

- `src/` - shared site source.
- `console/` - buyer console pages, auth, dashboard, keys, team, and UI views.
- `host/` - provider host and troubleshooting pages.
- `docs/` - public docs source.
- `docs-internal/` - internal docs that must not leak into public copy.
- `blog/` - generated blog pages plus `blog/posts/*.md` source posts.
- `scripts/` - build, blog, docs, referral, and validation scripts.
- `test/` - Node test files.
- `public/` - public static assets.
- `dist/` - generated output; do not edit by hand.

## Setup And Commands

```bash
npm install
npm run dev             # Vite dev server on 127.0.0.1
npm run build           # blog build, Vite build, docs build
npm test                # node --test test/*.test.mjs
npm run blog:build      # regenerate blog pages, sitemap, and feed
npm run blog:lint       # validate blog content
npm run blog:stats      # live Malibu network numbers for blog claims
npm run docs:validate   # validate docs claims
npm run preview         # local preview server on 127.0.0.1
```

Run the narrowest command that proves your change while iterating, then
`npm run build` before opening a PR when generated output or public pages are
affected.

## Generated Files

Do not hand-edit generated files:

- `dist/**`
- `blog/index.html`
- `blog/<slug>/index.html`
- `sitemap.xml`
- `feed.xml`

For blog posts, edit only `blog/posts/<slug>.md`, then run
`npm run blog:build`. For docs, edit source docs and run the docs build or
validation command.

## Code Style

- Keep the site fast, static, and simple; prefer existing scripts and patterns.
- Use plain Node/Vite conventions already present in the repo.
- Do not add dependencies without explicit approval.
- Do not reformat unrelated files.
- Public copy should be specific, sourced, and free of hype.

## Brand And Public-Content Boundaries

- Malibu is the public product name. Public pages should use Malibu-branded
  URLs such as `https://malibu.tech`, `https://api.malibu.tech/v1`, and
  `https://malibu.tech/docs`.
- Do not expose internal MacProvider, `streamvc`, coordinator, stats, console,
  or operator hostnames in public copy.
- Do not present payouts as investment returns, yield, ROI, dividends,
  interest, guaranteed income, passive income, or projected earnings.
- Source competitor claims and live network numbers. If a fact cannot be
  verified, soften it or remove it.
- Search public copy for `streamvc`, `MacProvider`, and internal hostnames
  before opening a PR that changes marketing, docs, or blog text.

## Blog Work

`blog/CLAUDE.md` contains the detailed blog house style and authoring guide.
Read it before editing `blog/posts/**` or generated blog surfaces. The short
version:

- One post source file lives at `blog/posts/<slug>.md`.
- Clear the thesis, so-what, only-we angle, and depth gate before drafting.
- Use `npm run blog:stats` for live network numbers; never invent stats.
- Run `npm run blog:build`, `npm run blog:lint`, and `npm run build` before a
  blog PR.

## Git Workflow

Use one branch per task, named by scope such as `docs/...`, `fix/...`, or
`feat/...`. Start new work from fresh `origin/main`:

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b <scope>/<short-name>
```

Before pushing, `git log origin/main..HEAD` must contain only commits for the
current task. If the branch is polluted or already tied to another PR,
cherry-pick the clean commits onto a fresh branch from `origin/main`.

Before push or PR:

```bash
git fetch origin
git status
git branch -vv
gh pr list --head "$(git branch --show-current)" --state all
```

Auto-merge only when all required CI checks are green, there are no unresolved
conflicts, and the user has not asked to hold the PR. After merge, delete the
remote branch and sync local `main`.

## Verification

- Public site/page change: `npm run build`.
- Blog change: `npm run blog:build`, `npm run blog:lint`, then `npm run build`.
- Docs change: `npm run docs:validate` and `npm run build` when public docs are
  affected.
- Script or test change: `npm test` plus the targeted script command.

Do not claim a skipped, interrupted, or timed-out command passed. Report the
exact command and result.
