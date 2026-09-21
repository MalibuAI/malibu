import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canonicalHTTPSURL,
  isCanonicalLandingLocation,
  parseReferralFragment,
  readBoundedUTF8,
  validationView,
} from '../j/referral-fragment.mjs';
import { LATEST_RELEASE_API_URL } from '../j/latest-release.mjs';
import {
  assertFallbackPinMatchesResolvedLatest,
  validateReferralRelease,
  verifyReferralDownload,
} from '../scripts/verify-referral-download.mjs';
import {
  MALIBU_DMG_SHA256,
  MALIBU_DOWNLOAD_URL,
  MALIBU_RELEASE_TAG,
} from '../j/release.mjs';

const code = `MAL1-S-key_1-issuer_1-${'A'.repeat(26)}`;
const challenge = 'a'.repeat(64);

test('accepts only the canonical fragment invite forms', () => {
  assert.deepEqual(parseReferralFragment(`#/${code}`), { code, challenge: null });
  assert.deepEqual(parseReferralFragment(`#/${code}?c=${challenge}`), { code, challenge });
});

test('rejects path, query, encoding, suffix, and authority-shaped confusion', () => {
  for (const input of [
    '',
    `#${code}`,
    `#/j/${code}`,
    `#/${code}/`,
    `#/${code}?c=`,
    `#/${code}?c=${challenge}&next=evil`,
    `#/${code}?next=evil`,
    `#/%4D${code.slice(1)}`,
    `#//evil.test/${code}`,
    `#/${code.toLowerCase()}`,
    `#/${code}?c=${'A'.repeat(64)}`,
    `#/${code}?c=${'a'.repeat(65)}`,
    `#/${code}${'x'.repeat(512)}`,
  ]) {
    assert.equal(parseReferralFragment(input), null, input);
  }
});

test('accepts referral fragments only on the exact public landing URL', () => {
  const canonical = {
    protocol: 'https:',
    hostname: 'malibu.tech',
    port: '',
    pathname: '/j',
    search: '',
  };
  assert.equal(isCanonicalLandingLocation(canonical), true);
  for (const override of [
    { protocol: 'http:' },
    { hostname: 'www.malibu.tech' },
    { hostname: 'evil.test' },
    { port: '443' },
    { pathname: '/j/' },
    { pathname: `/j/${code}` },
    { search: `?code=${code}` },
  ]) {
    assert.equal(isCanonicalLandingLocation({ ...canonical, ...override }), false);
  }
});

