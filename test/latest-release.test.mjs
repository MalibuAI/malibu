import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  bindLatestMalibuRelease,
  LATEST_RELEASE_API_URL,
  resolveLatestMalibuRelease,
} from '../j/latest-release.mjs';
import {
  fallbackMalibuRelease,
  isAcceptedMalibuDownload,
  loadPublicMalibuRelease,
  MALIBU_DOWNLOAD_URL,
  MALIBU_RELEASE_TAG,
} from '../j/release.mjs';

const TAG = 'v1.8.99';
const DMG = `Malibu-${TAG}.dmg`;
const COMMIT = 'a'.repeat(40);
const DMG_SHA = 'b'.repeat(64);
const CHECKSUM_TEXT = `${DMG_SHA}  ${DMG}\n`;
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
        name: 'release-provenance.json',
        browser_download_url: base + 'release-provenance.json',
        digest: `sha256:${provenanceSHA}`,
      },
    ],
    ...overrides,
  };
}

test('isAcceptedMalibuDownload allows only immutable per-tag GitHub DMGs', () => {
  assert.equal(isAcceptedMalibuDownload(fallbackMalibuRelease()), true);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: `https://github.com/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
    sha256: DMG_SHA,
  }), true);
  assert.equal(isAcceptedMalibuDownload({
    tag: TAG,
    url: 'https://download.malibu.tech/latest.dmg',
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
  assert.equal(seen.includes(LATEST_RELEASE_API_URL), true);
  assert.equal(seen.some((url) => url.endsWith(`/${DMG}`)), false);
  assert.equal(checksumSHA.length, 64);
});

test('loadPublicMalibuRelease upgrades atomically and ignores a dishonest API', async () => {
  const original = globalThis.fetch;
  const honest = {
    tag: TAG,
    url: `https://github.com/Augustas11/macprovider/releases/download/${TAG}/${DMG}`,
    sha256: DMG_SHA,
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
    assert.deepEqual(got, honest);
  } finally {
    globalThis.fetch = original;
  }

  globalThis.fetch = async () => new Response(JSON.stringify({
    tag: TAG,
    url: 'https://download.malibu.tech/latest.dmg',
    sha256: DMG_SHA,
  }), { headers: { 'content-type': 'application/json' } });
  try {
    const got = await loadPublicMalibuRelease();
    assert.equal(got.url, MALIBU_DOWNLOAD_URL);
    assert.equal(got.tag, MALIBU_RELEASE_TAG);
  } finally {
    globalThis.fetch = original;
  }
});
