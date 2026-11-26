// Real page state and translation checks; no rendering engine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
assert.match(html, /id="language-switch"/, 'Page must offer a PT/EN switch');
const saved = new Map();
async function boot(storage = saved) {
  const { window, document } = parseHTML(html);
  // Browser HTML parsers coalesce entity references into surrounding text.
  // LinkeDOM splits them, so normalize adjacent text for realistic copy keys.
  document.normalize();
  const localStorage = { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) };
  const context = vm.createContext({ window, document, localStorage, console, CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver, setTimeout, clearTimeout, startScene: async () => () => {} });
  for (const name of ['spline', 'data', 'plots', 'main', 'lesson-model', 'lesson', 'translations-pt', 'language'])
    vm.runInContext(readFileSync(new URL(`js/${name}.js`, root), 'utf8'), context);
  const get = id => document.getElementById(id);
  const event = (node, type) => node.dispatchEvent(new window.Event(type, { bubbles: true }));
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const choose = async language => { event(document.querySelector(`[data-language="${language}"]`), 'click'); await settle(); };
  await settle();
  return { document, context, get, event, choose, settle };
}
const app = await boot();
const { document, context, get, event, choose, settle } = app;
const knots = get('knots').textContent;
const heading = document.querySelector('h1').textContent;
const links = [...document.querySelectorAll('.term-panel a')].map(a => a.href);
get('sandbox-v-2').value = '2.5'; event(get('sandbox-v-2'), 'input');
get('lesson-phi').value = '45'; event(get('lesson-phi'), 'input');
const curve = get('sandbox-curve').getAttribute('d');
const term = document.querySelector('button.term-hint');
const prose = [];
function collect(node) {
  if (node.nodeType === 3 && /[A-Za-z]{3}/.test(node.textContent) &&
      !node.parentElement.closest('script,style,code,[translate="no"],[data-no-translate]'))
    prose.push([node, node.textContent]);
  else for (const child of node.childNodes || []) collect(child);
}
collect(document.documentElement);
await choose('pt');
const unchanged = new Set(['Natural', 'tridiagonal', 'RR Lyrae', '32.4 kpc', '32.8 kpc',
  'doi:10.1093/mnras/stad551', 'arXiv:2211.04495', 'Zenodo 10.5281/zenodo.7644540', 'segasai/stan-splines']);
assert.deepEqual(prose.filter(([node, source]) => node.textContent === source && !unchanged.has(source.trim()))
  .map(([, source]) => source.trim()), [], 'Every prose fragment must translate; only technical notation and proper references are exempt');
assert.equal(document.documentElement.lang, 'pt-BR');
assert.match(document.querySelector('h1').textContent, /Uma curva suave/);
assert.equal(document.querySelector('[data-language="pt"]').getAttribute('aria-pressed'), 'true');
assert.match(get('hint-distance').textContent, /magnitude aparente/);
assert.match(get('hint-distance').querySelector('.hint-close').getAttribute('aria-label'), /Fechar explicação/);
assert.match(document.querySelector('a[href="#solve"]').textContent, /Resolva e calcule/);
assert.match(get('lesson-data').textContent, /Velocidade radial/);
assert.match(get('lesson-interval').textContent, /Intervalo/);
assert.match(get('sandbox-knot-2').getAttribute('aria-label'), /nó 3/i);
assert.match(get('sandbox-knot-2').getAttribute('aria-valuetext'), /segunda derivada/);
assert.equal(get('sandbox-v-2').value, '2.5');
assert.equal(get('lesson-phi').value, '45');
assert.equal(get('sandbox-curve').getAttribute('d'), curve);
assert.equal(document.querySelector('button.term-hint'), term, 'Switching must preserve nodes and event handlers');
get('lesson-phi').value = '-90'; event(get('lesson-phi'), 'input'); await settle();
assert.equal(get('lesson-result').textContent, 'Indisponível', 'Newly rendered states must follow the chosen language');
get('sandbox-v-2').value = '9'; event(get('sandbox-v-2'), 'input'); await settle();
assert.match(get('sandbox-error').textContent, /digite um número/);
const lateLabel = document.createElement('span'); lateLabel.textContent = 'Galactic centre';
get('scene').appendChild(lateLabel); await settle();
assert.equal(lateLabel.textContent, 'Centro galáctico', 'Asynchronous scene labels use the chosen language');
await new Promise(resolve => setTimeout(resolve, 220));
assert.match(get('sandbox-status').textContent, /recalculadas/);
assert.equal(get('knots').textContent, knots, 'Scientific JSON must remain untouched');
assert.deepEqual([...document.querySelectorAll('.term-panel a')].map(a => a.href), links);
const reload = await boot();
assert.equal(reload.document.documentElement.lang, 'pt-BR', 'Remember choice across reloads');
await choose('en');
assert.equal(document.querySelector('h1').textContent, heading, 'Restore English exactly');
assert.equal(lateLabel.textContent, 'Galactic centre');
assert.equal(get('lesson-result').textContent, 'Unavailable');
assert.match(get('sandbox-error').textContent, /enter a number/);
get('lesson-phi').value = '35'; event(get('lesson-phi'), 'input'); await settle();
assert.match(get('lesson-interval').textContent, /Interval /);
assert.equal(vm.runInContext('current', context), 35);
const blocked = { get() { throw new Error('Storage blocked'); }, set() { throw new Error('Storage blocked'); } };
const privateApp = await boot(blocked); await privateApp.choose('pt');
assert.equal(privateApp.document.documentElement.lang, 'pt-BR', 'Language switching works when storage is blocked');
console.log('PASS: PT/EN content, runtime updates, accessible labels, state preservation, source/data integrity, persistence, and blocked storage.');
