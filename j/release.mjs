// Fallback pin for no-JS first paint and for when live Latest resolution
// fails. The /host button and /j invite flow upgrade at request time via
// /api/malibu-release, which binds GitHub Latest (immutable tag + checksums +
// provenance). scripts/verify-referral-download.mjs still gates production
// builds against the GitHub bytes so a broken pin cannot ship.
//
// Downloads are served from the immutable GitHub release asset, with the URL
// always constructed locally (githubMalibuDownloadUrl) from a trusted host and a
// validated tag — the API supplies only the tag and displayed SHA-256, never the
// served URL verbatim. The branded download.malibu.tech mirror is intentionally
// not used here: it lags releases and cannot host the current build while the
// frozen-Sparkle-bridge publish gate is being retired, so rewriting to it
// produced 404s. publicMalibuDownloadUrl and the branded validator branch remain
// only so isAcceptedMalibuDownload still accepts a branded URL if the API ever
// returns one.
export const MALIBU_RELEASE_TAG = 'v1.8.122';
export const MALIBU_DMG_SHA256 =
  '05ae1188488a95a29f13f952bbcd4f49e06f968694ab82c1b4414c0daa62b9d3';
export const MALIBU_DOWNLOAD_URL =
  'https://github.com/Augustas11/macprovider/releases/download/v1.8.122/Malibu-v1.8.122.dmg';

const TAG_RE = /^v\d+\.\d+\.\d+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const GITHUB_DOWNLOAD_PATH =
  /^\/Augustas11\/macprovider\/releases\/download\/(v\d+\.\d+\.\d+)\/Malibu-\1\.dmg$/;
const BRANDED_DOWNLOAD_PATH = /^\/Malibu-(v\d+\.\d+\.\d+)\.dmg$/;

export function publicMalibuDownloadUrl(tag = MALIBU_RELEASE_TAG) {
  return `https://download.malibu.tech/Malibu-${tag}.dmg`;
}

// The served download URL is always locally constructed from a trusted host and
// a validated tag, never taken verbatim from the API response. Only the tag (and
// the displayed SHA-256) come from /api/malibu-release; the host and path are
// fixed here so a compromised API cannot point the button at an arbitrary asset.
export function githubMalibuDownloadUrl(tag = MALIBU_RELEASE_TAG) {
  return `https://github.com/Augustas11/macprovider/releases/download/${tag}/Malibu-${tag}.dmg`;
}

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
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || parsed.port
  ) {
    return false;
  }
  if (parsed.hostname === 'github.com') {
    const match = GITHUB_DOWNLOAD_PATH.exec(parsed.pathname);
    return Boolean(match && match[1] === tag);
  }
  if (parsed.hostname === 'download.malibu.tech') {
    const match = BRANDED_DOWNLOAD_PATH.exec(parsed.pathname);
    return Boolean(match && match[1] === tag);
  }
  return false;
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
      return {
        tag: body.tag,
        // Construct the served URL locally from the validated tag and a trusted
        // host; never serve body.url verbatim (defense in depth against a
        // compromised same-origin API rolling users to an arbitrary asset).
        url: githubMalibuDownloadUrl(body.tag),
        sha256: body.sha256,
      };
    }
  } catch {
    // Keep the verified fallback pin. The download must still be a real DMG.
  } finally {
    clearTimeout(timeout);
  }
  return fallback;
}
