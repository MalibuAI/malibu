# Referral edge route

This Worker owns only the public invite path:

```text
https://malibu.tech/j/<code>[?c=<challenge>]
    -> Cloudflare Worker
    -> https://coordinator.streamvc.live/j/<code>[?c=<challenge>]
```

The browser URL remains on `malibu.tech`. No catch-all Worker route exists.
Every other `malibu.tech` and `www.malibu.tech` request continues through the
proxied DNS records to the existing Vercel project. The Worker never fetches
`malibu.tech`, so it cannot recurse through itself.

## Security contract

- Only `GET` and `HEAD` are accepted.
- Invite codes must match the shipping `MAL1-<S|P>-...` format exactly.
- The only accepted query is one lowercase 64-hex `c` challenge.
- `Cookie`, `Authorization`, `Referer`, user-agent, and other incoming headers
  are not forwarded. The origin receives only a fixed `Accept` header.
- Origin redirects and cookies are not exposed to the browser.
- Every response is `no-store`, `no-referrer`, framed-denied, and non-indexable.
- Origin errors return a generic response that does not echo the code.
- Worker observability and the `workers.dev` endpoint are disabled. Do not add
  `console` logging, Workers Analytics Engine, or a Cloudflare Logpush rule for
  `/j/*`.
- The coordinator's exact `/j/` nginx location must keep `access_log off`.

Run the focused tests from the repository root:

```sh
node --test edge/referral-worker/test/*.test.mjs
```

## Production cutover checklist

No command in this directory deploys automatically. Perform the following only
with Cloudflare, Name.com, Vercel, and coordinator operator authority.

### Before changing nameservers

1. Export the complete Name.com zone and keep it as the rollback artifact.
2. Create the `malibu.tech` Cloudflare zone and import every record. Compare the
   record sets manually, including MX, TXT, CAA, DKIM, DMARC, verification,
   download, API, coordinator, stats, and any wildcard records.
3. Keep mail, verification, and service records DNS-only unless their operator
   explicitly approves proxying.
4. Preserve the existing website origins:
   - apex `malibu.tech` -> Vercel `76.76.21.21`, proxied;
   - `www.malibu.tech` -> `cname.vercel-dns.com`, proxied.
5. Keep the `malibu.tech` and `www.malibu.tech` domain bindings on the existing
   Vercel `malibu` project. Do not point the Worker at either hostname.
6. Deploy this Worker and attach only the two routes in `wrangler.jsonc`.
7. Add a Cloudflare WAF rate limit for `malibu.tech/j/*` before the Worker. Do
   not enable request logging or Logpush for the invite path.
8. On the coordinator, deploy the exact `/j/` handler, keep nginx access logging
   disabled for it, and set `join_base_url: https://malibu.tech/j`.
9. Confirm the coordinator origin returns `no-store`, `no-referrer`, CSP,
   frame-denial, and generic invalid/unavailable states before public routing.

### Cut over and verify

1. Replace the Name.com nameservers with the assigned Cloudflare nameservers.
   Keep the old Name.com zone unchanged during the validation window.
2. Confirm DNSSEC state is consistent before enabling a new DS record.
3. Verify `/`, `/host`, `/docs`, and existing API rewrites still reach the same
   Vercel deployment and that no catch-all Worker invocation occurs.
4. Verify malformed and invalid `/j/` requests are non-cacheable and never
   reach Vercel.
5. Verify one real unconsumed invite in desktop and mobile browsers. Confirm the
   address bar remains `malibu.tech`, copy/download actions work, and the page
   is absent from Vercel, Worker, Cloudflare Logpush, and nginx access logs.
6. Verify an exact X share URL with one `c` challenge survives unchanged and is
   accepted by the coordinator verifier after X expansion.
7. Confirm Cloudflare cache status never reports a cached `/j/*` response.

### Rollback

1. Disable the two Worker routes first. This immediately removes the Worker
   from the invite path; referral activation must also be disabled because
   Vercel intentionally has no privacy-compatible `/j/*` fallback.
2. Leave the Vercel apex/www DNS records in place so the rest of the website
   stays available.
3. If the zone import or general website routing is incorrect, restore the
   original Name.com nameservers using the preserved zone. Do not delete the
   Cloudflare zone until DNS propagation and Vercel behavior are verified.
4. Restore the previous coordinator `join_base_url` and referral flags as one
   operator rollback. Existing referral redemptions remain durable.
