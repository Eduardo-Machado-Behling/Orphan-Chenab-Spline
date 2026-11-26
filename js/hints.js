// Native popovers handle tap, light dismissal, Escape and keyboard traversal.
// This enhancement adds hover/focus previews and keeps the paragraph on screen.
(() => {
  const triggers = [...document.querySelectorAll('button.term-hint')];
  if (typeof HTMLElement.prototype.showPopover !== 'function') {
    for (const trigger of triggers) {
      const panel = document.getElementById(trigger.getAttribute('popovertarget'));
      if (!panel) continue;
      panel.removeAttribute('popover');
      panel.querySelector('.hint-close').hidden = true;
      const link = document.createElement('a');
      link.className = 'term-hint'; link.href = `#${panel.id}`;
      link.textContent = trigger.textContent;
      trigger.replaceWith(link);
    }
    const instructions = document.querySelector('.hint-instructions');
    if (instructions) instructions.textContent = 'Follow a dotted-underlined term to its explanation and source below.';
    return;
  }

  let active = null;
  const states = triggers.map(trigger => {
    const panel = document.getElementById(trigger.getAttribute('popovertarget'));
    const state = { trigger, panel, timer: null, pinned: false, dismissed: false, blockFocus: false };
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);
    return state;
  });
  const isOpen = state => state.panel.matches(':popover-open');
  const focusWithin = state => document.activeElement === state.trigger || state.panel.contains(document.activeElement);
  const cancel = state => { clearTimeout(state.timer); state.timer = null; };

  function position(state) {
    if (!isOpen(state)) return;
    const { panel, trigger } = state, rect = trigger.getBoundingClientRect();
    const size = panel.getBoundingClientRect(), gap = 0, edge = 12;
    const width = window.innerWidth, height = window.innerHeight;
    const left = Math.max(edge, Math.min(rect.left, width - size.width - edge));
    const below = rect.bottom + gap;
    const preferredTop = below + size.height <= height - edge ? below : rect.top - gap - size.height;
    const top = Math.max(edge, Math.min(preferredTop, height - size.height - edge));
    Object.assign(panel.style, { margin: '0', left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
  }
  function close(state, restoreFocus = false, userDismiss = false) {
    cancel(state);
    state.dismissed = true;
    state.blockFocus = userDismiss;
    state.pinned = false;
    if (isOpen(state)) state.panel.hidePopover();
    state.trigger.setAttribute('aria-expanded', 'false');
    if (active === state) active = null;
    if (restoreFocus) state.trigger.focus({ preventScroll: true });
  }
  function open(state, preview = false) {
    cancel(state);
    if (state.dismissed) return;
    if (preview && active && active !== state && (active.pinned || focusWithin(active))) return;
    if (active && active !== state) close(active);
    active = state;
    if (!isOpen(state)) state.panel.showPopover({ source: state.trigger });
    state.trigger.setAttribute('aria-expanded', 'true');
    position(state);
  }
  function leave(state) {
    cancel(state);
    state.timer = setTimeout(() => {
      if (!state.pinned && !focusWithin(state)) close(state);
    }, 180);
  }

  for (const state of states) {
    const { trigger, panel } = state;
    trigger.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      state.dismissed = false;
      cancel(state);
      state.timer = setTimeout(() => open(state, true), 140);
    });
    trigger.addEventListener('pointerleave', () => leave(state));
    panel.addEventListener('pointerenter', () => cancel(state));
    panel.addEventListener('pointerleave', () => leave(state));
    trigger.addEventListener('focus', () => {
      if (state.blockFocus) return;
      state.dismissed = false; open(state);
    });
    trigger.addEventListener('blur', () => { state.dismissed = false; state.blockFocus = false; });
    trigger.addEventListener('click', () => {
      state.dismissed = false; state.blockFocus = false; state.pinned = true; open(state);
      // popovertargetaction="show" also works without this script. Clicking an
      // already-hovered term pins it instead of unexpectedly toggling it closed.
    });
    const focusOut = e => {
      if (e.relatedTarget === trigger || panel.contains(e.relatedTarget)) return;
      cancel(state);
      state.timer = setTimeout(() => { if (!focusWithin(state)) close(state); }, 0);
    };
    trigger.addEventListener('focusout', focusOut);
    panel.addEventListener('focusout', focusOut);
    panel.querySelector('.hint-close').addEventListener('click', () => close(state, true, true));
    panel.addEventListener('beforetoggle', e => {
      if (e.newState === 'open') {
        if (active && active !== state) close(active);
        active = state;
        requestAnimationFrame(() => position(state));
      } else {
        cancel(state);
        state.pinned = false;
        state.dismissed = true;
        if (active === state) active = null;
      }
    });
    panel.addEventListener('toggle', e => trigger.setAttribute('aria-expanded', String(e.newState === 'open')));
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active) {
      const state = active;
      const restore = state.panel.contains(document.activeElement);
      close(state, restore, true);
    }
  });
  window.addEventListener('resize', () => { if (active) position(active); });
  window.addEventListener('language-change', () => { if (active) position(active); });
  window.addEventListener('scroll', () => { if (active) position(active); }, { passive: true });
})();
