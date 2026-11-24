// Knot data (inlined into index.html by tools/prep.py), one spline per table, and shared colours.
const { knots, frame } = JSON.parse(document.getElementById('knots').textContent);
const $ = id => document.getElementById(id);
const kpc = dm => 10 ** (dm / 5 - 2);                    // distance modulus -> kpc
const [LO, HI] = frame.range;                            // phi1 range where all three tables have knots
const RR_LYRAE_GAP = [-10, 20];                           // no likely distance tracers (Koposov et al. 2023, §3.3)
const COL = { phi2: '#b7791f', dm: '#2f8f6f' };

// One spline per table, built by spline.js. S[k](x) is null where findpos rejects x.
const S = {}, Z = {};
for (const [k, t] of Object.entries(knots)) {
  Z[k] = getcoeffs(t.phi1, t.val);
  S[k] = x => {
    try { return evaluate(t.phi1, t.val, Z[k], x); }
    catch (e) { if (!(e instanceof RangeError)) throw e; return null; }   // only "outside the knots" means no value
  };
}

// n samples across [a, b). Stan's findpos is half-open, so the last sample is 1e-6 deg inside the last knot.
const samples = (a, b, n) => Array.from({ length: n }, (_, i) => a + i / (n - 1) * (b - 1e-6 - a));

// GSR velocity colour as sRGB 0-255: blue negative, grey zero, red positive.
// Same stops as the .bar gradient in css/style.css.
function rvColor(rv) {
  const s = Math.max(-1, Math.min(1, rv / 200)), mid = [0x9a, 0xa0, 0xab];
  const end = s < 0 ? [0x2f, 0x6d, 0xb5] : [0xc2, 0x41, 0x2d];
  return mid.map((m, i) => Math.round(m + (end[i] - m) * Math.abs(s)));
}
const css = c => `rgb(${c})`;
