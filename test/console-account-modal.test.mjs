import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const consoleSource = await readFile(new URL('../console/index.html', import.meta.url), 'utf8');
const consoleCss = await readFile(new URL('../console/console.css', import.meta.url), 'utf8');

test('hidden attribute wins over modal flex/inline-flex display', () => {
  assert.match(consoleSource, /\[hidden\] \{ display: none !important; \}/);
  assert.match(consoleCss, /\[hidden\] \{ display: none !important; \}/);
});

test('signed-in account modal does not keep GitHub sign-in in the same actions row as Sign out', () => {
  const signinBlock = consoleSource.slice(
    consoleSource.indexOf('data-signin-actions'),
    consoleSource.indexOf('data-advanced'),
  );
  assert.match(signinBlock, /data-github-signin/);
  assert.doesNotMatch(signinBlock, /data-clear-key/);
  assert.match(consoleSource, /data-account-actions hidden/);
  assert.match(consoleSource, /<form data-advanced hidden onsubmit="return false;">/);
});

test('Save key is a button click and does not clear the key after a usage 401', () => {
  assert.match(consoleSource, /saveKeyBtn\.addEventListener\('click', persistApiKey\)/);
  assert.match(consoleSource, /type="button" data-save-key/);
  assert.match(consoleSource, /onsubmit="return false;"/);
  assert.match(consoleSource, /refreshUsage\(\{ userJustSaved: true \}\)/);
  assert.match(consoleSource, /shouldClearInvalidKeyAfterUsageFailure/);
  assert.match(consoleSource, /Paste an API key first/);
  assert.match(consoleSource, /fetchNetworkOverview/);
  assert.match(consoleSource, /gateway unreachable/);
});
