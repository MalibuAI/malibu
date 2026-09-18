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
  assert.match(consoleSource, /<form data-advanced hidden>/);
});

test('Save key submits the key form and refuses an empty value instead of clearing', () => {
  assert.match(consoleSource, /advancedEl\.addEventListener\('submit', persistApiKey\)/);
  assert.match(consoleSource, /Paste an API key first/);
  assert.match(consoleSource, /fetchNetworkOverview/);
  assert.match(consoleSource, /gateway unreachable/);
});
