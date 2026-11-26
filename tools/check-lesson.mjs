// Behavioral checks for the teaching model. Run with: node tools/check-lesson.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/spline.js', import.meta.url), 'utf8'), ctx);
const source = new URL('../js/lesson-model.js', import.meta.url);
assert.ok(existsSync(source), 'The spline learning model must exist');
vm.runInContext(readFileSync(source, 'utf8'), ctx);
const lesson = vm.runInContext('SplineLesson', ctx);
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, `${message}: ${a} vs ${b}`);
const plain = x => JSON.parse(JSON.stringify(x));

// Three knots (0,0), (1,1), (2,0): 4*z1 = -12, so z = [0,-3,0].
// On the first interval, S(t) = 1.5t - 0.5t^3; S(0.5) = 0.6875.
const example = lesson.analyze([0, 1, 2], [0, 1, 0], 0.5);
assert.deepEqual(plain(example.z), [0, -3, 0]);
assert.deepEqual(plain(example.coefficients), [0, 1.5, 0, -0.5]);
near(example.value, 0.6875, 'hand-derived evaluation');
assert.deepEqual(plain(example.rows), [{ index: 1, lower: 1, diagonal: 4, upper: 1, rhs: -12 }]);
assert.equal(example.interval, 0);

// Nonuniform spacing catches unit-spacing assumptions and broken joins.
const nodes = [-2, -0.5, 1, 4, 6], values = [0.3, -1, 2, 0.8, 1.2];
const original = JSON.stringify([nodes, values]);
const state = lesson.analyze(nodes, values, 0);
for (const row of state.rows) {
  const k = row.index;
  near(row.lower * state.z[k - 1] + row.diagonal * state.z[k] + row.upper * state.z[k + 1], row.rhs, 'matrix row residual');
}
for (let i = 1; i < nodes.length - 1; i++) {
  const left = lesson.analyze(nodes, values, (nodes[i - 1] + nodes[i]) / 2);
  const right = lesson.analyze(nodes, values, nodes[i]);
  const [a, b, c, d] = left.coefficients, h = nodes[i] - nodes[i - 1];
  near(a + b * h + c * h ** 2 + d * h ** 3, values[i], 'left piece interpolates knot');
  near(right.value, values[i], 'right piece interpolates knot');
  near(b + 2 * c * h + 3 * d * h ** 2, right.coefficients[1], 'first derivative continuity');
  near(2 * c + 6 * d * h, 2 * right.coefficients[2], 'second derivative continuity');
}
assert.equal(JSON.stringify([nodes, values]), original, 'analysis cannot mutate source data');
assert.throws(() => lesson.analyze(nodes, values, 6), /outside/i);
assert.throws(() => lesson.analyze(nodes, values, NaN), /finite/i);
assert.throws(() => lesson.analyze([0, 0, 1], [1, 2, 3], 0), /increasing/i);

const sandbox = lesson.createSandbox();
const initial = plain(sandbox.snapshot());
sandbox.setValue(2, 2.5);
const changed = plain(sandbox.snapshot());
assert.equal(changed.values[2], 2.5);
assert.notDeepEqual(changed.z, initial.z, 'editing a knot changes solved second derivatives');
assert.equal(changed.z[0], 0);
assert.equal(changed.z.at(-1), 0);
for (const bad of [NaN, Infinity, '', '2', -3.1, 3.1, 1.25]) {
  assert.throws(() => sandbox.setValue(2, bad), /between|number/i);
}
for (const bad of [-1, 5, 1.5]) assert.throws(() => sandbox.setValue(bad, 0), /knot/i);
assert.deepEqual(plain(sandbox.snapshot()), changed, 'rejected edits must preserve state');
const escaped = sandbox.snapshot();
escaped.values[0] = 999;
escaped.nodes[0] = 999;
assert.equal(sandbox.snapshot().values[0], initial.values[0], 'returned values must be isolated');
assert.equal(sandbox.snapshot().nodes[0], 0, 'returned nodes must be isolated');
sandbox.reset();
assert.deepEqual(plain(sandbox.snapshot()), initial, 'reset restores the initial calculation');
assert.deepEqual(plain(lesson.createSandbox().snapshot()), initial, 'instances must be independent');
console.log('PASS: worked example, matrix residuals, interpolation and derivative continuity, domain validation, edits, reset, and data isolation.');
