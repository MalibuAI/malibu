import { createActivityDots } from './activity.js';

const MARKER_LABELS = {
  thinking: 'Thinking',
  tool: 'Running tools',
  status: 'Working',
};

export function createMarker({ kind = 'status', label } = {}) {
  const el = document.createElement('div');
  el.className = `marker marker-${kind}`;
  el.dataset.marker = kind;
  el.setAttribute('role', 'status');

  const inner = document.createElement('div');
  inner.className = 'marker-inner';

  const labelEl = document.createElement('span');
  labelEl.className = 'marker-label';
  labelEl.textContent = label || MARKER_LABELS[kind] || MARKER_LABELS.status;
  inner.appendChild(labelEl);

  if (kind === 'thinking' || kind === 'tool') {
    inner.appendChild(createActivityDots('activity-dots sm'));
  }

  el.appendChild(inner);

  if (kind === 'tool') {
    const body = document.createElement('div');
    body.className = 'marker-body';
    el.appendChild(body);
  }

  return el;
}

export function addMarker(stream, options, { beforeEl } = {}) {
  const el = createMarker(options);
  if (beforeEl?.parentNode) {
    beforeEl.parentNode.insertBefore(el, beforeEl);
  } else {
    stream.appendChild(el);
  }
  return el;
}

export function removeMarker(el) {
  el?.remove();
}

export function setMarkerLabel(el, label) {
  const labelEl = el?.querySelector('.marker-label');
  if (labelEl && label) labelEl.textContent = label;
}
