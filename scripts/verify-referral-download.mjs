#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { resolveLatestMalibuRelease } from '../j/latest-release.mjs';
import {
  MALIBU_DMG_SHA256,
  MALIBU_DOWNLOAD_URL,
  MALIBU_RELEASE_TAG,
} from '../j/release.mjs';

const TAG = MALIBU_RELEASE_TAG;
const VERSION = TAG.replace(/^v/, '');
const DMG_ASSET = `Malibu-v${VERSION}.dmg`;
const CHECKSUM_ASSET = 'checksums.txt';
// The runtime latest path (j/latest-release.mjs) now requires the signed
// checksum list, so the pinned release must ship it too — otherwise a release
// could pass this build gate while /api/malibu-release rejects it.
const CHECKSUM_SIG_ASSET = 'checksums.txt.sig';
const PROVENANCE_ASSET = 'release-provenance.json';
const RELEASE_API_URL =
  `https://api.github.com/repos/Augustas11/macprovider/releases/tags/${TAG}`;
const GITHUB_DOWNLOAD_BASE =
  `https://github.com/Augustas11/macprovider/releases/download/${TAG}/`;
const REQUIRED_ASSETS = [DMG_ASSET, CHECKSUM_ASSET, CHECKSUM_SIG_ASSET, PROVENANCE_ASSET];
const ACCEPTED_SOURCE_COMMIT = '37e2d232389ba37d94f138b5a7d52a12c2b12106';
const ACCEPTED_ASSET_SHA256 = Object.freeze({
  [DMG_ASSET]: '9c3538bf5ac620f3d0e576576f7c8761b965c8405ed24b0a410cbb7826d77947',
  [CHECKSUM_ASSET]: '2b24ccdab5a907a86681674359fcc68430fc93c2f7f9048b33455d1f447a06ac',
  [CHECKSUM_SIG_ASSET]: '8d9ab55df98ff8e08428955471b12ae05ca8551cc73ec5b18ee88648f628681e',
  [PROVENANCE_ASSET]: 'ef0d81181ff566883f73f93697c2edfc012ed4c15169f72b180ef07c2c270d1d',
});
const ACCEPTED_DOWNLOAD_URL = GITHUB_DOWNLOAD_BASE + DMG_ASSET;
const TRUSTED_API_HOSTS = new Set(['api.github.com']);
const TRUSTED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
]);

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchBounded(fetchImpl, url, allowedHosts, maxBytes, accept) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: accept,
      'User-Agent': 'malibu-vercel-release-gate',
    },
  });
  const finalURL = new URL(response.url || url);
  const declaredLength = response.headers.get('content-length');
  if (
    !response.ok
    || finalURL.protocol !== 'https:'
    || !allowedHosts.has(finalURL.hostname)
    || (declaredLength !== null
      && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes))
  ) {
    throw new Error(`release gate request failed for ${url}: HTTP ${response.status}`);
  }

  const reader = response.body?.getReader?.();
  if (!reader) throw new Error(`release gate response has no body for ${url}`);
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array) || total + value.byteLength > maxBytes) {
      await reader.cancel();
      throw new Error(`release gate response exceeded ${maxBytes} bytes for ${url}`);
    }
    total += value.byteLength;
    chunks.push(value);
  }
  if (total === 0) throw new Error(`release gate response is empty for ${url}`);

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeJSON(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`release gate received invalid ${label} JSON`);
  }
}

// When GitHub Latest successfully binds as a Malibu GUI release, the deploy-time
// no-JS pin must be that same tag. A lagging pin is the #1604 skew: curl of
// /host and a click before JS still serve the older DMG. If Latest cannot
// resolve (outage, non-GUI latest pointer), the accepted pin remains deploy
// authority — do not hostage production to /releases/latest.
export function assertFallbackPinMatchesResolvedLatest(resolvedTag) {
  if (typeof resolvedTag !== 'string' || resolvedTag !== MALIBU_RELEASE_TAG) {
    throw new Error(
      `fallback pin ${MALIBU_RELEASE_TAG} does not match resolved GitHub Latest ${resolvedTag}; bump MALIBU_RELEASE_TAG, host/index.html, and ACCEPTED_* before production deploy`,
    );
  }
}

