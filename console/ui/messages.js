import { createActivityDots } from './activity.js';
import { icon } from './icons.js';

export function renderToolCards(container, toolCalls) {
  container.replaceChildren();
  container.className = 'msg-content tool-cards';
  for (const tc of toolCalls || []) {
    const name = tc.function?.name || 'tool';
    const args = tc.function?.arguments || '{}';
    const card = document.createElement('details');
    card.className = 'tool-card';
    card.open = true;
    const summary = document.createElement('summary');
    summary.innerHTML = `${icon('wrench')}<span class="tool-name">${name}</span>${icon('chevronDown', 10)}`;
    const pre = document.createElement('pre');
    pre.className = 'tool-args';
    try {
      pre.textContent = JSON.stringify(JSON.parse(args), null, 2);
    } catch {
      pre.textContent = args;
    }
    card.append(summary, pre);
    container.appendChild(card);
  }
  container.appendChild(createActivityDots('activity-dots sm'));
}

export function attachMessageActions(footerEl, { content, onCopy, onRegenerate }) {
  if (!footerEl || footerEl.querySelector('.msg-actions')) return;
  const row = document.createElement('div');
  row.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'msg-action';
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = icon('copy', 12);
  copyBtn.addEventListener('click', () => onCopy?.(content));

  const regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = 'msg-action';
  regenBtn.title = 'Regenerate';
  regenBtn.innerHTML = icon('regenerate', 12);
  regenBtn.addEventListener('click', () => onRegenerate?.());

  row.append(copyBtn, regenBtn);
  footerEl.appendChild(row);
}

export function updateChatCrumb({ crumbEl, titleEl, title, visible }) {
  if (titleEl) titleEl.textContent = title || 'New chat';
  if (crumbEl) crumbEl.hidden = !visible;
}
