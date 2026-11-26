// One phi1 drives everything: the panel cursors, the readout, the slider and the 3-D marker.
const slider = $('phi1');
const fmt = (v, n) => v === null ? '—' : v.toFixed(n).replace('-', '−');  // typographic minus
let current = 35, mark = () => {};                       // mark is replaced once the 3-D view has loaded

function setPhi(x) {
  if (!Number.isFinite(x)) return;
  // Share the same half-degree samples across pointer, keyboard and both ranges.
  // The final selectable sample is 119.5°, never a value that rounds to 120°.
  x = Math.max(X0, Math.min(X1 - 0.5, Math.round(x * 2) / 2));
  current = x;
  for (const c of cursors) { c.setAttribute('x1', sx(x)); c.setAttribute('x2', sx(x)); }
  slider.value = x;
  mark(x);
  const dm = S.dm(x);
  $('r-phi1').textContent = `φ₁ ${fmt(x, 1)}°`;
  $('r-phi2').textContent = fmt(S.phi2(x), 2) + '°';
  $('r-d').textContent = fmt(dm === null ? null : kpc(dm), 1) + ' kpc';
  $('r-rv').textContent = fmt(S.rv(x), 1) + ' km/s';
  window.dispatchEvent(new CustomEvent('stream-position', { detail: x }));
}

for (const svg of panels) svg.addEventListener('pointermove', e => setPhi(phiAt(svg, e)));
slider.addEventListener('input', () => setPhi(Number(slider.value)));
setPhi(current);

startScene().then(f => { mark = f; mark(current); }).catch(e => {
  console.error(e);
  $('scene').textContent = 'The 3-D view needs three.js from cdn.jsdelivr.net, which did not load. Check your connection and reload the page.';
});