test('bounds and validates streamed UTF-8 responses before allocation', async () => {
  const response = new Response('{"valid":true}', {
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(await readBoundedUTF8(response, 64), '{"valid":true}');

  const oversized = new Response('x'.repeat(65));
  assert.equal(await readBoundedUTF8(oversized, 64), null);

  const invalidUTF8 = new Response(new Uint8Array([0xc3, 0x28]));
  assert.equal(await readBoundedUTF8(invalidUTF8, 64), null);
});

test('accepts only canonical credential-free HTTPS operator links', () => {
  assert.equal(canonicalHTTPSURL('https://access.malibu.tech/waitlist?campaign=prebeta'), 'https://access.malibu.tech/waitlist?campaign=prebeta');
  for (const value of [
    'http://access.malibu.tech/waitlist',
    'https://user:secret@access.malibu.tech/waitlist',
    'https://access.malibu.tech:444/waitlist',
    'https://access.malibu.tech/waitlist#code',
    'https://ACCESS.malibu.tech/waitlist',
    'https://access.malibu.tech',
    'not a URL',
  ]) {
    assert.equal(canonicalHTTPSURL(value), null);
  }
});

test('maps only known validation results into user states', () => {
  assert.equal(validationView({ valid: true, required: true, reason: 'valid' }), 'valid');
  assert.equal(validationView({ valid: false, required: true, reason: 'expired' }), 'expired');
  assert.equal(validationView({ valid: false, required: true, reason: 'exhausted' }), 'exhausted');
  assert.equal(validationView({ valid: false, required: true, reason: 'revoked' }), 'revoked');
  assert.equal(validationView({ valid: false, required: true, reason: 'invalid' }), 'invalid');
  assert.equal(validationView({ valid: false, required: true, reason: 'future-value' }), 'unavailable');
  assert.equal(validationView({ valid: true, required: false, reason: 'disabled' }), 'unavailable');
  assert.equal(validationView({ valid: 'yes' }), 'unavailable');
  assert.equal(validationView(null), 'unavailable');
});

test('landing route keeps referral material away from Vercel and unsafe browser sinks', async () => {
  const [configSource, html, runtime, packageSource] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../j/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../j/join.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);
  const config = JSON.parse(configSource);
  const packageJSON = JSON.parse(packageSource);
  const rewrites = config.rewrites.map(({ source, destination }) => `${source} ${destination}`);
  assert.equal(rewrites.some((rewrite) => rewrite.includes('/v1/referrals/validate')), false);
  assert.match(runtime, /https:\/\/coordinator\.malibu\.tech\/v1\/referrals\/validate/);
  assert.doesNotMatch(runtime, /coordinator\.streamvc\.live\/v1\/referrals\/validate/);
  assert.equal(packageJSON.scripts.prebuild, 'node scripts/verify-referral-download.mjs');
  assert.equal(
    MALIBU_DOWNLOAD_URL,
    'https://github.com/Augustas11/macprovider/releases/download/v1.8.123/Malibu-v1.8.123.dmg',
  );
  assert.match(runtime, /loadPublicMalibuRelease/);
  assert.doesNotMatch(runtime, /Malibu-v1\.8\.49\.dmg/);
  assert.match(runtime, /credentials: 'omit'/);
  assert.match(runtime, /redirect: 'error'/);
  assert.match(runtime, /isCanonicalLandingLocation\(window\.location\)/);
  assert.match(runtime, /readBoundedUTF8\(response, MAX_RESPONSE_BYTES\)/);
  assert.match(runtime, /window\.history\.replaceState\(null, '', '\/j'\)/);
  assert.match(runtime, /window\.addEventListener\('pagehide'/);
  assert.match(runtime, /retryCount >= 2/);
  assert.doesNotMatch(runtime, /innerHTML|document\.write|localStorage|sessionStorage|indexedDB|caches\.|serviceWorker/);
  assert.doesNotMatch(html, /analytics|googletagmanager|google-analytics|fonts\.googleapis|<iframe/i);
  assert.ok(html.indexOf('id="copy"') < html.indexOf('id="download"'));
  assert.match(html, /Open Malibu and paste the invite code when asked/);
  assert.match(html, /href="\/favicon\.png"/);
  assert.match(html, /href="\/favicon-32\.png"/);
  assert.match(html, /src="\/logo-mark\.png"/);

  const joinCSS = await readFile(new URL('../j/join.css', import.meta.url), 'utf8');
  assert.ok(joinCSS.includes('url("/images/brand/hero-malibu-bay.webp")'));
  assert.ok(joinCSS.includes('width: calc(100vw - 40px)'));
  assert.ok(joinCSS.includes('max-width: 620px'));
  const inviteHeaderRoutes = new Set(['/j', '/j/', '/j/:path*']);
  const inviteHeaders = config.headers.filter(({ source }) => inviteHeaderRoutes.has(source));
  assert.equal(inviteHeaders.length, inviteHeaderRoutes.size);
  for (const { headers } of inviteHeaders) {
    const csp = headers.find(({ key }) => key === 'Content-Security-Policy')?.value ?? '';
    assert.match(csp, /img-src 'self'/);
    assert.match(csp, /connect-src 'self' https:\/\/coordinator\.malibu\.tech/);
    assert.doesNotMatch(csp, /coordinator\.streamvc\.live/);
    assert.doesNotMatch(csp, /img-src 'none'/);
  }
});

test('production download gate accepts only the frozen commit and asset digests', () => {
  const sourceCommit = '37e2d232389ba37d94f138b5a7d52a12c2b12106';
  const dmgAsset = 'Malibu-v1.8.123.dmg';
  const checksumAsset = 'checksums.txt';
  const checksumSigAsset = 'checksums.txt.sig';
  const provenanceAsset = 'release-provenance.json';
  const githubDownloadBase =
    'https://github.com/Augustas11/macprovider/releases/download/v1.8.123/';
  const acceptedDigests = new Map([
    [dmgAsset, '9c3538bf5ac620f3d0e576576f7c8761b965c8405ed24b0a410cbb7826d77947'],
    [checksumAsset, '2b24ccdab5a907a86681674359fcc68430fc93c2f7f9048b33455d1f447a06ac'],
    [checksumSigAsset, '8d9ab55df98ff8e08428955471b12ae05ca8551cc73ec5b18ee88648f628681e'],
    [provenanceAsset, 'ef0d81181ff566883f73f93697c2edfc012ed4c15169f72b180ef07c2c270d1d'],
  ]);
  const release = {
    tag_name: 'v1.8.123',
    draft: false,
    prerelease: false,
    immutable: true,
    target_commitish: sourceCommit,
    assets: [...acceptedDigests].map(([name, digest]) => ({
      name,
      browser_download_url: githubDownloadBase + name,
      digest: `sha256:${digest}`,
    })).concat({
      name: 'macprovider-cli-v1.8.123-darwin-arm64.tar.gz',
      browser_download_url:
        githubDownloadBase + 'macprovider-cli-v1.8.123-darwin-arm64.tar.gz',
      digest: `sha256:${'b'.repeat(64)}`,
    }),
  };

  validateReferralRelease(release);

  assert.throws(
    () => validateReferralRelease({
      ...release,
      target_commitish: 'd'.repeat(40),
    }),
    /does not match the accepted immutable source/,
  );

  // A release missing the signed checksum list must be rejected, so the pinned
  // release always ships what the runtime latest path needs.
  assert.throws(
    () => validateReferralRelease({
      ...release,
      assets: release.assets.filter((asset) => asset.name !== checksumSigAsset),
    }),
    /assets are missing or ambiguous/,
  );

  for (const name of acceptedDigests.keys()) {
    assert.throws(
      () => validateReferralRelease({
        ...release,
        assets: release.assets.map((asset) => (
          asset.name === name
            ? { ...asset, digest: `sha256:${'0'.repeat(64)}` }
            : asset
        )),
      }),
      new RegExp(`digest is not accepted for ${name.replace('.', '\\.')}`),
    );
  }
});

test('production download gate refuses a fallback pin that is not GitHub Latest', () => {
  assert.equal(MALIBU_RELEASE_TAG, 'v1.8.123');
  assert.doesNotThrow(() => assertFallbackPinMatchesResolvedLatest(MALIBU_RELEASE_TAG));
  assert.throws(
    () => assertFallbackPinMatchesResolvedLatest('v1.8.122'),
    /does not match resolved GitHub Latest v1\.8\.122/,
  );
  assert.throws(
    () => assertFallbackPinMatchesResolvedLatest('v1.8.124'),
    /does not match resolved GitHub Latest v1\.8\.124/,
  );
  assert.throws(
    () => assertFallbackPinMatchesResolvedLatest(null),
    /does not match resolved GitHub Latest null/,
  );
});

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

function fakeGitHubResponse(url, body, contentType = 'application/json') {
  const bytes = typeof body === 'string' ? utf8Bytes(body) : body;
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

function bindableLatest(tag) {
  const dmg = `Malibu-${tag}.dmg`;
  const dmgSHA = 'b'.repeat(64);
  const checksumText = `${dmgSHA}  ${dmg}\n`;
  const checksumSig = 'test-detached-signature-bytes';
  const commit = 'a'.repeat(40);
  const provenance = {
    schema_version: 1,
    repository: 'Augustas11/macprovider',
    commit,
    tag,
    prerelease: false,
    assets: { [dmg]: dmgSHA },
  };
  const base = `https://github.com/Augustas11/macprovider/releases/download/${tag}/`;
  return {
    base,
    checksumSig,
    checksumText,
    provenance,
    release: {
      tag_name: tag,
      draft: false,
      prerelease: false,
      immutable: true,
      target_commitish: commit,
      assets: [
        { name: dmg, browser_download_url: base + dmg, digest: `sha256:${dmgSHA}` },
        {
          name: 'checksums.txt',
          browser_download_url: base + 'checksums.txt',
          digest: `sha256:${sha256Hex(checksumText)}`,
        },
        {
          name: 'checksums.txt.sig',
          browser_download_url: base + 'checksums.txt.sig',
          digest: `sha256:${sha256Hex(checksumSig)}`,
        },
        {
          name: 'release-provenance.json',
          browser_download_url: base + 'release-provenance.json',
          digest: `sha256:${sha256Hex(JSON.stringify(provenance))}`,
        },
      ],
    },
  };
}

test('verifyReferralDownload fail-closes when resolved Latest is a different Malibu tag', async () => {
  const other = bindableLatest('v1.8.124');
  const seen = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    seen.push(href);
    if (href === LATEST_RELEASE_API_URL) {
      return fakeGitHubResponse(href, JSON.stringify(other.release));
    }
    if (href === `${other.base}checksums.txt`) {
      return fakeGitHubResponse(href, other.checksumText, 'text/plain');
    }
    if (href === `${other.base}checksums.txt.sig`) {
      return fakeGitHubResponse(href, other.checksumSig, 'application/octet-stream');
    }
    if (href === `${other.base}release-provenance.json`) {
      return fakeGitHubResponse(href, JSON.stringify(other.provenance));
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  await assert.rejects(
    () => verifyReferralDownload(fetchImpl),
    /fallback pin v1\.8\.123 does not match resolved GitHub Latest v1\.8\.124/,
  );
  assert.equal(seen.some((href) => href.includes('/releases/tags/v1.8.123')), false);
});

test('verifyReferralDownload keeps the pin byte gate when GitHub Latest cannot resolve', async () => {
  let sawPinTag = false;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href === LATEST_RELEASE_API_URL) {
      throw new Error('latest-release request failed for /releases/latest: HTTP 502');
    }
    if (href.includes('/releases/tags/v1.8.123')) {
      sawPinTag = true;
      throw new Error('pin probe');
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  await assert.rejects(() => verifyReferralDownload(fetchImpl), /pin probe/);
  assert.equal(sawPinTag, true);
});

test('host download button, version, and digest all serve the pinned release', async () => {
  const [host, releaseSource] = await Promise.all([
    readFile(new URL('../host/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../j/release.mjs', import.meta.url), 'utf8'),
  ]);

  // The button serves the immutable GitHub release DMG directly (the same
  // MALIBU_DOWNLOAD_URL the fallback pin and the checksum-bound API resolve to),
  // so the printed version and SHA-256 always match the bytes it delivers. The
  // branded download.malibu.tech mirror is intentionally not used: it lags
  // releases and 404s the current build while the frozen-Sparkle publish gate is
  // retired.
  assert.doesNotMatch(host, /latest\.dmg/);
  assert.doesNotMatch(host, /api\.github\.com/);
  assert.doesNotMatch(host, /download\.malibu\.tech/);
  assert.doesNotMatch(host, /v1\.8\.122/);
  assert.doesNotMatch(releaseSource, /v1\.8\.122/);
  assert.doesNotMatch(releaseSource, /latest\.dmg/);
  assert.match(releaseSource, /\/api\/malibu-release/);
  assert.match(host, /loadPublicMalibuRelease/);

  const href = host.match(/id="mac-download"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(href, MALIBU_DOWNLOAD_URL);
  assert.equal(
    href,
    `https://github.com/Augustas11/macprovider/releases/download/${MALIBU_RELEASE_TAG}/Malibu-${MALIBU_RELEASE_TAG}.dmg`,
  );
  assert.match(
    host,
    new RegExp(`id="mac-version">${MALIBU_RELEASE_TAG.replace(/\./g, '\\.')}<`),
  );
  assert.match(host, new RegExp(`id="mac-sha256">${MALIBU_DMG_SHA256}<`));
  assert.ok(MALIBU_DOWNLOAD_URL.includes(`/${MALIBU_RELEASE_TAG}/`));
});
