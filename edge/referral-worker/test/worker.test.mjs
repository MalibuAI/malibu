import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker, { createJoinHandler } from "../src/worker.js";

const CODE = `MAL1-P-key_1-issuer_1-${"A".repeat(26)}`;
const CHALLENGE = "a".repeat(64);

function request(path, init = {}) {
  return new Request(`https://malibu.tech${path}`, init);
}

function recordingFetch(response = new Response("upstream", {
  status: 200,
  headers: {
    "Cache-Control": "public, max-age=3600",
    "Referrer-Policy": "unsafe-url",
    "Set-Cookie": "secret=value",
  },
})) {
  const calls = [];
  return {
    calls,
    fetch: async (...args) => {
      calls.push(args);
      return response;
    },
  };
}

test("proxies an exact invite code to the coordinator", async () => {
  const recorder = recordingFetch();
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "upstream");
  assert.equal(recorder.calls.length, 1);
  const [upstreamRequest, options] = recorder.calls[0];
  assert.equal(upstreamRequest.url, `https://coordinator.streamvc.live/j/${CODE}`);
  assert.equal(upstreamRequest.method, "GET");
  assert.deepEqual([...upstreamRequest.headers], [
    ["accept", "text/html,application/xhtml+xml"],
  ]);
  assert.deepEqual(options.cf, { cacheEverything: false, cacheTtl: 0 });
});

test("preserves only the exact lowercase X challenge", async () => {
  const recorder = recordingFetch();
  await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}?c=${CHALLENGE}`),
  );
  assert.equal(
    recorder.calls[0][0].url,
    `https://coordinator.streamvc.live/j/${CODE}?c=${CHALLENGE}`,
  );
});

test("rejects malformed codes without contacting the coordinator", async () => {
  for (const path of [
    `/j/MAL1-P-key-issuer-${"A".repeat(25)}`,
    `/j/MAL1-P-key-issuer-${"a".repeat(26)}`,
    `/j/MAL1-X-key-issuer-${"A".repeat(26)}`,
    `/j/${CODE}/extra`,
    `/j/${CODE}%2Fextra`,
    "/j/",
    "/",
  ]) {
    const recorder = recordingFetch();
    const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
      request(path),
    );
    assert.equal(response.status, 404, path);
    assert.equal(recorder.calls.length, 0, path);
  }
});

test("rejects unknown, duplicate, and malformed query parameters", async () => {
  for (const query of [
    "?utm_source=x",
    `?c=${CHALLENGE}&utm_source=x`,
    `?c=${CHALLENGE}&c=${CHALLENGE}`,
    `?c=${"A".repeat(64)}`,
    `?c=${"a".repeat(63)}`,
    "?c=",
  ]) {
    const recorder = recordingFetch();
    const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
      request(`/j/${CODE}${query}`),
    );
    assert.equal(response.status, 400, query);
    assert.equal(recorder.calls.length, 0, query);
  }
});

test("forwards neither credentials nor referrer information", async () => {
  const recorder = recordingFetch();
  await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`, {
      headers: {
        Authorization: "Bearer do-not-forward",
        Cookie: "session=do-not-forward",
        Referer: "https://example.test/private",
        "User-Agent": "fingerprint",
      },
    }),
  );

  const headers = recorder.calls[0][0].headers;
  assert.equal(headers.get("Authorization"), null);
  assert.equal(headers.get("Cookie"), null);
  assert.equal(headers.get("Referer"), null);
  assert.equal(headers.get("User-Agent"), null);
});

test("forces privacy headers and removes origin cookies", async () => {
  const recorder = recordingFetch();
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`),
  );

  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
  assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("supports HEAD without a response body", async () => {
  const recorder = recordingFetch();
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`, { method: "HEAD" }),
  );
  assert.equal(response.status, 200);
  assert.equal(recorder.calls[0][0].method, "HEAD");
  assert.equal(await response.text(), "");
});

test("rejects unsupported methods before parsing invite data", async () => {
  const recorder = recordingFetch();
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`, { method: "POST" }),
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
  assert.equal(recorder.calls.length, 0);
});

test("fails closed without exposing invite data on origin failure", async () => {
  const handler = createJoinHandler({
    fetchImpl: async () => {
      throw new Error(`failure for ${CODE}`);
    },
  });
  const response = await handler(request(`/j/${CODE}`));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal((await response.text()).includes(CODE), false);
});

test("does not pass origin redirects or Location headers to the browser", async () => {
  const recorder = recordingFetch(
    new Response(null, {
      status: 302,
      headers: { Location: `https://coordinator.streamvc.live/j/${CODE}` },
    }),
  );
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    request(`/j/${CODE}`),
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Location"), null);
});

test("rejects the www host without leaking the path to Vercel", async () => {
  const recorder = recordingFetch();
  const response = await createJoinHandler({ fetchImpl: recorder.fetch })(
    new Request(`https://www.malibu.tech/j/${CODE}`),
  );
  assert.equal(response.status, 404);
  assert.equal(recorder.calls.length, 0);
});

test("pins the only configurable origin to the production coordinator", () => {
  assert.throws(
    () => createJoinHandler({ origin: "https://example.test" }),
    /invalid coordinator origin/,
  );
  assert.throws(
    () => createJoinHandler({ origin: "https://coordinator.streamvc.live/path" }),
    /invalid coordinator origin/,
  );
});

test("the deployed entrypoint fails closed when its origin binding drifts", async () => {
  const response = await worker.fetch(request(`/j/${CODE}`), {
    COORDINATOR_ORIGIN: "https://example.test",
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal((await response.text()).includes(CODE), false);
});

test("configuration has no catch-all route, preview endpoint, or observability", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.observability, { enabled: false });
  assert.deepEqual(
    config.routes.map((route) => route.pattern),
    ["malibu.tech/j/*", "www.malibu.tech/j/*"],
  );
  assert.equal(
    config.vars.COORDINATOR_ORIGIN,
    "https://coordinator.streamvc.live",
  );

  const source = await readFile(
    new URL("../src/worker.js", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("console."), false);
});
