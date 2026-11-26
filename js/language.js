// Translate text in place: preserve form values, SVG geometry, event handlers,
// open disclosures and the 3-D camera. Scientific JSON/code is never traversed.
(() => {
  const copy = window.SplinePortuguese, controls = document.getElementById('language-switch');
  if (!copy || !controls) return;
  const storageKey = 'oc-splines-language';
  const textState = new WeakMap(), attributeState = new WeakMap();
  const attributes = ['aria-label', 'aria-valuetext', 'title'];
  const excluded = 'script, style, code, [translate="no"], [data-no-translate]';
  let language = 'en';
  // Templates cover text rebuilt by the existing lesson and chart controllers.
  const templates = [
    [/^Close (.+) hint$/, (_, term) => `Fechar explicação: ${copy[term] || term}`],
    [/^Interval (\d+): (.+)\. Width h = (.+)\.$/, (_, i, range, width) => `Intervalo ${i}: ${range}. Largura h = ${width}.`],
    [/^Interior knot (\d+), at (.+)\. Only its two neighbors enter this row\.$/, (_, i, x) => `Nó interno ${i}, em ${x}. Apenas seus dois vizinhos entram nesta linha.`],
    [/^After solving the full system: (.+)$/, (_, values) => `Após resolver o sistema completo: ${values}`],
    [/^Velocity interval from (.+) to (.+) degrees; selected velocity (.+) km\/s at (.+) degrees\.$/, (_, a, b, v, x) => `Intervalo de velocidade de ${a} a ${b} graus; velocidade selecionada de ${v} km/s em ${x} graus.`],
    [/^At x = (.+)$/, (_, equation) => `Em x = ${equation}`],
    [/^Knot (\d+) · x = (.+)$/, (_, i, x) => `Nó ${i} · x = ${x}`],
    [/^Knot (\d+) value at x = (.+)$/, (_, i, x) => `Valor do nó ${i} em x = ${x}`],
    [/^(.+); second derivative (.+)$/, (_, value, z) => `${value}; segunda derivada ${z}`],
    [/^Knot ([\d, ]+): enter a number from −3 to 3 in increments of 0\.1\. The curve keeps the last valid value\. Reset restores all five knots\.$/, (_, indices) => `Nó ${indices}: digite um número de −3 a 3 em passos de 0.1. A curva mantém o último valor válido. Restaurar recupera os cinco nós.`],
    [/^Knot (\d+) = (.+)\. Curve and second derivatives recalculated; natural boundaries remain zero\.$/, (_, i, value) => `Nó ${i} = ${value}. Curva e segundas derivadas recalculadas; as condições de contorno naturais permanecem em zero.`]
  ];
  function translate(source) {
    if (language === 'en') return source;
    const key = source.trim().replace(/\s+/g, ' ');
    let target = copy[key];
    if (target === undefined) {
      for (const [pattern, replacement] of templates) {
        if (pattern.test(key)) { target = key.replace(pattern, replacement); break; }
      }
    }
    if (target === undefined) return source;
    return source.match(/^\s*/)[0] + target + source.match(/\s*$/)[0];
  }
  function updateText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const current = node.textContent;
    let state = textState.get(node);
    if (!state || state.last !== current) state = { english: current };
    const next = translate(state.english);
    state.last = next; textState.set(node, state);
    if (current !== next) node.textContent = next;
  }
  function updateAttributes(node) {
    let states = attributeState.get(node);
    if (!states) { states = {}; attributeState.set(node, states); }
    for (const name of attributes) {
      if (!node.hasAttribute(name)) { delete states[name]; continue; }
      const current = node.getAttribute(name);
      let state = states[name];
      if (!state || state.last !== current) state = { english: current };
      const next = translate(state.english);
      state.last = next; states[name] = state;
      if (current !== next) node.setAttribute(name, next);
    }
  }
  function visit(node) {
    if (node.nodeType === 3) { updateText(node); return; }
    if (node.nodeType !== 1 || node.closest(excluded)) return;
    updateAttributes(node);
    for (const child of node.childNodes) visit(child);
  }
  function select(next, persist = true) {
    language = next === 'pt' ? 'pt' : 'en';
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
    for (const button of controls.querySelectorAll('[data-language]'))
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    visit(document.documentElement);
    if (persist) {
      try { localStorage.setItem(storageKey, language); } catch { /* Storage may be blocked or unavailable on file://. */ }
    }
    window.dispatchEvent(new CustomEvent('language-change', { detail: language }));
  }
  for (const button of controls.querySelectorAll('[data-language]'))
    button.addEventListener('click', () => select(button.dataset.language));
  // Process only changed subtrees, not the whole page during pointer movement.
  // Last-written values prevent our own mutations from being translated again.
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) visit(node);
      else visit(record.target);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: attributes });
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* English remains the default. */ }
  select(saved, false);
  controls.hidden = false;
})();
