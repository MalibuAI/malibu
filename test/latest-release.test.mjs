import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  bindLatestMalibuRelease,
  LATEST_RELEASE_API_URL,
  resolveLatestMalibuRelease,
} from '../j/latest-release.mjs';
import {
  fallbackMalibuRelease,
  githubMalibuDownloadUrl,
  isAcceptedMalibuDownload,
  isTagAtLeast,
  loadPublicMalibuRelease,
  MALIBU_DOWNLOAD_URL,
  MALIBU_RELEASE_TAG,
  publicMalibuDownloadUrl,
} from '../j/release.mjs';

const TAG = 'v1.8.99';
const DMG = `Malibu-${TAG}.dmg`;
const COMMIT = 'a'.repeat(40);
const DMG_SHA = 'b'.repeat(64);
const CHECKSUM_TEXT = `${DMG_SHA}  ${DMG}\n`;
// Opaque signature bytes: the resolve path only checks this asset's digest; the
// cryptographic verification happens client-side and is covered with real signed
// data in release-signature.test.mjs and the loadPublicMalibuRelease test below.
const CHECKSUM_SIG = 'test-detached-signature-bytes';
// Real, immutable signed sample from release v1.8.123 (verifies against the
// release public key committed in j/release-signature.mjs).
const SIGNED_TAG = 'v1.8.123';
const SIGNED_DMG_SHA = '9c3538bf5ac620f3d0e576576f7c8761b965c8405ed24b0a410cbb7826d77947';
const SIGNED_CHECKSUMS = readFileSync(
  new URL('./fixtures/release-v1.8.123.checksums.txt', import.meta.url),
  'utf8',
);
const SIGNED_CHECKSUMS_SIG = readFileSync(
  new URL('./fixtures/release-v1.8.123.checksums.txt.sig.base64', import.meta.url),
  'utf8',
).trim();
const PROVENANCE = {
  schema_version: 1,
  repository: 'Augustas11/macprovider',
  commit: COMMIT,
  tag: TAG,
  prerelease: false,
  assets: { [DMG]: DMG_SHA },
};

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function bytesFrom(text) {
  return new TextEncoder().encode(text);
}

function fakeResponse(url, body, contentType = 'application/json') {
  const bytes = typeof body === 'string' ? bytesFrom(body) : body;
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
    }),
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: bytes };
          },
          async cancel() {},
        };
      },
    },
  };
}

function latestReleaseJSON(overrides = {}) {
  const checksumSHA = sha256(CHECKSUM_TEXT);
  const provenanceSHA = sha256(JSON.stringify(PROVENANCE));
  const base = `https://github.com/Augustas11/macprovider/releases/download/${TAG}/`;
  return {
    tag_name: TAG,
    draft: false,
    prerelease: false,
    immutable: true,
    target_commitish: COMMIT,
    assets: [
      {
        name: DMG,
        browser_download_url: base + DMG,
        digest: `sha256:${DMG_SHA}`,
      },
      {
        name: 'checksums.txt',
        browser_download_url: base + 'checksums.txt',
        digest: `sha256:${checksumSHA}`,
      },
      {
        name: 'checksums.txt.sig',
        browser_download_url: base + 'checksums.txt.sig',
        digest: `sha256:${sha256(CHECKSUM_SIG)}`,
      },
      {
        name: 'release-provenance.json',
        browser_download_url: base + 'release-provenance.json',
        digest: `sha256:${provenanceSHA}`,
      },
    ],
    ...overrides,
  };
}

test('isAcceptedMalibuDownload allows GitHub and versioned branded DMGs', () => {
  assert.equal(isAcceptedMalibuDownload(fallbackMalibuRelease()), true);
  assert.equal(fallbackMalibuRelease().url, MALIBU_DOWNLOAD_URL);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: `https://github.com/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
    sha256: DMG_SHA,
  }), true);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: publicMalibuDownloadUrl(TAG),
    sha256: DMG_SHA,
  }), true);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: 'https://download.malibu.tech/latest.dmg',
    sha256: DMG_SHA,
  }), false);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: 'https://download.malibu.tech/Malibu.dmg',
    sha256: DMG_SHA,
  }), false);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: `https://evil.test/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
    sha256: DMG_SHA,
  }), false);
  assert.equal(isAcceptedMalibuDownload({
    tag: 'v1.8.90',
    url: `https://github.com/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
    sha256: DMG_SHA,
  }), false);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: `https://download.malibu.tech/Malibu-v1.8.90.dmg`,
    sha256: DMG_SHA,
  }), false);
});

