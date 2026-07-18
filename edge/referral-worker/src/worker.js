const CANONICAL_HOST = "malibu.tech";
const COORDINATOR_ORIGIN = "https://coordinator.streamvc.live";
const CODE_PATTERN =
  /^MAL1-[SP]-[A-Za-z0-9_]{1,32}-[A-Za-z0-9_]{1,32}-[A-Z2-7]{26}$/;
const CHALLENGE_PATTERN = /^[0-9a-f]{64}$/;

const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
});

function protectedHeaders(source) {
  const headers = new Headers(source);
  headers.delete("Location");
  headers.delete("Set-Cookie");
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}

function plainResponse(status, body, extraHeaders = {}) {
  const headers = protectedHeaders({
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders,
  });
  return new Response(body, { status, headers });
}

function coordinatorOrigin(raw) {
  const candidate = new URL(raw || COORDINATOR_ORIGIN);
  if (
    candidate.origin !== COORDINATOR_ORIGIN ||
    candidate.pathname !== "/" ||
    candidate.search !== "" ||
    candidate.hash !== "" ||
    candidate.username !== "" ||
    candidate.password !== ""
  ) {
    throw new Error("invalid coordinator origin");
  }
  return candidate.origin;
}

function parseJoinRequest(request) {
  const incoming = new URL(request.url);
  if (incoming.protocol !== "https:" || incoming.hostname !== CANONICAL_HOST) {
    return { error: plainResponse(404, "Not found.") };
  }

  const prefix = "/j/";
  if (!incoming.pathname.startsWith(prefix)) {
    return { error: plainResponse(404, "Not found.") };
  }
  const code = incoming.pathname.slice(prefix.length);
  if (!CODE_PATTERN.test(code)) {
    return { error: plainResponse(404, "Not found.") };
  }

  const keys = [...incoming.searchParams.keys()];
  if (keys.some((key) => key !== "c") || incoming.searchParams.getAll("c").length > 1) {
    return { error: plainResponse(400, "Invalid invite link.") };
  }
  const challenge = incoming.searchParams.get("c");
  if (challenge !== null && !CHALLENGE_PATTERN.test(challenge)) {
    return { error: plainResponse(400, "Invalid invite link.") };
  }
  return { code, challenge };
}

export function createJoinHandler({
  fetchImpl = globalThis.fetch,
  origin = COORDINATOR_ORIGIN,
} = {}) {
  const upstreamOrigin = coordinatorOrigin(origin);

  return async function handle(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return plainResponse(405, "Method not allowed.", { Allow: "GET, HEAD" });
    }

    const parsed = parseJoinRequest(request);
    if (parsed.error) {
      return parsed.error;
    }

    const upstreamURL = new URL(`/j/${parsed.code}`, upstreamOrigin);
    if (parsed.challenge !== null) {
      upstreamURL.searchParams.set("c", parsed.challenge);
    }

    const upstreamRequest = new Request(upstreamURL, {
      method: request.method,
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });

    let upstream;
    try {
      upstream = await fetchImpl(upstreamRequest, {
        cf: {
          cacheEverything: false,
          cacheTtl: 0,
        },
      });
    } catch {
      return plainResponse(503, "Invite check unavailable.", {
        "Retry-After": "5",
      });
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      return plainResponse(503, "Invite check unavailable.", {
        "Retry-After": "5",
      });
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: protectedHeaders(upstream.headers),
    });
  };
}

export default {
  fetch(request, env) {
    try {
      return createJoinHandler({
        origin: env?.COORDINATOR_ORIGIN || COORDINATOR_ORIGIN,
      })(request);
    } catch {
      return plainResponse(503, "Invite check unavailable.", {
        "Retry-After": "5",
      });
    }
  },
};
