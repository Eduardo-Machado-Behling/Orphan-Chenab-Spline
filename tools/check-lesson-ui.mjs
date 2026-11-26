// Real DOM event integration (no rendering engine). Install with npm ci --prefix tools.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
assert.ok(existsSync(new URL('js/lesson.js', root)), 'The interactive lesson controller must exist');
const { window, document } = parseHTML(html);
const context = vm.createContext({ window, document, console, CustomEvent: window.CustomEvent,
  setTimeout, clearTimeout, startScene: async () => () => {} });
for (const file of ['spline', 'data', 'plots', 'main', 'lesson-model', 'lesson'])
  vm.runInContext(readFileSync(new URL(`js/${file}.js`, root), 'utf8'), context, { filename: file });
const get = id => document.getElementById(id);
const event = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
const published = vm.runInContext('JSON.stringify(knots)', context);

assert.equal(document.querySelectorAll('#sandbox-inputs input').length, 5);
assert.equal(document.querySelectorAll('#published-knots tr').length, 20);
assert.equal(get('sandbox-fields').disabled, false);
assert.equal(get('lesson-phi').disabled, false);
const initialPath = get('sandbox-curve').getAttribute('d');
const initialZ = get('sandbox-derivatives').textContent;
const input = get('sandbox-v-2');
input.value = '2.5'; event(input, 'input');
assert.notEqual(get('sandbox-curve').getAttribute('d'), initialPath, 'numeric editing updates curve');
assert.notEqual(get('sandbox-derivatives').textContent, initialZ, 'numeric editing updates second derivatives');
assert.equal(get('sandbox-knot-2').getAttribute('aria-valuenow'), '2.5');
const validPath = get('sandbox-curve').getAttribute('d');
input.value = ''; event(input, 'input');
assert.equal(input.getAttribute('aria-invalid'), 'true');
assert.equal(get('sandbox-error').hidden, false);
assert.equal(get('sandbox-curve').getAttribute('d'), validPath, 'invalid edit preserves last curve');
input.value = '4'; event(input, 'input');
assert.equal(get('sandbox-curve').getAttribute('d'), validPath, 'out-of-range input preserves last curve');
input.value = '1.25'; event(input, 'input');
assert.equal(get('sandbox-curve').getAttribute('d'), validPath, 'off-step input preserves last curve instead of hiding precision');
input.value = '2.5'; event(input, 'input');
assert.equal(get('sandbox-error').hidden, true);

const up = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(up, 'key', { value: 'ArrowUp' });
get('sandbox-knot-2').dispatchEvent(up);
assert.equal(get('sandbox-knot-2').getAttribute('aria-valuenow'), '2.6', 'arrow keys edit the focused knot');
assert.equal(input.value, '2.6', 'keyboard editing synchronizes numeric input');
event(get('sandbox-reset'), 'click');
assert.equal(get('sandbox-curve').getAttribute('d'), initialPath, 'reset restores the curve');
assert.equal(get('sandbox-derivatives').textContent, initialZ);

// LinkeDOM has no rendering/SVG geometry APIs. Supply a known 2x screen transform
// at that boundary, then exercise the real pointer handlers and resulting curve.
const plot = get('sandbox-plot'), handle = get('sandbox-knot-2');
plot.getScreenCTM = () => ({ inverse: () => ({ a: 0.5, d: 0.5 }) });
plot.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform(m) { return { x: this.x * m.a, y: this.y * m.d }; } });
let captured = false;
handle.setPointerCapture = () => { captured = true; };
handle.hasPointerCapture = () => captured;
handle.releasePointerCapture = () => { captured = false; };
const pointer = (type, y) => {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({ button: 0, isPrimary: true, pointerId: 7, clientX: 600, clientY: y }))
    Object.defineProperty(e, key, { value });
  handle.dispatchEvent(e);
};
pointer('pointerdown', 100);
pointer('pointermove', 55.8);
assert.equal(input.value, '1', 'drag respects the SVG screen transform');
pointer('pointerup', 55.8);
const releasedPath = get('sandbox-curve').getAttribute('d');
pointer('pointermove', 0);
assert.equal(get('sandbox-curve').getAttribute('d'), releasedPath, 'pointer release ends edits');
pointer('pointerdown', 100);
pointer('pointermove', -1000);
assert.equal(input.value, '3', 'drag clamps at the value limit');
pointer('pointercancel', -1000);
const cancelledPath = get('sandbox-curve').getAttribute('d');
pointer('pointermove', 1000);
assert.equal(get('sandbox-curve').getAttribute('d'), cancelledPath, 'cancelled drag does not keep editing');
event(get('sandbox-reset'), 'click');

get('lesson-phi').value = '35.5'; event(get('lesson-phi'), 'input');
assert.equal(vm.runInContext('current', context), 35.5, 'lesson range updates shared selection');
assert.equal(get('r-phi1').textContent, 'φ₁ 35.5°');
assert.match(get('lesson-result').textContent, /km\/s/);
vm.runInContext('setPhi(-90)', context);
assert.equal(get('lesson-work').hidden, true);
assert.equal(get('lesson-unavailable').hidden, false);
assert.equal(get('lesson-result').textContent, 'Unavailable');
assert.equal(get('lesson-coefficients').childElementCount, 0, 'out-of-domain selection clears stale coefficients');
vm.runInContext('setPhi(0)', context);
assert.equal(get('lesson-work').hidden, false);
assert.equal(get('lesson-unavailable').hidden, true);
assert.equal(vm.runInContext('JSON.stringify(knots)', context), published, 'all UI editing preserves published data');
get('phi1').value = '120'; event(get('phi1'), 'input');
assert.equal(vm.runInContext('current', context), 119.5, 'upper slider limit is an honest half-degree sample');
assert.equal(Number(get('lesson-phi').value), 119.5, 'both controls show the actual upper selection');
get('phi1').value = '-90'; event(get('phi1'), 'input');
assert.equal(Number(get('lesson-phi').value), -90, 'both controls show the actual out-of-domain selection');
assert.equal(get('lesson-work').hidden, true);
vm.runInContext('setPhi(119.999999)', context);
assert.equal(get('lesson-position').textContent, '119.5°', 'pointer selection near endpoint cannot round up to the excluded knot');
assert.equal(Number(get('phi1').value), Number(get('lesson-phi').value), 'both ranges stay synchronized');
const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
for (const a of document.querySelectorAll('a[href^="#"]')) assert.ok(get(a.getAttribute('href').slice(1)), 'internal links must resolve');
console.log('PASS: initialization, numeric/keyboard/pointer edits, validation, reset, shared selection and endpoints, unavailable/recovery state, data isolation, and internal links.');
