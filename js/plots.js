// 2-D panels (plain SVG) on a shared phi1 axis: knots, percentile bars and the spline curve,
// plus the solved second derivatives of the v_gsr spline.
const NS = 'http://www.w3.org/2000/svg', W = 600, H = 150, L = 50, R = 8, T = 26, B = 22, X0 = -90, X1 = 120;
const sx = x => L + (x - X0) / (X1 - X0) * (W - L - R);  // shared phi1 axis: union of the knot ranges

function el(tag, attrs, parent) {                        // create an SVG element with attributes
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return parent.appendChild(e);
}

function ticks(a, b) {                                   // 1-2-5 tick values covering [a, b]
  const s = 10 ** Math.floor(Math.log10((b - a) / 3)), step = [1, 2, 5, 10].map(m => m * s).find(v => (b - a) / v <= 5);
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(+v.toFixed(6));
  return out;
}

function axes(svg, y0, y1, label) {                      // grid, ticks and label; returns the y scale
  const pad = (y1 - y0) * 0.08;
  [y0, y1] = [y0 - pad, y1 + pad];
  const sy = y => H - B - (y - y0) / (y1 - y0) * (H - T - B);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  for (const v of ticks(y0, y1)) {
    el('line', { x1: L, x2: W - R, y1: sy(v), y2: sy(v), class: 'grid' }, svg);
    el('text', { x: L - 4, y: sy(v) + 4, 'text-anchor': 'end' }, svg).textContent = v;
  }
  for (const v of ticks(X0, X1)) el('text', { x: sx(v), y: H - 4, 'text-anchor': 'middle' }, svg).textContent = v;
  el('text', { x: L, y: 17, class: 'label' }, svg).textContent = label;
  return sy;
}

const PANELS = [['phi2', 'p-phi2', 'φ₂ [deg]', v => v], ['dm', 'p-dist', 'Distance from Sun [kpc]', kpc], ['rv', 'p-rv', 'v_gsr [km/s]', v => v]];
for (const [k, id, label, f] of PANELS) {                // knots + percentile bars + spline curve
  const t = knots[k], svg = $(id), xs = samples(t.phi1[0], t.phi1.at(-1), 300);
  const ys = xs.map(x => f(S[k](x))), lo = t.p16.map(f), hi = t.p84.map(f);
  if (k === 'dm') {
    const [from, to] = RR_LYRAE_GAP.map(sx);
    el('rect', { x: from, y: T, width: to - from, height: H - T - B, fill: 'currentColor', opacity: 0.12 }, svg);
  }
  const sy = axes(svg, Math.min(...lo, ...ys), Math.max(...hi, ...ys), label);
  if (k === 'rv') {                                      // v_gsr curve takes the Doppler colours by value
    const g = el('linearGradient', { id: 'doppler', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: sy(-200), y2: sy(200) }, el('defs', {}, svg));
    for (const [o, v] of [[0, -200], [0.5, 0], [1, 200]]) el('stop', { offset: o, 'stop-color': css(rvColor(v)) }, g);
  }
  el('path', { d: 'M' + xs.map((x, i) => sx(x).toFixed(1) + ',' + sy(ys[i]).toFixed(1)).join('L'), stroke: k === 'rv' ? 'url(#doppler)' : COL[k], class: 'curve' }, svg);
  t.phi1.forEach((x, i) => {
    const c = k === 'rv' ? css(rvColor(t.val[i])) : COL[k];
    el('line', { x1: sx(x), x2: sx(x), y1: sy(lo[i]), y2: sy(hi[i]), stroke: c, class: 'err' }, svg);
    el('circle', { cx: sx(x), cy: sy(f(t.val[i])), r: 3.2, fill: c }, svg);
  });
}

{                                                        // solved second derivatives z of the v_gsr spline
  const t = knots.rv, z = Z.rv, svg = $('p-z'), sy = axes(svg, Math.min(...z), Math.max(...z), 'z = S″ at v_gsr knots [km/s/deg²]');
  el('line', { x1: L, x2: W - R, y1: sy(0), y2: sy(0), class: 'axis' }, svg);
  t.phi1.forEach((x, i) => {
    const end = i === 0 || i === z.length - 1;
    el('line', { x1: sx(x), x2: sx(x), y1: sy(0), y2: sy(z[i]), class: 'stem err' }, svg);
    el('circle', { cx: sx(x), cy: sy(z[i]), r: end ? 6 : 3, class: end ? 'bc' : 'dot' }, svg);
  });
}

// phi1 cursor lines (moved by main.js) and the pointer -> phi1 mapping, clamped to the shared axis.
const panels = [...document.querySelectorAll('svg.panel')];
const cursors = panels.map(svg => el('line', { y1: T, y2: H - B, class: 'hover' }, svg));
function phiAt(svg, e) {
  const r = svg.getBoundingClientRect(), x = X0 + ((e.clientX - r.left) / r.width * W - L) / (W - L - R) * (X1 - X0);
  return Math.max(X0, Math.min(X1 - 1e-6, x));
}
