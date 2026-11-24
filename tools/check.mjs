// Checks the page's own spline + frame code against tools/reference.json (scipy + astropy).
// Usage: node tools/check.mjs   (no dependencies)
// The code under test is the page's own js/spline.js and js/coords.js, run as-is. They are classic
// scripts (no exports) because Chrome blocks external module scripts on file://.
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const html = read('../index.html');
const src = read('../js/spline.js') + read('../js/coords.js');
const { getcoeffs, evaluate, findpos, ocToGalcen } = new Function(src + '\nreturn { getcoeffs, evaluate, findpos, ocToGalcen };')();
const { knots, frame } = JSON.parse(html.match(/<script type="application\/json" id="knots">([\s\S]*?)<\/script>/)[1]);
const ref = JSON.parse(read('reference.json'));

const maxErr = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const report = (name, err, tol) => { console.log(`${name.padEnd(26)} max |err| = ${err.toExponential(2)}`); return err < tol; };
let ok = true, z = {};
for (const [k, t] of Object.entries(knots)) {
  z[k] = getcoeffs(t.phi1, t.val);
  ok &= report(`${k}: z vs scipy`, maxErr(z[k], ref[k].z), 1e-9);
  ok &= report(`${k}: S(x) vs scipy`, maxErr(ref[k].phi1.map(x => evaluate(t.phi1, t.val, z[k], x)), ref[k].val), 1e-9);
  ok &= report(`${k}: end z (natural)`, Math.abs(z[k][0]) + Math.abs(z[k].at(-1)), Number.MIN_VALUE);  // must be exactly 0
  for (const x of [t.phi1[0] - 1e-9, t.phi1.at(-1)])               // outside / at the last knot: rejected like Stan
    try { findpos(t.phi1, x); ok = false; console.log(`${k}: findpos accepted ${x}`); } catch {}
}
const S = k => x => evaluate(knots[k].phi1, knots[k].val, z[k], x);
const xyz = ref.pos.phi1.map(x => ocToGalcen(x, S('phi2')(x), 10 ** (S('dm')(x) / 5 - 2), frame));
ok &= report('3-D position [kpc] vs astropy', maxErr(xyz.flat(), ref.pos.xyz.flat()), 1e-9);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
