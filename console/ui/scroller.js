/** Smart chat scroll — auto-follow while pinned, turn anchoring, jump-to-latest. */

const BOTTOM_THRESHOLD = 48;
const ANCHOR_OFFSET = 80;

export function initScroller(viewportEl, jumpButton = null) {
  let autoFollow = true;
  let programmatic = false;
  let followAnchor = null;

  function distanceFromBottom() {
    return viewportEl.scrollHeight - viewportEl.scrollTop - viewportEl.clientHeight;
  }

  function isNearBottom() {
    return distanceFromBottom() <= BOTTOM_THRESHOLD;
  }

  function updateJumpButton() {
    if (!jumpButton) return;
    const show = !autoFollow && distanceFromBottom() > BOTTOM_THRESHOLD;
    jumpButton.hidden = !show;
    jumpButton.tabIndex = show ? 0 : -1;
  }

  function scrollToBottom(behavior = 'auto') {
    programmatic = true;
    viewportEl.scrollTo({ top: viewportEl.scrollHeight, behavior });
    requestAnimationFrame(() => { programmatic = false; });
  }

  function keepVisible(el, behavior = 'auto') {
    if (!el) {
      scrollToBottom(behavior);
      return;
    }
    const vp = viewportEl.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (rect.bottom > vp.bottom - BOTTOM_THRESHOLD) {
      programmatic = true;
      const delta = rect.bottom - vp.bottom + BOTTOM_THRESHOLD;
      if (behavior === 'smooth') {
        viewportEl.scrollTo({ top: viewportEl.scrollTop + delta, behavior: 'smooth' });
      } else {
        viewportEl.scrollTop += delta;
      }
      requestAnimationFrame(() => { programmatic = false; });
    }
  }

  function syncFollowPosition(behavior = 'auto') {
    if (followAnchor) keepVisible(followAnchor, behavior);
    else scrollToBottom(behavior);
  }

  function follow({ force = false, anchorEl = null, behavior = 'auto' } = {}) {
    if (force) autoFollow = true;
    if (anchorEl) followAnchor = anchorEl;
    if (!autoFollow && !force) {
      updateJumpButton();
      return;
    }
    syncFollowPosition(behavior);
    updateJumpButton();
  }

  function anchorTurn(turnEl, { behavior = 'smooth' } = {}) {
    autoFollow = true;
    followAnchor = null;
    if (!turnEl) {
      follow({ force: true, behavior });
      return;
    }
    const vpTop = viewportEl.getBoundingClientRect().top;
    const turnTop = turnEl.getBoundingClientRect().top;
    const target = viewportEl.scrollTop + (turnTop - vpTop) - ANCHOR_OFFSET;
    programmatic = true;
    viewportEl.scrollTo({ top: Math.max(0, target), behavior });
    requestAnimationFrame(() => { programmatic = false; });
    updateJumpButton();
  }

  viewportEl.addEventListener('scroll', () => {
    if (programmatic) return;
    autoFollow = isNearBottom();
    updateJumpButton();
  }, { passive: true });

  if (jumpButton) {
    jumpButton.addEventListener('click', () => {
      followAnchor = null;
      follow({ force: true, behavior: 'smooth' });
    });
  }

  const content = viewportEl.querySelector('.stream-inner');
  if (content) {
    new ResizeObserver(() => {
      if (autoFollow) syncFollowPosition();
    }).observe(content);
  }

  return {
    follow,
    anchorTurn,
    isFollowing: () => autoFollow,
  };
}
