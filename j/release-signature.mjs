// Client-side verification of the macprovider release signature.
//
// The release pipeline signs `checksums.txt` with an OFFLINE ECDSA P-256 key
// (`openssl dgst -sha256 -sign`), producing `checksums.txt.sig`. `/api/malibu-release`
// passes both through, but the page must not trust the same-origin API for the
// displayed SHA/tag: a compromised API function or a tampered/cache-poisoned
// response could advertise a wrong digest. So the browser re-verifies the
// signature here against the trusted public key(s) committed below, and only
// trusts a SHA it reads from the signed checksum list. Any failure falls back to
// the build-time pin in release.mjs (itself gated by scripts/verify-referral-download.mjs).
//
// Limitation: these public keys ship in the static bundle, so this defends
// against API-function-only compromise and response tampering, not a full deploy
// compromise that also replaces them.

// Trusted macprovider release signing public keys (ECDSA P-256, SPKI, base64).
// A keyring rather than a single key so a signing-key rotation can overlap: add
// the new key here (old + new) BEFORE macprovider switches signers, then drop
// the old one only after the fallback pin and current Latest are signed by the
// new key. Mirror of ops/pearl-updater/release-signing-public.pem in
// Augustas11/macprovider.
export const RELEASE_SIGNING_PUBLIC_KEYS_SPKI_BASE64 = Object.freeze([
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEwwd0Vzj35OP8DlZU+0lUa8vI9gHK09J'
  + '48LDizWScsH6rutnZLkKnGQ4X5Q8lT9L5mglF8Ba0DDoUXKrFfSAX4Q==',
]);

function base64ToBytes(base64) {
  if (typeof base64 !== 'string') throw new Error('base64 input is not a string');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// OpenSSL emits DER (ASN.1 SEQUENCE { INTEGER r, INTEGER s }); WebCrypto ECDSA
// wants the fixed-width r||s (IEEE P1363) form. Decode strictly and fail closed:
// this is a cryptographic boundary, so a permissive parser that tolerates
// trailing bytes or non-canonical integers would let a malformed container that
// merely embeds a valid (r,s) pass. Throws on any deviation.
function derEcdsaToP1363(der) {
  const total = der.length;
  let offset = 0;
  // A P-256 signature is short (< 80 bytes), so the SEQUENCE length is always
  // single-byte short form and must account for exactly the remaining bytes.
  if (total < 8 || total > 72 || der[offset] !== 0x30) {
    throw new Error('signature is not a DER sequence');
  }
  offset += 1;
  const seqLen = der[offset];
  offset += 1;
  if (seqLen & 0x80) throw new Error('signature sequence length is not short-form');
  if (seqLen !== total - offset) throw new Error('signature sequence length mismatch');

  const readInt = () => {
    if (der[offset] !== 0x02) throw new Error('signature integer expected');
    offset += 1;
    const intLen = der[offset];
    offset += 1;
    if (intLen < 1 || intLen > 33 || offset + intLen > total) {
      throw new Error('signature integer length invalid');
    }
    const bytes = der.slice(offset, offset + intLen);
    offset += intLen;
    if (bytes[0] & 0x80) throw new Error('signature integer is negative');
    if (bytes[0] === 0x00) {
      // A leading zero is legal only to keep an otherwise-high-bit value positive.
      if (intLen === 1 || !(bytes[1] & 0x80)) {
        throw new Error('signature integer is not minimally encoded');
      }
    }
    const stripped = bytes[0] === 0x00 ? bytes.slice(1) : bytes;
    if (stripped.length < 1 || stripped.length > 32) {
      throw new Error('signature integer out of range for P-256');
    }
    const out = new Uint8Array(32);
    out.set(stripped, 32 - stripped.length);
    return out;
  };

  const r = readInt();
  const s = readInt();
  if (offset !== total) throw new Error('trailing bytes after signature');
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}

// Verify an ECDSA P-256 / SHA-256 signature (DER, base64) over the exact bytes
// of `checksumsText` against any trusted release key. Resolves false on any
// malformed input; never throws.
export async function verifyReleaseChecksumsSignature(checksumsText, signatureBase64) {
  try {
    if (typeof checksumsText !== 'string' || typeof signatureBase64 !== 'string') return false;
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;
    const signature = derEcdsaToP1363(base64ToBytes(signatureBase64));
    const data = new TextEncoder().encode(checksumsText);
    for (const spki of RELEASE_SIGNING_PUBLIC_KEYS_SPKI_BASE64) {
      const key = await subtle.importKey(
        'spki',
        base64ToBytes(spki),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      if (await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, data)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Return the lowercase sha256 that the signed checksum list binds to
// `Malibu-<tag>.dmg`, or null unless there is exactly one matching line. The line
// format is `<sha>  <filename>` (two spaces), matching `shasum`/`sha256sum`.
export function signedDmgSha256(checksumsText, tag) {
  if (typeof checksumsText !== 'string' || typeof tag !== 'string') return null;
  const dmg = `Malibu-${tag}.dmg`;
  let found = null;
  for (const rawLine of checksumsText.split('\n')) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(rawLine.trimEnd());
    if (!match || match[2] !== dmg) continue;
    if (found !== null) return null; // any second matching line is ambiguous
    found = match[1];
  }
  return found;
}
