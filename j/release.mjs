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
import {
  signedDmgSha256,
  verifyReleaseChecksumsSignature,
} from './release-signature.mjs';

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

// True when `tag` (vX.Y.Z) is greater than or equal to `floor`. Used to refuse a
// runtime downgrade below the trusted build-time pin.
export function isTagAtLeast(tag, floor) {
  const parse = (value) => {
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(value);
    // BigInt so version components above Number.MAX_SAFE_INTEGER cannot miscompare.
    return match ? match.slice(1).map((part) => BigInt(part)) : null;
  };
  const a = parse(tag);
  const b = parse(floor);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
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
    // Trust the API's tag/SHA only after: (1) shape validation, (2) the tag is
    // not a downgrade below the trusted pin, (3) the release pipeline's ECDSA
    // signature over the checksum list verifies against the committed public
    // key, and (4) the displayed SHA is the one the SIGNED checksum list binds
    // to this DMG. Otherwise fall through to the verified fallback pin.
    if (
      isAcceptedMalibuDownload(body)
      && isTagAtLeast(body.tag, MALIBU_RELEASE_TAG)
      && await verifyReleaseChecksumsSignature(body.checksums, body.checksumsSig)
    ) {
      const signedSha = signedDmgSha256(body.checksums, body.tag);
      if (signedSha && signedSha === body.sha256) {
        return {
          tag: body.tag,
          // Construct the served URL locally from the validated tag and a
          // trusted host; never serve body.url verbatim.
          url: githubMalibuDownloadUrl(body.tag),
          sha256: signedSha,
        };
      }
    }
  } catch {
    // Keep the verified fallback pin. The download must still be a real DMG.
  } finally {
    clearTimeout(timeout);
  }
  return fallback;
}
