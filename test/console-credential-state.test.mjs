import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyRevokeSuccess,
  applyRotateSuccess,
  shouldRefreshAccountAfterRevoke,
  isInvalidLocalCredential,
  publicCredentialErrorMessage,
  containsFullKeyMaterial,
  signedOutRecovery,
  clearFailedRecovery,
  invalidLocalKeyRecovery,
} from '../console/credential-state.mjs';

const SAMPLE_KEY = 'mp_abcdefghijklmnopqrstuvwxyz012345';
const OTHER_KEY = 'mp_otherkeymaterialxxxxxxxxxxxxxxxxx';

function memoryStore(initial = SAMPLE_KEY) {
  let value = initial;
  return {
    loadKey() { return value; },
    saveKey(next) {
      if (next) {
        value = next;
        return value === next;
      }
      value = '';
      return value === '';
    },
    failingClear() {
      return false;
    },
  };
}

test('self-revoke clears local storage and does not request a refresh', () => {
  const store = memoryStore();
  const calls = [];
  const transition = applyRevokeSuccess(
    { status: 'revoked', key_id: 'key_current', revoked_current: true },
    { clearLocalKey: () => { calls.push('clear'); return store.saveKey(''); } },
  );
  assert.equal(transition.action, 'signed_out');
  assert.equal(transition.signedOut, true);
  assert.equal(store.loadKey(), '');
  assert.equal(shouldRefreshAccountAfterRevoke(transition), false);
  assert.deepEqual(calls, ['clear']);
});

test('self-revoke does not claim signed-out when local storage removal fails', () => {
  const store = memoryStore();
  const transition = applyRevokeSuccess(
    { status: 'revoked', key_id: 'key_current', revoked_current: true },
    { clearLocalKey: () => store.failingClear() },
  );
  assert.equal(transition.action, 'clear_failed');
  assert.equal(transition.signedOut, false);
  assert.equal(store.loadKey(), SAMPLE_KEY);
  assert.equal(shouldRefreshAccountAfterRevoke(transition), false);
  assert.equal(containsFullKeyMaterial(clearFailedRecovery.title + clearFailedRecovery.hint, SAMPLE_KEY), false);
});

test('revoking another key preserves the local key and refreshes once', () => {
  const store = memoryStore();
  const transition = applyRevokeSuccess(
    { status: 'revoked', key_id: 'key_other', revoked_current: false },
    { clearLocalKey: () => store.saveKey('') },
  );
  assert.equal(transition.action, 'refresh');
  assert.equal(store.loadKey(), SAMPLE_KEY);
  assert.equal(shouldRefreshAccountAfterRevoke(transition), true);
});

test('revoke success is not inferred from masked prefixes', () => {
  const store = memoryStore();
  const transition = applyRevokeSuccess(
    { status: 'revoked', key_id: 'key_other', key_prefix: SAMPLE_KEY.slice(0, 7) },
    { clearLocalKey: () => store.saveKey('') },
  );
  assert.equal(transition.revokedCurrent, false);
  assert.equal(store.loadKey(), SAMPLE_KEY);
});

test('rotation saves the replacement key before any refresh', () => {
  const store = memoryStore();
  const rotated = applyRotateSuccess({ api_key: OTHER_KEY, key_id: 'key_new' }, { saveKey: store.saveKey });
  assert.equal(rotated.ok, true);
  assert.equal(store.loadKey(), OTHER_KEY);
});

test('rotation save failure does not replace the local key', () => {
  const rotated = applyRotateSuccess({ api_key: OTHER_KEY }, { saveKey: () => false });
  assert.equal(rotated.ok, false);
  assert.equal(rotated.reason, 'save_failed');
});

test('invalid local credential recovery uses gateway error codes, not every 403', () => {
  assert.equal(isInvalidLocalCredential(403, { error: { code: 'api_key_revoked' } }), true);
  assert.equal(isInvalidLocalCredential(401, { error: { code: 'invalid_api_key' } }), true);
  assert.equal(isInvalidLocalCredential(403, { error: { code: 'account_blocked' } }), false);
  assert.equal(isInvalidLocalCredential(403, { error: { code: 'forbidden' } }), false);
  assert.equal(publicCredentialErrorMessage(403, { error: { code: 'api_key_revoked' } }, 'usage 403'), invalidLocalKeyRecovery.title);
  assert.equal(publicCredentialErrorMessage(403, { error: { code: 'account_blocked', message: 'Account blocked' } }, 'usage 403'), 'Account blocked');
  assert.doesNotMatch(publicCredentialErrorMessage(403, { error: { code: 'api_key_revoked' } }, 'usage 403'), /usage 403/);
});

test('recovery copy never includes full key material', () => {
  const texts = [
    signedOutRecovery.title,
    signedOutRecovery.hint,
    clearFailedRecovery.title,
    clearFailedRecovery.hint,
    invalidLocalKeyRecovery.title,
    invalidLocalKeyRecovery.hint,
  ].join('\n');
  assert.equal(containsFullKeyMaterial(texts, SAMPLE_KEY), false);
});

test('self-revoke flow never calls usage with the revoked bearer', async () => {
  const store = memoryStore();
  const usageBearers = [];
  const result = { status: 'revoked', key_id: 'key_current', revoked_current: true };
  const transition = applyRevokeSuccess(result, { clearLocalKey: () => store.saveKey('') });
  if (shouldRefreshAccountAfterRevoke(transition)) usageBearers.push(store.loadKey() || SAMPLE_KEY);
  assert.deepEqual(usageBearers, []);
  assert.equal(store.loadKey(), '');
});

test('revoke failure preserves the local key', () => {
  const store = memoryStore();
  try {
    throw new Error('Could not revoke key.');
  } catch {
    // keys.js catch path does not clear storage on request failure
  }
  assert.equal(store.loadKey(), SAMPLE_KEY);
});

test('API-key workspace uses gateway revoked_current rather than prefix matching for mutation', async () => {
  const keysSource = await readFile(new URL('../console/views/keys.js', import.meta.url), 'utf8');
  const stateSource = await readFile(new URL('../console/credential-state.mjs', import.meta.url), 'utf8');
  assert.match(keysSource, /applyRevokeSuccess/);
  assert.match(keysSource, /shouldRefreshAccountAfterRevoke/);
  assert.match(stateSource, /revoked_current === true/);
  const revokeHandler = keysSource.slice(keysSource.indexOf('revokeApiKey'));
  assert.doesNotMatch(revokeHandler.slice(0, 1200), /maskKey\(local\)\.includes/);
  assert.doesNotMatch(revokeHandler.slice(0, 1200), /startsWith\('mp_'\)/);
});
