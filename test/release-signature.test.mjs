import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  signedDmgSha256,
  verifyReleaseChecksumsSignature,
} from '../j/release-signature.mjs';

// Real, immutable signed sample from Augustas11/macprovider release v1.8.123:
// checksums.txt and its detached ECDSA-P256/SHA-256 signature (checksums.txt.sig,
// base64). Verifies against the release public key committed in release-signature.mjs.
const checksums = readFileSync(
  new URL('./fixtures/release-v1.8.123.checksums.txt', import.meta.url),
  'utf8',
);
const sigBase64 = readFileSync(
  new URL('./fixtures/release-v1.8.123.checksums.txt.sig.base64', import.meta.url),
  'utf8',
).trim();
const DMG_SHA = '9c3538bf5ac620f3d0e576576f7c8761b965c8405ed24b0a410cbb7826d77947';

test('verifyReleaseChecksumsSignature accepts the real signed release checksum list', async () => {
  assert.equal(await verifyReleaseChecksumsSignature(checksums, sigBase64), true);
});

test('verifyReleaseChecksumsSignature rejects tampered checksums', async () => {
  const tampered = checksums.replace(DMG_SHA, 'a'.repeat(64));
  assert.notEqual(tampered, checksums);
  assert.equal(await verifyReleaseChecksumsSignature(tampered, sigBase64), false);
});

test('verifyReleaseChecksumsSignature rejects a wrong or malformed signature', async () => {
  // valid base64 but not a DER ECDSA signature over these bytes
  assert.equal(await verifyReleaseChecksumsSignature(checksums, 'bm90LWEtc2lnbmF0dXJl'), false);
  // not base64 at all — must not throw
  assert.equal(await verifyReleaseChecksumsSignature(checksums, 'not valid base64 %%%'), false);
  // non-string inputs
  assert.equal(await verifyReleaseChecksumsSignature(null, sigBase64), false);
  assert.equal(await verifyReleaseChecksumsSignature(checksums, null), false);
});

test('verifyReleaseChecksumsSignature rejects non-canonical DER even with a valid (r,s)', async () => {
  const sig = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  // trailing garbage after an otherwise-valid signature
  const trailing = new Uint8Array(sig.length + 1);
  trailing.set(sig, 0);
  trailing[sig.length] = 0x00;
  assert.equal(await verifyReleaseChecksumsSignature(checksums, b64(trailing)), false);
  // truncated signature
  assert.equal(await verifyReleaseChecksumsSignature(checksums, b64(sig.slice(0, sig.length - 2))), false);
  // corrupted outer SEQUENCE tag
  const badTag = new Uint8Array(sig);
  badTag[0] = 0x31;
  assert.equal(await verifyReleaseChecksumsSignature(checksums, b64(badTag)), false);
  // declared sequence length no longer matches the content
  const badLen = new Uint8Array(sig);
  badLen[1] = (badLen[1] + 1) & 0xff;
  assert.equal(await verifyReleaseChecksumsSignature(checksums, b64(badLen)), false);
});

test('signedDmgSha256 returns the bound sha only for an unambiguous exact match', () => {
  assert.equal(signedDmgSha256(checksums, 'v1.8.123'), DMG_SHA);
  assert.equal(signedDmgSha256(checksums, 'v1.8.999'), null);
  assert.equal(signedDmgSha256(`${DMG_SHA}  Malibu-v1.8.123.dmg`, 'v1.8.123'), DMG_SHA);
  // a partial-hex line must not match
  assert.equal(signedDmgSha256('deadbeef  Malibu-v1.8.1.dmg', 'v1.8.1'), null);
  // any duplicate line for the same DMG is ambiguous — conflicting or identical
  const conflicting = `${DMG_SHA}  Malibu-v1.8.1.dmg\n${'b'.repeat(64)}  Malibu-v1.8.1.dmg`;
  assert.equal(signedDmgSha256(conflicting, 'v1.8.1'), null);
  const identical = `${DMG_SHA}  Malibu-v1.8.1.dmg\n${DMG_SHA}  Malibu-v1.8.1.dmg`;
  assert.equal(signedDmgSha256(identical, 'v1.8.1'), null);
});
