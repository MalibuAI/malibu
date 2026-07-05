# Mintlify docs (malibu.tech/docs)

Source for [malibu.tech/docs](https://malibu.tech/docs). Docs are **exported at Vercel build time** and served as static files from `dist/docs/` — no Mintlify GitHub org connection required.

## Local preview

```bash
npm run docs:dev
```

Mintlify dev server for editing. Open the URL printed by the CLI.

## Production build

```bash
npm run docs:build   # export → dist/docs with /docs path prefix
npm run build        # vite site + docs export
```

Vercel runs `npm run build` on deploy. `vercel.json` redirects `/docs` → `/docs/litepaper`.

## Repository layout

```
docs/
  docs.json          # Mintlify navigation + branding
  litepaper.mdx      # Default opening page (/docs)
  status.mdx         # Live vs planned ledger
  ...
scripts/build-docs.mjs
docs-internal/
  ARCHITECTURE.md    # Docs IA spec (not published)
```

## Why not Mintlify GitHub deploy?

MalibuAI org repos may not appear in Mintlify’s GitHub picker (private org + app install). Self-hosting the Mintlify **export** on Vercel avoids that dependency while keeping MDX source and `docs.json` in this repo.

Optional: a maintainer can still use Mintlify dashboard editing on a personal account; production on malibu.tech comes from this repo’s build.

## Editing rules

See [docs-internal/ARCHITECTURE.md](../docs-internal/ARCHITECTURE.md):

- **Litepaper** stays the narrative opener — do not demote it.
- **Network status** is the shipped-features ledger.
- Reference pages (API, network, guides) are source of truth for integrators.
- When narrative and reference disagree, fix the Litepaper or add a status label — do not weaken reference pages.
