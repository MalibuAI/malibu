const CODE_PATTERN = /^MAL1-[SP]-[A-Za-z0-9_]{1,32}-[A-Za-z0-9_]{1,32}-[A-Z2-7]{26}$/;
const CHALLENGE_PATTERN = /^[0-9a-f]{64}$/;

export function isCanonicalLandingLocation(location) {
  return location?.protocol === 'https:'
    && location.hostname === 'malibu.tech'
    && location.port === ''
    && location.pathname === '/j'
    && location.search === '';
}

export function parseReferralFragment(rawHash) {
  if (typeof rawHash !== 'string' || rawHash.length > 512 || !rawHash.startsWith('#/')) {
    return null;
  }

  const fragment = rawHash.slice(2);
  const separator = fragment.indexOf('?');
  const code = separator === -1 ? fragment : fragment.slice(0, separator);
  if (!CODE_PATTERN.test(code)) return null;

  if (separator === -1) return { code, challenge: null };

  const suffix = fragment.slice(separator);
  if (!suffix.startsWith('?c=')) return null;
  const challenge = suffix.slice(3);
  if (!CHALLENGE_PATTERN.test(challenge)) return null;
  return { code, challenge };
}

export async function readBoundedUTF8(response, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  const reader = response?.body?.getReader?.();
  if (!reader) return null;

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || total + value.byteLength > maxBytes) {
        await reader.cancel();
        return null;
      }
      total += value.byteLength;
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function canonicalHTTPSURL(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:'
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.port !== ''
      || parsed.hash !== ''
      || parsed.href !== raw) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function validationView(response) {
  if (!response || typeof response !== 'object') return 'unavailable';
  if (response.valid === true && response.required === true && response.reason === 'valid') return 'valid';
  if (response.valid !== false || response.required !== true || typeof response.reason !== 'string') {
    return 'unavailable';
  }

  switch (response.reason) {
    case 'expired':
      return 'expired';
    case 'exhausted':
      return 'exhausted';
    case 'revoked':
      return 'revoked';
    case 'invalid':
    case 'missing':
    case 'conflict':
      return 'invalid';
    default:
      return 'unavailable';
  }
}
