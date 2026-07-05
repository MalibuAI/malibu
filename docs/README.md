# Mintlify docs (malibu.tech/docs)

Source for [malibu.tech/docs](https://malibu.tech/docs), proxied from the marketing site via `vercel.json` to Mintlify hosting.

## Local preview

```bash
npm run docs:dev
```

Open the URL printed by the CLI (typically `http://localhost:3000`).

## Repository layout

```
docs/
  docs.json          # Mintlify navigation + branding
  litepaper.mdx      # Default opening page (/docs)
  status.mdx         # Live vs planned ledger
  ...
docs-internal/
  ARCHITECTURE.md    # Docs IA spec (not published)
```

## Connect Mintlify to this repo

1. In [Mintlify Dashboard](https://dashboard.mintlify.com) → **Git Settings**, connect `MalibuAI/malibu`.
2. Set **Docs subpath** to `docs` (folder containing `docs.json`).
3. Confirm custom domain / deployment path matches existing `malibu.mintlify.site` project.
4. Merge this PR; Mintlify rebuilds on push to `main`.

`vercel.json` rewrites `/docs/*` → `https://malibu.mintlify.site/docs/*` on malibu.tech. No Vercel change required if the Mintlify deployment URL stays the same.

## Editing rules

See [docs-internal/ARCHITECTURE.md](../docs-internal/ARCHITECTURE.md):

- **Litepaper** stays the narrative opener — do not demote it.
- **Network status** is the shipped-features ledger.
- Reference pages (API, network, guides) are source of truth for integrators.
- When narrative and reference disagree, fix the Litepaper or add a status label — do not weaken reference pages.
