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
2. Enable **Set up as monorepo** and set path to **`/docs`** (leading slash, no trailing slash).
3. Confirm **deployment branch** is `main`.
4. Confirm the GitHub App has access to this **private** repo (GitHub → Settings → Integrations → Mintlify).
5. Push to `main`; Mintlify should rebuild automatically.

`vercel.json` rewrites `/docs/*` → `https://malibu.mintlify.site/docs/*` on malibu.tech. No Vercel change required if the Mintlify deployment URL stays the same.

## If production still shows old docs

```bash
curl -sI https://malibu.mintlify.site/docs/status | grep -i x-served-version
curl -s https://malibu.tech/docs/litepaper.md | rg "coordinated inference|Network status"
```

New build includes `/docs/status` and updated Litepaper (no "live P2P" wording).

**Dashboard:** Git Settings → verify repo, monorepo `/docs`, branch `main` → check build logs or click **Deploy**.

**Optional API trigger:** add repo secrets `MINTLIFY_API_KEY` + `MINTLIFY_PROJECT_ID`, then run **Actions → Trigger Mintlify docs deploy**.

## Editing rules

See [docs-internal/ARCHITECTURE.md](../docs-internal/ARCHITECTURE.md):

- **Litepaper** stays the narrative opener — do not demote it.
- **Network status** is the shipped-features ledger.
- Reference pages (API, network, guides) are source of truth for integrators.
- When narrative and reference disagree, fix the Litepaper or add a status label — do not weaken reference pages.
