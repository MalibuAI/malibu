// Resolve the current GitHub Latest Malibu DMG at request time. The bytes
// always come from an immutable per-tag GitHub asset, never a mutable
// latest.dmg blob. Checksums + provenance bind the digest the page advertises
// to that same tag. The fallback pin in release.mjs is only used when this
// resolution fails (no-JS first paint, GitHub down, or a release that is not
// yet immutable). Node-only — do not import this module from the landing pages.

import { createHash } from 'node:crypto';

const REPO = 'Augustas11/macprovider';
export const LATEST_RELEASE_API_URL =
  `https://api.github.com/repos/${REPO}/releases/latest`;

const CHECKSUM_ASSET = 'checksums.txt';
const PROVENANCE_ASSET = 'release-provenance.json';
const TAG_RE = /^v\d+\.\d+\.\d+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const TRUSTED_API_HOSTS = new Set(['api.github.com']);
const TRUSTED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
]);

function githubDownloadBase(tag) {
  return `https://github.com/${REPO}/releases/download/${tag}/`;
}

function dmgNameForTag(tag) {
  return `Malibu-${tag}.dmg`;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function decodeJSON(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`latest-release received invalid ${label} JSON`);
  }
}

function decodeUTF8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`latest-release received invalid ${label} text`);
  }
}

function githubHeaders(accept) {
  const headers = {
    Accept: accept,
    'User-Agent': 'malibu-tech-latest-release',
  };
  const token = process.env.MALIBU_GITHUB_TOKEN
    || process.env.GITHUB_TOKEN
    || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchBounded(fetchImpl, url, allowedHosts, maxBytes, accept) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: githubHeaders(accept),
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
    throw new Error(`latest-release request failed for ${url}: HTTP ${response.status}`);
  }

  const reader = response.body?.getReader?.();
  if (!reader) throw new Error(`latest-release response has no body for ${url}`);
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array) || total + value.byteLength > maxBytes) {
      await reader.cancel();
      throw new Error(`latest-release response exceeded ${maxBytes} bytes for ${url}`);
    }
    total += value.byteLength;
    chunks.push(value);
  }
  if (total === 0) throw new Error(`latest-release response is empty for ${url}`);

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function assetMap(release) {
  if (!Array.isArray(release?.assets)) {
    throw new Error('latest-release assets are missing');
  }
  const assets = new Map(release.assets.map((asset) => [asset?.name, asset]));
  if (assets.size !== release.assets.length) {
    throw new Error('latest-release assets are ambiguous');
  }
  return assets;
}

export function bindLatestMalibuRelease(release, checksumText, provenance) {
  const tag = release?.tag_name;
  if (
    typeof tag !== 'string'
    || !TAG_RE.test(tag)
    || release.draft !== false
    || release.prerelease !== false
    || release.immutable !== true
    || typeof release.target_commitish !== 'string'
    || !/^[0-9a-f]{40}$/.test(release.target_commitish)
  ) {
    throw new Error('latest-release is not an immutable published Malibu tag');
  }

  const dmgAsset = dmgNameForTag(tag);
  const base = githubDownloadBase(tag);
  const assets = assetMap(release);
  for (const name of [dmgAsset, CHECKSUM_ASSET, PROVENANCE_ASSET]) {
    if (!assets.has(name)) {
      throw new Error(`latest-release is missing ${name}`);
    }
    const asset = assets.get(name);
    const digest = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')
      ? asset.digest.slice('sha256:'.length)
      : '';
    if (
      asset.browser_download_url !== base + name
      || !SHA256_RE.test(digest)
    ) {
      throw new Error(`latest-release digest is not accepted for ${name}`);
    }
  }

  const dmgSHA = assets.get(dmgAsset).digest.slice('sha256:'.length);
  if (
    typeof checksumText !== 'string'
    || !checksumText.trimEnd().split('\n').includes(`${dmgSHA}  ${dmgAsset}`)
  ) {
    throw new Error('latest-release checksum list does not bind the public DMG');
  }
  if (
    provenance?.schema_version !== 1
    || provenance.repository !== REPO
    || provenance.commit !== release.target_commitish
    || provenance.tag !== tag
    || provenance.prerelease !== false
    || provenance.assets?.[dmgAsset] !== dmgSHA
  ) {
    throw new Error('latest-release provenance does not bind the expected release');
  }

  return {
    tag,
    sha256: dmgSHA,
    url: base + dmgAsset,
    commit: release.target_commitish,
  };
}

export async function resolveLatestMalibuRelease(fetchImpl = fetch) {
  const releaseBytes = await fetchBounded(
    fetchImpl,
    LATEST_RELEASE_API_URL,
    TRUSTED_API_HOSTS,
    256 * 1024,
    'application/vnd.github+json',
  );
  const release = decodeJSON(releaseBytes, 'release');
  const tag = release?.tag_name;
  if (typeof tag !== 'string' || !TAG_RE.test(tag)) {
    throw new Error('latest-release tag is not a Malibu version');
  }
  const base = githubDownloadBase(tag);
  const assets = assetMap(release);
  const checksumMeta = assets.get(CHECKSUM_ASSET);
  const provenanceMeta = assets.get(PROVENANCE_ASSET);
  if (!checksumMeta || !provenanceMeta) {
    throw new Error('latest-release is missing checksums or provenance');
  }

  const [checksumBytes, provenanceBytes] = await Promise.all([
    fetchBounded(
      fetchImpl,
      base + CHECKSUM_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024,
      'text/plain',
    ),
    fetchBounded(
      fetchImpl,
      base + PROVENANCE_ASSET,
      TRUSTED_DOWNLOAD_HOSTS,
      128 * 1024,
      'application/json',
    ),
  ]);

  const checksumSHA = sha256Hex(checksumBytes);
  const provenanceSHA = sha256Hex(provenanceBytes);
  if (checksumMeta.digest !== `sha256:${checksumSHA}`) {
    throw new Error('latest-release checksum list digest mismatch');
  }
  if (provenanceMeta.digest !== `sha256:${provenanceSHA}`) {
    throw new Error('latest-release provenance digest mismatch');
  }

  return bindLatestMalibuRelease(
    release,
    decodeUTF8(checksumBytes, 'checksums'),
    decodeJSON(provenanceBytes, 'provenance'),
  );
}
