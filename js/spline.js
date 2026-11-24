// Natural cubic spline in moment form. A port (not a copy) of stan/spline.stan from
// github.com/segasai/stan-splines (public, unlicensed; credited in the README).
// Classic script (no import/export) so the page also works from file://; tools/check.mjs runs this file as-is.

// spline_getcoeffs: second derivatives z at every knot, with z = 0 at both ends (natural).
// Interior rows: h[k-1] z[k-1] + 2(h[k-1]+h[k]) z[k] + h[k] z[k+1] = 6(b[k]-b[k-1]).
// Stan solves this with a dense solve (M \ u). The Thomas algorithm gives the same solution.
function getcoeffs(nodes, vals) {
  const n = nodes.length - 1, h = [], b = [];
  for (let i = 0; i < n; i++) {
    h[i] = nodes[i + 1] - nodes[i];
    b[i] = (vals[i + 1] - vals[i]) / h[i];
  }
  const c = [0], d = [0], z = Array(n + 1).fill(0);
  for (let k = 1; k < n; k++) {              // forward sweep (c[0] = d[0] = 0, so row 1 has no sub-diagonal)
    const m = 2 * (h[k - 1] + h[k]) - h[k - 1] * c[k - 1];
    c[k] = h[k] / m;
    d[k] = (6 * (b[k] - b[k - 1]) - h[k - 1] * d[k - 1]) / m;
  }
  for (let k = n - 1; k >= 1; k--) z[k] = d[k] - c[k] * z[k + 1];  // back substitution, z[n] = 0
  return z;
}

// spline_findpos: index i with nodes[i] <= x < nodes[i+1] (half-open, as in Stan).
// Points outside the knot range throw, as Stan's reject() does. Nothing is extrapolated.
function findpos(nodes, x) {
  for (let j = 0; j < nodes.length - 1; j++) if (x >= nodes[j] && x < nodes[j + 1]) return j;
  throw new RangeError('Point outside knot: ' + x);
}

// spline_eval: S(x) on the interval [n_i, n_i+1] that holds x.
function evaluate(nodes, vals, z, x) {
  const i = findpos(nodes, x), h = nodes[i + 1] - nodes[i];
  const a = x - nodes[i], c = nodes[i + 1] - x;
  return z[i + 1] / (6 * h) * a ** 3 + z[i] / (6 * h) * c ** 3
    + (vals[i + 1] / h - h * z[i + 1] / 6) * a + (vals[i] / h - h * z[i] / 6) * c;
}
