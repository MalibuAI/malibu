/** Shared activity / “working” indicators for Malibu Console. */

export const Activity = {
  IDLE: 'idle',
  THINKING: 'thinking',
  STREAMING: 'streaming',
  TOOL: 'tool',
};

let state = Activity.IDLE;
const listeners = new Set();

export function getActivityState() {
  return state;
}

export function setActivityState(next) {
  if (state === next) return;
  state = next;
  for (const fn of listeners) fn(state);
}

/** Subscribe to activity changes. Calls fn immediately with current state. */
export function onActivityState(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function createActivityDots(className = 'activity-dots') {
  const wrap = document.createElement('span');
  wrap.className = className;
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-label', 'Working');
  for (let i = 0; i < 3; i += 1) {
    wrap.appendChild(document.createElement('span'));
  }
  return wrap;
}

export function createStreamCursor() {
  const el = document.createElement('span');
  el.className = 'stream-cursor';
  el.textContent = '▍';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function renderThinkingContent(container) {
  container.replaceChildren();
  const row = document.createElement('div');
  row.className = 'thinking-row';
  row.append(document.createTextNode('Thinking'), createActivityDots());
  container.appendChild(row);
}

export function renderStreamingContent(container, text, escapeHtml) {
  container.replaceChildren();
  if (text) {
    const span = document.createElement('span');
    span.innerHTML = escapeHtml(text);
    container.appendChild(span);
  }
  container.appendChild(createStreamCursor());
}

export function renderToolActivity(container, label) {
  container.replaceChildren();
  const labelEl = document.createElement('span');
  labelEl.className = 'activity-label';
  labelEl.textContent = label;
  container.appendChild(labelEl);
  container.appendChild(createActivityDots('activity-dots sm'));
}

export const CHAT_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3 H12 V8 H6 L4 11 V8 H2 Z"/></svg>';

export function activityLabelForState(s) {
  if (s === Activity.THINKING) return 'Thinking';
  if (s === Activity.TOOL) return 'Running tools';
  if (s === Activity.STREAMING) return 'Generating';
  return '';
}
