// Progressive enhancement for the walkthrough and the isolated illustrative sandbox.
(() => {
  const byId = id => document.getElementById(id);
  const number = (v, digits = 3) => (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits).replace('-', '−');
  const svgNode = (tag, attrs, parent, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return parent.appendChild(node);
  };
  const htmlNode = (tag, parent, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return parent.appendChild(node);
  };
  function chart(svg, xMin, xMax, yMin, yMax, xTicks, yTicks, yLabel, xLabel) {
    svg.setAttribute('viewBox', '0 0 600 320');
    const sx = x => 62 + (x - xMin) / (xMax - xMin) * 510;
    const sy = y => 265 - (y - yMin) / (yMax - yMin) * 221;
    for (const y of yTicks) {
      svgNode('line', { x1: 62, x2: 572, y1: sy(y), y2: sy(y), class: 'grid' }, svg);
      svgNode('text', { x: 50, y: sy(y) + 5, 'text-anchor': 'end' }, svg, number(y, Math.abs(y) < 10 ? 1 : 0));
    }
    for (const x of xTicks) svgNode('text', { x: sx(x), y: 287, 'text-anchor': 'middle' }, svg, number(x, 0));
    svgNode('text', { x: 62, y: 22, class: 'chart-label' }, svg, yLabel);
    svgNode('text', { x: 572, y: 312, 'text-anchor': 'end' }, svg, xLabel);
    return { sx, sy };
  }
  function curvePath(state, scales, from = state.nodes[0], to = state.nodes.at(-1)) {
    return Array.from({ length: 161 }, (_, j) => {
      const x = from + (to - from) * j / 160;
      // Use the known endpoint value for drawing only. evaluate() retains its
      // original half-open domain, and nothing is extrapolated.
      const y = x === state.nodes.at(-1) ? state.values.at(-1) : evaluate(state.nodes, state.values, state.z, x);
      return `${j ? 'L' : 'M'}${scales.sx(x).toFixed(2)},${scales.sy(y).toFixed(2)}`;
    }).join(' ');
  }

  const real = knots.rv, overview = byId('lesson-data');
  const overviewScale = chart(overview, -80, 120, -220, 160, [-80, -40, 0, 40, 80, 120], [-200, -100, 0, 100], 'Radial velocity (km/s)', 'Position along the stream, φ₁ (°)');
  const initialReal = SplineLesson.analyze(real.phi1, real.val, 35);
  const overviewBand = svgNode('rect', { y: 44, height: 221, class: 'interval-band' }, overview);
  svgNode('path', { d: curvePath(initialReal, overviewScale), class: 'spline-line' }, overview);
  svgNode('path', { d: real.phi1.map((x, i) => `${i ? 'L' : 'M'}${overviewScale.sx(x)},${overviewScale.sy(real.val[i])}`).join(' '), class: 'linear-comparison' }, overview);
  real.phi1.forEach((x, i) => {
    const px = overviewScale.sx(x);
    svgNode('line', { x1: px, x2: px, y1: overviewScale.sy(real.p16[i]), y2: overviewScale.sy(real.p84[i]), class: 'axis' }, overview);
    svgNode('circle', { cx: px, cy: overviewScale.sy(real.val[i]), r: 3.5, class: 'sample-dot' }, overview);
    const row = htmlNode('tr', byId('published-knots'));
    htmlNode('td', row, i); htmlNode('td', row, number(x, 0)); htmlNode('td', row, number(real.val[i], 3));
  });
  const overviewPoint = svgNode('circle', { r: 6, class: 'selected-point' }, overview);

  function renderReal(x) {
    const inDomain = Number.isFinite(x) && x >= real.phi1[0] && x < real.phi1.at(-1);
    byId('lesson-position').textContent = `${number(x, 1)}°`;
    byId('lesson-phi').value = x;
    byId('lesson-work').hidden = !inDomain;
    byId('lesson-unavailable').hidden = inDomain;
    overviewPoint.setAttribute('visibility', inDomain ? 'visible' : 'hidden');
    overviewBand.setAttribute('visibility', inDomain ? 'visible' : 'hidden');
    byId('lesson-coefficients').replaceChildren();
    if (!inDomain) {
      byId('evaluation-location').textContent = 'No velocity interval at this position. Return to the selection above.';
      byId('lesson-substitution').textContent = '';
      byId('lesson-result').textContent = 'Unavailable';
      return;
    }
    const state = SplineLesson.analyze(real.phi1, real.val, x);
    const i = state.interval, left = real.phi1[i], right = real.phi1[i + 1];
    byId('lesson-interval').textContent = `Interval ${i}: ${number(left, 0)}° ≤ φ₁ < ${number(right, 0)}°. Width h = ${number(right - left, 0)}°.`;
    const row = state.rows[Math.min(i, state.rows.length - 1)], k = row.index;
    byId('lesson-row-context').textContent = `Interior knot ${k}, at ${number(real.phi1[k], 0)}°. Only its two neighbors enter this row.`;
    byId('lesson-row').textContent = `${number(row.lower, 0)} z[${k - 1}] + ${number(row.diagonal, 0)} z[${k}] + ${number(row.upper, 0)} z[${k + 1}] = ${number(row.rhs, 4)}`;
    byId('lesson-z').textContent = `After solving the full system: z[${k - 1}] = ${number(state.z[k - 1], 5)}, z[${k}] = ${number(state.z[k], 5)}, z[${k + 1}] = ${number(state.z[k + 1], 5)} km/s/deg².`;
    overviewBand.setAttribute('x', overviewScale.sx(left));
    overviewBand.setAttribute('width', overviewScale.sx(right) - overviewScale.sx(left));
    overviewPoint.setAttribute('cx', overviewScale.sx(x)); overviewPoint.setAttribute('cy', overviewScale.sy(state.value));
    const svg = byId('lesson-interval-plot');
    svg.replaceChildren();
    const ys = Array.from({ length: 41 }, (_, j) => evaluate(real.phi1, real.val, state.z, left + (right - left) * j / 41));
    ys.push(real.val[i + 1]);
    const yMin = Math.min(...ys), yMax = Math.max(...ys), pad = Math.max(1, (yMax - yMin) * 0.2);
    const scales = chart(svg, left, right, yMin - pad, yMax + pad, [left, right], [Math.round(yMin), Math.round(yMax)], 'Velocity (km/s)', 'φ₁ (°)');
    svgNode('path', { d: curvePath(state, scales, left, right), class: 'spline-line' }, svg);
    for (const j of [i, i + 1]) svgNode('circle', { cx: scales.sx(real.phi1[j]), cy: scales.sy(real.val[j]), r: 5, class: 'sample-dot' }, svg);
    svgNode('line', { x1: scales.sx(x), x2: scales.sx(x), y1: 44, y2: 265, class: 'selection-line' }, svg);
    svgNode('circle', { cx: scales.sx(x), cy: scales.sy(state.value), r: 6, class: 'selected-point' }, svg);
    svg.setAttribute('aria-label', `Velocity interval from ${left} to ${right} degrees; selected velocity ${number(state.value, 3)} km/s at ${number(x, 1)} degrees.`);
    const t = x - left;
    byId('evaluation-location').textContent = `At x = ${number(x, 1)}°, t = ${number(x, 1)} − (${number(left, 0)}) = ${number(t, 1)}°.`;
    state.coefficients.forEach((value, index) => {
      const item = htmlNode('div', byId('lesson-coefficients'));
      htmlNode('dt', item, ['a (km/s)', 'b (km/s/deg)', 'c (km/s/deg²)', 'd (km/s/deg³)'][index]);
      htmlNode('dd', item, number(value, 6));
    });
    const [a, b, c, d] = state.coefficients;
    byId('lesson-substitution').textContent = `${number(a, 4)} + (${number(b, 4)}) × ${number(t, 1)} + (${number(c, 4)}) × ${number(t, 1)}² + (${number(d, 6)}) × ${number(t, 1)}³`;
    byId('lesson-result').textContent = `${number(state.value, 3)} km/s`;
  }
  byId('lesson-phi').disabled = false;
  byId('lesson-phi').addEventListener('input', e => setPhi(Number(e.target.value)));
  window.addEventListener('stream-position', e => renderReal(e.detail));
  renderReal(current);

  const sandbox = SplineLesson.createSandbox(), sandboxSvg = byId('sandbox-plot');
  // Fixed vertical scale prevents the plot moving under the pointer during edits.
  const scales = chart(sandboxSvg, 0, 4, -5, 5, [0, 1, 2, 3, 4], [-4, -2, 0, 2, 4], 'Illustrative value (no units)', 'Fixed knot position');
  const straight = svgNode('path', { class: 'linear-comparison' }, sandboxSvg);
  const path = svgNode('path', { id: 'sandbox-curve', class: 'spline-line' }, sandboxSvg);
  const inputs = [], handles = [], derivativeValues = [], errors = new Set();
  let drag = null, announcementTimer;
  function errorState() {
    const error = byId('sandbox-error');
    error.hidden = errors.size === 0;
    error.textContent = errors.size ? `Knot ${[...errors].map(i => i + 1).join(', ')}: enter a number from −3 to 3 in increments of 0.1. The curve keeps the last valid value. Reset restores all five knots.` : '';
  }
  function announce(text) {
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => { byId('sandbox-status').textContent = text; }, 180);
  }
  function renderSandbox() {
    const state = sandbox.snapshot();
    path.setAttribute('d', curvePath(state, scales));
    straight.setAttribute('d', state.nodes.map((x, i) => `${i ? 'L' : 'M'}${scales.sx(x)},${scales.sy(state.values[i])}`).join(' '));
    state.nodes.forEach((x, i) => {
      handles[i].setAttribute('transform', `translate(${scales.sx(x)} ${scales.sy(state.values[i])})`);
      handles[i].setAttribute('aria-valuenow', state.values[i]);
      handles[i].setAttribute('aria-valuetext', `${number(state.values[i], 1)}; second derivative ${number(state.z[i], 2)}`);
      if (document.activeElement !== inputs[i] && !errors.has(i)) inputs[i].value = state.values[i];
      derivativeValues[i].textContent = number(state.z[i], 2);
    });
  }
  function edit(index, value, source) {
    try {
      sandbox.setValue(index, value);
      errors.delete(index); inputs[index].removeAttribute('aria-invalid');
      if (source !== 'input') inputs[index].value = value;
      errorState(); renderSandbox();
      announce(`Knot ${index + 1} = ${number(value, 1)}. Curve and second derivatives recalculated; natural boundaries remain zero.`);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      errors.add(index); inputs[index].setAttribute('aria-invalid', 'true'); errorState();
    }
  }
  sandbox.snapshot().nodes.forEach((x, i) => {
    const wrapper = htmlNode('div', byId('sandbox-inputs')); wrapper.className = 'knot-input';
    const label = htmlNode('label', wrapper, `Knot ${i + 1} · x = ${x}`); label.htmlFor = `sandbox-v-${i}`;
    const input = htmlNode('input', wrapper);
    Object.assign(input, { id: `sandbox-v-${i}`, type: 'number', min: '-3', max: '3', step: '0.1' });
    input.setAttribute('aria-describedby', 'sandbox-help sandbox-error');
    input.addEventListener('input', () => edit(i, input.value.trim() === '' ? NaN : Number(input.value), 'input'));
    inputs.push(input);
    const handle = svgNode('g', { id: `sandbox-knot-${i}`, class: 'sandbox-handle', tabindex: 0, role: 'slider',
      'aria-label': `Knot ${i + 1} value at x = ${x}`, 'aria-orientation': 'vertical', 'aria-valuemin': -3, 'aria-valuemax': 3 }, sandboxSvg);
    svgNode('circle', { r: 30, class: 'handle-target' }, handle); svgNode('circle', { r: 7, class: 'handle-dot' }, handle);
    handles.push(handle);
    handle.addEventListener('keydown', e => {
      const old = sandbox.snapshot().values[i];
      const changes = { ArrowUp: 0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowLeft: -0.1, PageUp: 0.5, PageDown: -0.5 };
      if (!(e.key in changes) && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const value = e.key === 'Home' ? -3 : e.key === 'End' ? 3 : old + changes[e.key];
      edit(i, Math.max(-3, Math.min(3, Math.round(value * 10) / 10)), 'keyboard');
    });
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary) return;
      const matrix = sandboxSvg.getScreenCTM();
      if (!matrix) return;
      e.preventDefault(); handle.focus(); handle.setPointerCapture(e.pointerId);
      const point = sandboxSvg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
      drag = { index: i, pointerId: e.pointerId, y: point.matrixTransform(matrix.inverse()).y, value: sandbox.snapshot().values[i] };
    });
    handle.addEventListener('pointermove', e => {
      if (!drag || drag.index !== i || e.pointerId !== drag.pointerId) return;
      const matrix = sandboxSvg.getScreenCTM();
      if (!matrix) return;
      const point = sandboxSvg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
      const value = drag.value - (point.matrixTransform(matrix.inverse()).y - drag.y) / 221 * 10;
      edit(i, Math.max(-3, Math.min(3, Math.round(value * 10) / 10)), 'pointer');
    });
    const endDrag = e => {
      if (drag?.pointerId !== e.pointerId) return;
      drag = null;
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    handle.addEventListener('pointerup', endDrag); handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', () => { if (drag?.index === i) drag = null; });
    const entry = htmlNode('div', byId('sandbox-derivatives'));
    if (i === 0 || i === 4) entry.className = 'boundary';
    htmlNode('dt', entry, `z${i}`); derivativeValues.push(htmlNode('dd', entry));
  });
  byId('sandbox-reset').addEventListener('click', () => {
    drag = null; sandbox.reset(); errors.clear();
    inputs.forEach((input, i) => { input.removeAttribute('aria-invalid'); input.value = sandbox.snapshot().values[i]; });
    errorState(); renderSandbox(); announce('Original five values restored. Published stream measurements are unchanged.');
  });
  renderSandbox();
  byId('sandbox-fields').disabled = false; byId('sandbox-reset').disabled = false;
  byId('sandbox-status').textContent = 'Illustrative values only. Published stream measurements are unchanged.';
})();
