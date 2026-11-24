// One phi1 drives everything: the panel cursors, the readout, the slider and the 3-D marker.
const slider = $('phi1');
const fmt = (v, n) => v === null ? '—' : v.toFixed(n).replace('-', '−');  // typographic minus
let current = 30, mark = () => {};                       // mark is replaced once the 3-D view has loaded

function setPhi(x) {
  current = x;
  for (const c of cursors) { c.setAttribute('x1', sx(x)); c.setAttribute('x2', sx(x)); }
  slider.value = x;
  mark(x);
  const dm = S.dm(x);
  $('r-phi1').textContent = `φ₁ ${fmt(x, 1)}°`;
  $('r-phi2').textContent = fmt(S.phi2(x), 2) + '°';
  $('r-d').textContent = fmt(dm === null ? null : kpc(dm), 1) + ' kpc';
  $('r-rv').textContent = fmt(S.rv(x), 1) + ' km/s';
}

for (const svg of panels) svg.addEventListener('pointermove', e => setPhi(phiAt(svg, e)));
slider.addEventListener('input', () => setPhi(Math.min(X1 - 1e-6, +slider.value)));
setPhi(current);

startScene().then(f => { mark = f; mark(current); }).catch(e => {
  console.error(e);
  $('scene').textContent = 'The 3-D view needs three.js from cdn.jsdelivr.net, which did not load. Check your connection and reload the page.';
});
