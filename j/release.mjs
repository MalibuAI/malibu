// Fallback pin for no-JS first paint and for when live Latest resolution
// fails. The /host button and /j invite flow upgrade at request time via
// /api/malibu-release, which binds GitHub Latest (immutable tag + checksums +
// provenance). scripts/verify-referral-download.mjs still gates production
// builds against this fallback so a broken pin cannot ship.
export const MALIBU_RELEASE_TAG = 'v1.8.93';
export const MALIBU_DMG_SHA256 =
  'febcbec19b6c32365cbf1053a79850f3ac9e78848775f1519b58620685604d2c';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.93/Malibu-v1.8.93.dmg';

const TAG_RE = /^v\d+\.\d+\.\d+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const DOWNLOAD_PATH =
  /^\/Augustas11\/macprovider\/releases\/download\/(v\d+\.\d+\.\d+)\/Malibu-\1\.dmg$/;

export function fallbackMalibuRelease() {
  return {
    tag: MALIBU_RELEASE_TAG,
    url: MALIBU_DOWNLOAD_URL,
    sha256: MALIBU_DMG_SHA256,
  };
}

export function isAcceptedMalibuDownload(release) {
  if (!release || typeof release !== 'object') return false;
  const { tag, url, sha256 } = release;
  if (typeof tag !== 'string' || typeof url !== 'string' || typeof sha256 !== 'string') {
    return false;
  }
  if (!TAG_RE.test(tag) || !SHA256_RE.test(sha256)) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'github.com'
    || parsed.search
    || parsed.hash
    || parsed.port
  ) {
    return false;
  }
  const match = DOWNLOAD_PATH.exec(parsed.pathname);
  return Boolean(match && match[1] === tag);
}

export async function loadPublicMalibuRelease() {
  const fallback = fallbackMalibuRelease();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/malibu-release', {
      method: 'GET',
      mode: 'same-origin',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (
      !response.ok
      || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')
    ) {
      return fallback;
    }
    const body = await response.json();
    if (isAcceptedMalibuDownload(body)) {
      return { tag: body.tag, url: body.url, sha256: body.sha256 };
    }
  } catch {
    // Keep the verified fallback pin. The download must still be a real DMG.
  } finally {
    clearTimeout(timeout);
  }
  return fallback;
}
