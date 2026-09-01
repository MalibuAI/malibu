export const INVALID_LOCAL_CREDENTIAL_CODES = Object.freeze(['invalid_api_key', 'api_key_revoked']);

export const signedOutRecovery = Object.freeze({
  title: 'No API key on this device.',
  hint: 'Paste a key, mint one with GitHub, or rotate from another device.',
});

export const clearFailedRecovery = Object.freeze({
  title: 'Key revoked, but this browser could not clear the saved key.',
  hint: 'Paste a replacement key or clear this site’s stored data. Do not keep using the old key.',
});

export const invalidLocalKeyRecovery = Object.freeze({
  title: 'Saved API key is no longer valid.',
  hint: 'Paste a replacement key or sign in with GitHub.',
});

export function gatewayErrorCode(payload) {
  if (payload && typeof payload === 'object') {
    return String(payload.error?.code || '');
  }
  if (typeof payload === 'string') {
    try {
      return gatewayErrorCode(JSON.parse(payload));
    } catch {
      return '';
    }
  }
  return '';
}

export function isInvalidLocalCredential(status, payload) {
  if (status !== 401 && status !== 403) return false;
  return INVALID_LOCAL_CREDENTIAL_CODES.includes(gatewayErrorCode(payload));
}

export function publicCredentialErrorMessage(status, payload, fallback) {
  if (isInvalidLocalCredential(status, payload)) return invalidLocalKeyRecovery.title;
  const message = payload && typeof payload === 'object' ? payload.error?.message : '';
  if (message) return String(message);
  return fallback || 'Request failed.';
}

export function applyRevokeSuccess(response, { clearLocalKey }) {
  const revokedCurrent = response?.revoked_current === true;
  if (!revokedCurrent) {
    return {
      action: 'refresh',
      revokedCurrent: false,
      storageCleared: false,
      signedOut: false,
    };
  }
  const storageCleared = clearLocalKey() === true;
  return {
    action: storageCleared ? 'signed_out' : 'clear_failed',
    revokedCurrent: true,
    storageCleared,
    signedOut: storageCleared,
  };
}

export function shouldRefreshAccountAfterRevoke(transition) {
  return transition?.action === 'refresh';
}

export function applyRotateSuccess(response, { saveKey }) {
  const newKey = response?.api_key;
  if (!newKey) {
    return { ok: false, reason: 'missing_key', saved: false };
  }
  const saved = saveKey(newKey) === true;
  if (!saved) {
    return { ok: false, reason: 'save_failed', saved: false };
  }
  return { ok: true, reason: '', saved: true };
}

export function containsFullKeyMaterial(text, key) {
  const value = String(key || '');
  if (value.length < 12) return false;
  return String(text || '').includes(value);
}
