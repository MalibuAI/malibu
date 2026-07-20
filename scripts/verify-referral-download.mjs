#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { MALIBU_DOWNLOAD_URL } from '../j/release.mjs';

const VERSION = '1.8.43';
const TAG = `v${VERSION}`;
const DMG_ASSET = `Malibu-v${VERSION}.dmg`;
const CHECKSUM_ASSET = `${DMG_ASSET}.sha256`;
const MANIFEST_ASSET = 'candidate-manifest.json';
const RELEASE_API_URL =
  `https://api.github.com/repos/Augustas11/macprovider/releases/tags/${TAG}`;
const GITHUB_DOWNLOAD_BASE =
  `https://github.com/Augustas11/macprovider/releases/download/${TAG}/`;
const EXPECTED_ASSETS = [DMG_ASSET, CHECKSUM_ASSET, MANIFEST_ASSET];
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

function validateRelease(release) {
  if (MALIBU_DOWNLOAD_URL !== `https://download.malibu.tech/${DMG_ASSET}`) {
    throw new Error('Malibu landing download URL drifted from the release gate');
  }
  if (
    release?.tag_name !== TAG
    || release?.draft !== false
    || release?.prerelease !== false
    || release?.immutable !== true
    || !/^[0-9a-f]{40}$/.test(release?.target_commitish ?? '')
    || !Array.isArray(release?.assets)
  ) {
    throw new Error('Malibu release is not public, immutable, and source-bound');
  }

  const assets = new Map(release.assets.map((asset) => [asset?.name, asset]));
  if (
    release.assets.length !== EXPECTED_ASSETS.length ||
    assets.size !== EXPECTED_ASSETS.length
    || EXPECTED_ASSETS.some((name) => !assets.has(name))
  ) {
    throw new Error('Malibu immutable release asset set is not exact');
  }
  for (const name of EXPECTED_ASSETS) {
    const asset = assets.get(name);
    if (
      asset.browser_download_url !== GITHUB_DOWNLOAD_BASE + name
      || !/^sha256:[0-9a-f]{64}$/.test(asset.digest ?? '')
    ) {
      throw new Error(`Malibu immutable release metadata is invalid for ${name}`);
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
  const assets = validateRelease(release);

  const [dmgBytes, checksumBytes, manifestBytes] = await Promise.all([
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
      16 * 1024,
      'text/plain',
    ),
    fetchBounded(
      fetchImpl,
      GITHUB_DOWNLOAD_BASE + MANIFEST_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      64 * 1024,
      'application/json',
    ),
  ]);

  const dmgSHA = verifyAssetDigest(DMG_ASSET, dmgBytes, assets);
  verifyAssetDigest(CHECKSUM_ASSET, checksumBytes, assets);
  verifyAssetDigest(MANIFEST_ASSET, manifestBytes, assets);

  const checksum = new TextDecoder('utf-8', { fatal: true }).decode(checksumBytes);
  if (checksum !== `${dmgSHA}  ${DMG_ASSET}\n`) {
    throw new Error('Malibu checksum sidecar does not bind the public DMG');
  }

  const manifest = decodeJSON(manifestBytes, 'candidate manifest');
  if (
    manifest.schema_version !== 1
    || manifest.repository !== 'Augustas11/macprovider'
    || manifest.source_commit !== release.target_commitish
    || manifest.malibu_version !== VERSION
    || manifest.malibu_build !== 43
    || manifest.bundle_identifier !== 'tech.malibu.app'
    || manifest.team_id !== 'YF7XNRJUG4'
    || manifest.cli_tag !== 'v1.8.49'
    || manifest.cli_version !== '1.8.49'
    || manifest.dmg_asset !== DMG_ASSET
    || manifest.dmg_sha256 !== dmgSHA
    || manifest.notarization !== 'accepted'
    || manifest.stapling !== 'validated'
  ) {
    throw new Error('Malibu candidate manifest does not bind the expected release');
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
