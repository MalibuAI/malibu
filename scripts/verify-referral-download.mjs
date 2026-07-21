#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { MALIBU_DOWNLOAD_URL } from '../j/release.mjs';

const VERSION = '1.8.56';
const TAG = `v${VERSION}`;
const DMG_ASSET = `Malibu-v${VERSION}.dmg`;
const CHECKSUM_ASSET = 'checksums.txt';
const PROVENANCE_ASSET = 'release-provenance.json';
const RELEASE_API_URL =
  `https://api.github.com/repos/Augustas11/macprovider/releases/tags/${TAG}`;
const GITHUB_DOWNLOAD_BASE =
  `https://github.com/Augustas11/macprovider/releases/download/${TAG}/`;
const REQUIRED_ASSETS = [DMG_ASSET, CHECKSUM_ASSET, PROVENANCE_ASSET];
const ACCEPTED_SOURCE_COMMIT = '0937d230cb7bbfe779480ffb72dbb6ea78d0a14b';
const ACCEPTED_ASSET_SHA256 = Object.freeze({
  [DMG_ASSET]: 'b5889de597363b2ecb1df823da93a5ecc555e91d75f8e5eb7208917071f1867b',
  [CHECKSUM_ASSET]: '89d1c4be78a6af75d60e5766eb43c0e6baef0a239bddaa86742cb6367c52a263',
  [PROVENANCE_ASSET]: '8f3c69469b21991666abe0c030bec8afe4b79b30cc44e1f2e4355bfc0273b1da',
});
const ACCEPTED_DOWNLOAD_URL = GITHUB_DOWNLOAD_BASE + DMG_ASSET;
const TRUSTED_API_HOSTS = new Set(['api.github.com']);
const TRUSTED_DOWNLOAD_HOSTS = new Set([
  'download.malibu.tech',
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

export function validateReferralRelease(release) {
  if (MALIBU_DOWNLOAD_URL !== ACCEPTED_DOWNLOAD_URL) {
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
  const releaseBytes = await fetchBounded(
    fetchImpl,
    RELEASE_API_URL,
    TRUSTED_API_HOSTS,
    128 * 1024,
    'application/vnd.github+json',
  );
  const release = decodeJSON(releaseBytes, 'release');
  const assets = validateReferralRelease(release);

  const [dmgBytes, checksumBytes, provenanceBytes] = await Promise.all([
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
      GITHUB_DOWNLOAD_BASE + PROVENANCE_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024,
      'application/json',
    ),
  ]);

  const dmgSHA = verifyAssetDigest(DMG_ASSET, dmgBytes, assets);
  verifyAssetDigest(CHECKSUM_ASSET, checksumBytes, assets);
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
