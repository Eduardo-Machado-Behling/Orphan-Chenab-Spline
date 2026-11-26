// Content integrity and hover/focus controller checks; native popover rendering
// remains the browser's responsibility, simulated only at the DOM API boundary.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const { window, document } = parseHTML(html);
const triggers = [...document.querySelectorAll('.term-hint')];
assert.ok(triggers.length >= 12, 'Specialist terms must have contextual hints');
for (const trigger of triggers) {
  const panel = document.getElementById(trigger.getAttribute('popovertarget'));
  assert.ok(panel, 'Each term must resolve to a hint');
  assert.equal(panel.getAttribute('popover'), 'auto', 'Hints should use native light-dismiss popovers');
  assert.ok(panel.querySelector('p').textContent.trim().split(/\s+/).length >= 15, 'Hints must provide context, not just a synonym');
  assert.ok(panel.querySelector('p').textContent.trim().split(/\s+/).length <= 65, 'Hints should stay brief');
  const source = panel.querySelector('a');
  assert.equal(new URL(source.href).protocol, 'https:');
  assert.ok(source.textContent.trim().length > 8, 'Source link should identify the reference');
  assert.ok(document.getElementById(panel.getAttribute('aria-labelledby')), 'Hint region must be labelled');
}
const scriptPath = new URL('../js/hints.js', import.meta.url);
assert.ok(existsSync(scriptPath), 'Hover enhancement must exist');
const source = readFileSync(scriptPath, 'utf8');
const pending = new Map(); let timer = 0, focused = null;
Object.defineProperty(document, 'activeElement', { get: () => focused });
Object.defineProperty(window, 'innerWidth', { value: 390 });
Object.defineProperty(window, 'innerHeight', { value: 700 });
window.HTMLElement.prototype.focus = function() {
  focused = this;
  this.dispatchEvent(new window.Event('focus'));
};
const toggle = (panel, state) => {
  const before = new window.Event('beforetoggle');
  Object.defineProperty(before, 'newState', { value: state });
  panel.dispatchEvent(before);
  panel._open = state === 'open';
  const after = new window.Event('toggle');
  Object.defineProperty(after, 'newState', { value: state });
  panel.dispatchEvent(after);
};
window.HTMLElement.prototype.showPopover = function() { toggle(this, 'open'); };
window.HTMLElement.prototype.hidePopover = function() { toggle(this, 'closed'); };
for (const panel of document.querySelectorAll('.term-panel')) {
  const matches = panel.matches.bind(panel);
  panel.matches = s => s === ':popover-open' ? !!panel._open : matches(s);
  panel.getBoundingClientRect = () => ({ width: 340, height: 220 });
}
for (const trigger of triggers) trigger.getBoundingClientRect = () => ({ left: 300, right: 370, top: 620, bottom: 644 });
const context = vm.createContext({ window, document, HTMLElement: window.HTMLElement,
  setTimeout: fn => { pending.set(++timer, fn); return timer; }, clearTimeout: id => pending.delete(id),
  requestAnimationFrame: fn => { fn(); return 0; } });
const flush = () => { for (const [id, fn] of [...pending]) { pending.delete(id); fn(); } };
vm.runInContext(source, context);
const first = triggers[0], panel = document.getElementById(first.getAttribute('popovertarget'));
const dispatch = (node, type, fields = {}) => {
  const e = new window.Event(type, { bubbles: true });
  for (const [k, v] of Object.entries(fields)) Object.defineProperty(e, k, { value: v });
  node.dispatchEvent(e);
};
dispatch(first, 'pointerenter', { pointerType: 'mouse' }); flush();
assert.equal(panel._open, true, 'hover opens the paragraph');
assert.equal(first.getAttribute('aria-expanded'), 'true');
assert.ok(parseFloat(panel.style.left) >= 12 && parseFloat(panel.style.left) + 340 <= 378, 'hint fits horizontally on a narrow viewport');
assert.ok(parseFloat(panel.style.top) < 620, 'hint flips above a trigger near the viewport bottom');
assert.equal(parseFloat(panel.style.top) + 220, 620, 'panel touches its trigger so slow pointer movement crosses no dismissal gap');
dispatch(first, 'pointerleave'); dispatch(panel, 'pointerenter'); flush();
assert.equal(panel._open, true, 'moving from term onto source link keeps hint open');
dispatch(panel, 'pointerleave'); flush();
assert.equal(panel._open, false, 'leaving both surfaces dismisses a transient hint');
first.focus();
assert.equal(panel._open, true, 'keyboard focus reveals context');
dispatch(document, 'keydown', { key: 'Escape' });
assert.equal(panel._open, false, 'Escape dismisses without requiring pointer movement');
assert.equal(first.getAttribute('aria-expanded'), 'false');
first.focus();
assert.equal(panel._open, false, 'returning focus during dismissal cannot immediately reopen the hint');
dispatch(first, 'blur'); focused = null;
dispatch(first, 'pointerenter', { pointerType: 'touch' }); flush();
assert.equal(panel._open, false, 'touch hover does not open before the native tap action');

dispatch(first, 'click');
assert.equal(panel._open, true, 'tap/click opens a hint');
dispatch(first, 'pointerleave'); flush();
assert.equal(panel._open, true, 'clicked hints remain open for reading and following links');
const second = triggers[1], secondPanel = document.getElementById(second.getAttribute('popovertarget'));
panel.querySelector('a').focus();
dispatch(second, 'pointerenter', { pointerType: 'mouse' }); flush();
assert.equal(panel._open, true, 'incidental hover preserves a pinned hint and focused source link');
assert.equal(!!secondPanel._open, false, 'a preview cannot replace a hint being used');
dispatch(second, 'click');
assert.equal(panel._open, false, 'opening another hint closes the previous one');
assert.equal(secondPanel._open, true);
secondPanel.querySelector('a').focus();
dispatch(secondPanel.querySelector('.hint-close'), 'click');
assert.equal(secondPanel._open, false, 'Close dismisses a focused hint');
assert.equal(document.activeElement, second, 'Close returns focus to the term without reopening');

// Without the native API, preserve readable explanations and real anchor links.
const fallback = parseHTML(html);
delete fallback.window.HTMLElement.prototype.showPopover;
delete fallback.window.HTMLElement.prototype.hidePopover;
vm.runInNewContext(source, { window: fallback.window, document: fallback.document, HTMLElement: fallback.window.HTMLElement });
assert.ok(fallback.document.querySelector('a.term-hint[href^="#"]'), 'older browsers retain usable glossary links');
assert.equal(fallback.document.querySelectorAll('.term-panel[popover]').length, 0, 'fallback explanations are not hidden');
console.log('PASS: concise sourced hints, hover continuity, keyboard/Escape, viewport placement, touch behavior and readable fallback.');
