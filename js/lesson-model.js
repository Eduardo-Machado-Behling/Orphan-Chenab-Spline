// Inspectable teaching data built from the page's unchanged natural-spline engine.
// Classic script so the lesson, like the original page, also works from file://.
const SplineLesson = (() => {
  function analyze(nodes, values, x) {
    if (!Array.isArray(nodes) || !Array.isArray(values) || nodes.length < 2 || nodes.length !== values.length)
      throw new RangeError('Provide at least two matching knot positions and values.');
    if (![...nodes, ...values, x].every(Number.isFinite))
      throw new RangeError('Knot positions, values, and the query must be finite numbers.');
    if (nodes.some((v, i) => i > 0 && v <= nodes[i - 1]))
      throw new RangeError('Knot positions must be strictly increasing.');
    const interval = findpos(nodes, x), z = getcoeffs(nodes, values);
    const rows = [];
    for (let k = 1; k < nodes.length - 1; k++) {
      const lower = nodes[k] - nodes[k - 1], upper = nodes[k + 1] - nodes[k];
      rows.push({ index: k, lower, diagonal: 2 * (lower + upper), upper,
        rhs: 6 * ((values[k + 1] - values[k]) / upper - (values[k] - values[k - 1]) / lower) });
    }
    const i = interval, h = nodes[i + 1] - nodes[i];
    const coefficients = [values[i], (values[i + 1] - values[i]) / h - h * (2 * z[i] + z[i + 1]) / 6,
      z[i] / 2, (z[i + 1] - z[i]) / (6 * h)];
    return { nodes: [...nodes], values: [...values], z, rows, interval, coefficients,
      value: evaluate(nodes, values, z, x), x };
  }

  function createSandbox() {
    const nodes = [0, 1, 2, 3, 4], initial = [0, 1, 0, 1, 0];
    let values = [...initial];
    return {
      snapshot: (x = 1.5) => analyze(nodes, values, x),
      setValue(index, value) {
        if (!Number.isInteger(index) || index < 0 || index >= nodes.length)
          throw new RangeError('Choose one of the five knots.');
        if (typeof value !== 'number' || !Number.isFinite(value) || value < -3 || value > 3 ||
            Math.abs(value * 10 - Math.round(value * 10)) > 1e-9)
          throw new RangeError('Enter a number between -3 and 3 in increments of 0.1.');
        values[index] = value;
      },
      reset() { values = [...initial]; }
    };
  }
  return { analyze, createSandbox };
})();
