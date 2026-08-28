/** Inline SVG icons for Malibu Console (13×13 stroke style). */

const SVGS = {
  chat: '<path d="M2 3 H12 V8 H6 L4 11 V8 H2 Z"/>',
  chevronRight: '<path d="M5 3 L9 7 L5 11"/>',
  chevronDown: '<path d="M3 5 L7 9 L11 5"/>',
  chevronUp: '<path d="M3 9 L7 5 L11 9"/>',
  wrench: '<path d="M9 2 C10 3 10 5 9 6 L6 9 C4 11 2 11 2 11 C2 11 2 9 4 7 L7 4 C8 3 10 3 11 2 Z"/>',
  copy: '<rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 10 V3 H10"/>',
  regenerate: '<path d="M2 7 C2 4 4 2 7 2 C10 2 12 4 12 7 M12 7 V4 M12 7 H9"/>',
  stop: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/>',
  external: '<path d="M5 3 H11 V9 M11 3 L3 11"/>',
};

export function icon(name, size = 13) {
  const path = SVGS[name];
  if (!path) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export const CHAT_ICON_SVG = icon('chat');