export function validateReferralRelease(release) {
  if (
    MALIBU_DOWNLOAD_URL !== ACCEPTED_DOWNLOAD_URL
    || MALIBU_RELEASE_TAG !== TAG
    || MALIBU_DMG_SHA256 !== ACCEPTED_ASSET_SHA256[DMG_ASSET]
  ) {
    throw new Error('Malibu landing download URL drifted from the release gate');
  }
  if (
    release?.tag_name !== TAG
    || release?.draft !== false
    || release?.prerelease !== false
    || release?.immutable !== true
    || release?.target_commitish !== ACCEPTED_SOURCE_COMMIT
    || !Array.isArray(release?.assets)
  ) {
    throw new Error('Malibu release does not match the accepted immutable source');
  }

  const assets = new Map(release.assets.map((asset) => [asset?.name, asset]));
  if (
    assets.size !== release.assets.length
    || REQUIRED_ASSETS.some((name) => !assets.has(name))
  ) {
    throw new Error('Malibu immutable release assets are missing or ambiguous');
  }
  for (const name of REQUIRED_ASSETS) {
    const asset = assets.get(name);
    if (
      asset.browser_download_url !== GITHUB_DOWNLOAD_BASE + name
      || asset.digest !== `sha256:${ACCEPTED_ASSET_SHA256[name]}`
    ) {
      throw new Error(`Malibu immutable release digest is not accepted for ${name}`);
    }
  }
  return assets;
}

function verifyAssetDigest(name, bytes, assets) {
  const actual = sha256Hex(bytes);
  const expected = assets.get(name).digest.slice('sha256:'.length);
  if (actual !== expected) {
    throw new Error(`Malibu immutable release digest mismatch for ${name}`);
  }
  return actual;
}

export async function verifyReferralDownload(fetchImpl = fetch) {
  let latest = null;
  try {
    latest = await resolveLatestMalibuRelease(fetchImpl);
  } catch (error) {
    // Pin remains the deploy authority when Latest is down or is not a
    // conforming Malibu GUI release. Fail-close only on a successful Latest
    // that is a different tag. Log the message only — never headers or tokens.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`GitHub Latest unresolved; keeping pin: ${message}`);
  }
  if (latest !== null) {
    assertFallbackPinMatchesResolvedLatest(latest.tag);
  }

  const releaseBytes = await fetchBounded(
    fetchImpl,
    RELEASE_API_URL,
    TRUSTED_API_HOSTS,
    128 * 1024,
    'application/vnd.github+json',
  );
  const release = decodeJSON(releaseBytes, 'release');
  const assets = validateReferralRelease(release);

  const [dmgBytes, checksumBytes, checksumSigBytes, provenanceBytes] = await Promise.all([
    fetchBounded(
      fetchImpl,
      MALIBU_DOWNLOAD_URL,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024 * 1024,
      'application/octet-stream',
    ),
    fetchBounded(
      fetchImpl,
      GITHUB_DOWNLOAD_BASE + CHECKSUM_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024,
      'text/plain',
    ),
    fetchBounded(
      fetchImpl,
      GITHUB_DOWNLOAD_BASE + CHECKSUM_SIG_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      8 * 1024,
      'application/octet-stream',
    ),
    fetchBounded(
      fetchImpl,
      GITHUB_DOWNLOAD_BASE + PROVENANCE_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024,
      'application/json',
    ),
  ]);

  const dmgSHA = verifyAssetDigest(DMG_ASSET, dmgBytes, assets);
  verifyAssetDigest(CHECKSUM_ASSET, checksumBytes, assets);
  verifyAssetDigest(CHECKSUM_SIG_ASSET, checksumSigBytes, assets);
  verifyAssetDigest(PROVENANCE_ASSET, provenanceBytes, assets);

  const checksum = new TextDecoder('utf-8', { fatal: true }).decode(checksumBytes);
  if (!checksum.trimEnd().split('\n').includes(`${dmgSHA}  ${DMG_ASSET}`)) {
    throw new Error('Malibu checksum list does not bind the public DMG');
  }

  const provenance = decodeJSON(provenanceBytes, 'release provenance');
  if (
    provenance.schema_version !== 1
    || provenance.repository !== 'Augustas11/macprovider'
    || provenance.commit !== release.target_commitish
    || provenance.tag !== TAG
    || provenance.prerelease !== false
    || provenance.assets?.[DMG_ASSET] !== dmgSHA
  ) {
    throw new Error('Malibu release provenance does not bind the expected release');
  }
}

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('Skipping public referral-download gate outside Vercel production.');
    return;
  }
  await verifyReferralDownload();
  console.log('Verified immutable signed Malibu release before production build.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
