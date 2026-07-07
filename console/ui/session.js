/**
 * Session controller — Phase 5 activity bus.
 * Coordinates busy state, abort, and activity phase in one place.
 */

import {
  Activity,
  setActivityState,
  getActivityState,
  onActivityState,
  createActivityDots,
  createStreamCursor,
  renderThinkingContent,
  renderStreamingContent,
  renderToolActivity,
  activityLabelForState,
} from './activity.js';

export {
  Activity,
  setActivityState,
  getActivityState,
  onActivityState,
  createActivityDots,
  createStreamCursor,
  renderThinkingContent,
  renderStreamingContent,
  renderToolActivity,
  activityLabelForState,
};

let busy = false;
let abortController = null;
const sessionListeners = new Set();

export function isBusy() {
  return busy;
}

export function getAbortSignal() {
  return abortController?.signal ?? null;
}

function notifySession() {
  const snapshot = { busy, signal: abortController?.signal ?? null };
  for (const fn of sessionListeners) fn(snapshot);
}

/** Subscribe to busy/abort changes. */
export function onSessionChange(fn) {
  sessionListeners.add(fn);
  fn({ busy, signal: abortController?.signal ?? null });
  return () => sessionListeners.delete(fn);
}

/** Start a new in-flight request. Returns AbortController. */
export function beginSession() {
  abortController?.abort();
  abortController = new AbortController();
  busy = true;
  notifySession();
  return abortController;
}

/** Clear session after request completes. */
export function endSession() {
  busy = false;
  abortController = null;
  setActivityState(Activity.IDLE);
  notifySession();
}

/** User-initiated stop — aborts fetch/stream. */
export function stopSession() {
  abortController?.abort();
}

export function isAbortError(e) {
  return e?.name === 'AbortError' || e?.code === 20;
}