test('bindLatestMalibuRelease requires an immutable published tag bound to checksums', () => {
  const release = latestReleaseJSON();
  const bound = bindLatestMalibuRelease(release, CHECKSUM_TEXT, PROVENANCE);
  assert.equal(bound.tag, TAG);
  assert.equal(bound.sha256, DMG_SHA);
  assert.equal(
    bound.url,
    `https://github.com/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
  );

  assert.throws(
    () => bindLatestMalibuRelease({ ...release, prerelease: true }, CHECKSUM_TEXT, PROVENANCE),
    /not an immutable published Malibu tag/,
  );
  assert.throws(
    () => bindLatestMalibuRelease({ ...release, immutable: false }, CHECKSUM_TEXT, PROVENANCE),
    /not an immutable published Malibu tag/,
  );
  assert.throws(
    () => bindLatestMalibuRelease(release, `${'0'.repeat(64)}  ${DMG}\n`, PROVENANCE),
    /checksum list does not bind the public DMG/,
  );
});

test('resolveLatestMalibuRelease fetches Latest and binds checksums without downloading the DMG', async () => {
  const release = latestReleaseJSON();
  const checksumSHA = sha256(CHECKSUM_TEXT);
  const provenanceJSON = JSON.stringify(PROVENANCE);
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    if (String(url) === LATEST_RELEASE_API_URL) {
      return fakeResponse(url, JSON.stringify(release));
    }
    if (String(url).endsWith('/checksums.txt.sig')) {
      return fakeResponse(url, CHECKSUM_SIG, 'application/octet-stream');
    }
    if (String(url).endsWith('/checksums.txt')) {
      return fakeResponse(url, CHECKSUM_TEXT, 'text/plain');
    }
    if (String(url).endsWith('/release-provenance.json')) {
      return fakeResponse(url, provenanceJSON);
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const bound = await resolveLatestMalibuRelease(fetchImpl);
  assert.equal(bound.tag, TAG);
  assert.equal(bound.sha256, DMG_SHA);
  assert.equal(bound.checksums, CHECKSUM_TEXT);
  assert.equal(bound.checksumsSig, Buffer.from(CHECKSUM_SIG).toString('base64'));
  assert.equal(seen.includes(LATEST_RELEASE_API_URL), true);
  assert.equal(seen.some((url) => url.endsWith(`/${DMG}`)), false);
  assert.equal(checksumSHA.length, 64);
});

const respondJSON = (body) => async () => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json' },
});

test('isTagAtLeast compares versions numerically, including huge components', () => {
  assert.equal(isTagAtLeast('v1.8.122', 'v1.8.122'), true);
  assert.equal(isTagAtLeast('v1.8.123', 'v1.8.122'), true);
  assert.equal(isTagAtLeast('v1.9.0', 'v1.8.999'), true);
  assert.equal(isTagAtLeast('v2.0.0', 'v1.99.99'), true);
  assert.equal(isTagAtLeast('v1.8.121', 'v1.8.122'), false);
  assert.equal(isTagAtLeast('v1.7.999', 'v1.8.0'), false);
  // components beyond Number.MAX_SAFE_INTEGER must not miscompare
  assert.equal(isTagAtLeast('v9007199254740992.0.0', 'v9007199254740993.0.0'), false);
  assert.equal(isTagAtLeast('v9007199254740994.0.0', 'v9007199254740993.0.0'), true);
  // malformed tags never satisfy the floor
  assert.equal(isTagAtLeast('1.8.123', 'v1.8.122'), false);
  assert.equal(isTagAtLeast('v1.8', 'v1.8.122'), false);
  assert.equal(isTagAtLeast('vX.Y.Z', 'v1.8.122'), false);
});

test('loadPublicMalibuRelease upgrades only to a signature-verified release', async () => {
  const original = globalThis.fetch;
  const honest = {
    tag: SIGNED_TAG,
    url: githubMalibuDownloadUrl(SIGNED_TAG),
    sha256: SIGNED_DMG_SHA,
    checksums: SIGNED_CHECKSUMS,
    checksumsSig: SIGNED_CHECKSUMS_SIG,
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), '/api/malibu-release');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return new Response(JSON.stringify(honest), {
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const got = await loadPublicMalibuRelease();
    assert.deepEqual(got, {
      tag: SIGNED_TAG,
      url: githubMalibuDownloadUrl(SIGNED_TAG),
      sha256: SIGNED_DMG_SHA,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('loadPublicMalibuRelease falls back to the pin on dishonest, unsigned, or downgrade responses', async () => {
  const original = globalThis.fetch;
  const fallback = fallbackMalibuRelease();
  const cases = [
    // non-GitHub/branded latest.dmg — rejected by shape validation
    { tag: SIGNED_TAG, url: 'https://download.malibu.tech/latest.dmg', sha256: SIGNED_DMG_SHA,
      checksums: SIGNED_CHECKSUMS, checksumsSig: SIGNED_CHECKSUMS_SIG },
    // valid shape + real signature, but the advertised sha is not the one the
    // signed checksum list binds to this DMG
    { tag: SIGNED_TAG, url: githubMalibuDownloadUrl(SIGNED_TAG), sha256: 'a'.repeat(64),
      checksums: SIGNED_CHECKSUMS, checksumsSig: SIGNED_CHECKSUMS_SIG },
    // signature does not verify (tampered checksum list)
    { tag: SIGNED_TAG, url: githubMalibuDownloadUrl(SIGNED_TAG), sha256: SIGNED_DMG_SHA,
      checksums: SIGNED_CHECKSUMS.replace(SIGNED_DMG_SHA, 'a'.repeat(64)), checksumsSig: SIGNED_CHECKSUMS_SIG },
    // downgrade below the trusted build-time pin — rejected before signature work
    { tag: 'v1.8.100', url: githubMalibuDownloadUrl('v1.8.100'), sha256: SIGNED_DMG_SHA,
      checksums: SIGNED_CHECKSUMS, checksumsSig: SIGNED_CHECKSUMS_SIG },
    // missing signature fields
    { tag: SIGNED_TAG, url: githubMalibuDownloadUrl(SIGNED_TAG), sha256: SIGNED_DMG_SHA },
  ];
  for (const body of cases) {
    globalThis.fetch = respondJSON(body);
    try {
      const got = await loadPublicMalibuRelease();
      assert.deepEqual(got, fallback);
      assert.equal(got.tag, MALIBU_RELEASE_TAG);
    } finally {
      globalThis.fetch = original;
    }
  }
});
