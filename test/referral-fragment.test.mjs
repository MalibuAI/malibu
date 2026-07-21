import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canonicalHTTPSURL,
  isCanonicalLandingLocation,
  parseReferralFragment,
  readBoundedUTF8,
  validationView,
} from '../j/referral-fragment.mjs';
import {
  validateReferralRelease,
} from '../scripts/verify-referral-download.mjs';
import { MALIBU_DOWNLOAD_URL } from '../j/release.mjs';

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
  assert.match(runtime, /https:\/\/coordinator\.streamvc\.live\/v1\/referrals\/validate/);
  assert.equal(packageJSON.scripts.prebuild, 'node scripts/verify-referral-download.mjs');
  assert.equal(
    MALIBU_DOWNLOAD_URL,
    'https://github.com/Augustas11/macprovider/releases/download/v1.8.56/Malibu-v1.8.56.dmg',
  );
  assert.doesNotMatch(runtime, /Malibu-v1\.8\.49\.dmg/);
  assert.doesNotMatch(runtime, /Malibu-v1\.8\.53\.dmg/);
  assert.doesNotMatch(runtime, /Malibu-v1\.8\.43\.dmg/);
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
    assert.doesNotMatch(csp, /img-src 'none'/);
  }
});

test('production download gate accepts only the frozen commit and asset digests', () => {
  const sourceCommit = '0937d230cb7bbfe779480ffb72dbb6ea78d0a14b';
  const dmgAsset = 'Malibu-v1.8.56.dmg';
  const checksumAsset = 'checksums.txt';
  const provenanceAsset = 'release-provenance.json';
  const githubDownloadBase =
    'https://github.com/Augustas11/macprovider/releases/download/v1.8.56/';
  const acceptedDigests = new Map([
    [dmgAsset, 'b5889de597363b2ecb1df823da93a5ecc555e91d75f8e5eb7208917071f1867b'],
    [checksumAsset, '89d1c4be78a6af75d60e5766eb43c0e6baef0a239bddaa86742cb6367c52a263'],
    [provenanceAsset, '8f3c69469b21991666abe0c030bec8afe4b79b30cc44e1f2e4355bfc0273b1da'],
  ]);
  const release = {
    tag_name: 'v1.8.56',
    draft: false,
    prerelease: false,
    immutable: true,
    target_commitish: sourceCommit,
    assets: [...acceptedDigests].map(([name, digest]) => ({
      name,
      browser_download_url: githubDownloadBase + name,
      digest: `sha256:${digest}`,
    })).concat({
      name: 'macprovider-cli-v1.8.56-darwin-arm64.tar.gz',
      browser_download_url:
        githubDownloadBase + 'macprovider-cli-v1.8.56-darwin-arm64.tar.gz',
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
