// Run with: node --test "site/scripts/*.test.mjs"
// Exercises site/static/js/tema.js against a minimal fake document and storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'switching-manual:theme';
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'js', 'tema.js'), 'utf8');

function element() {
  const attrs = new Map();
  const listeners = {};
  return {
    hidden: true,
    textContent: '',
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: k => attrs.delete(k),
    getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    fire: type => listeners[type](),
  };
}

/** Loads tema.js with a fake page; storage can be a Map or a function that throws (blocked storage). */
function load(stored) {
  const store = new Map(stored === undefined ? [] : [[KEY, stored]]);
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  const html = element();
  const button = element();
  const page = element();
  const document = { documentElement: html, addEventListener: page.addEventListener, querySelector: () => button };
  new Function('document', 'localStorage', source)(document, localStorage);
  return { html, button, store, ready: () => page.fire('DOMContentLoaded') };
}

test('applies the saved theme before the page is ready, as the guides and the app do', () => {
  const { html, button, ready } = load('"dark"');
  assert.equal(html.getAttribute('data-theme'), 'dark');
  ready();
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, 'Tema: Oscuro');
  assert.equal(button.getAttribute('aria-label'), 'Tema: Oscuro. Cambiar a Sistema');
});

test('cycles system, light and dark and saves each choice under the shared key', () => {
  const { html, button, store, ready } = load(undefined);
  ready();
  assert.equal(html.getAttribute('data-theme'), null);
  assert.equal(button.getAttribute('aria-label'), 'Tema: Sistema. Cambiar a Claro');
  button.fire('click');
  assert.equal(html.getAttribute('data-theme'), 'light');
  assert.equal(store.get(KEY), '"light"');
  button.fire('click');
  assert.equal(html.getAttribute('data-theme'), 'dark');
  assert.equal(store.get(KEY), '"dark"');
  button.fire('click');
  assert.equal(html.getAttribute('data-theme'), null);
  assert.equal(store.get(KEY), '"system"');
});

test('falls back to the system theme when the saved value is not valid', () => {
  for (const value of ['not json', '"purple"', '42']) {
    const { html, button, ready } = load(value);
    ready();
    assert.equal(html.getAttribute('data-theme'), null, value);
    assert.equal(button.textContent, 'Tema: Sistema', value);
  }
});

test('keeps working when the browser blocks storage', () => {
  const html = element();
  const button = element();
  const page = element();
  const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
  const document = { documentElement: html, addEventListener: page.addEventListener, querySelector: () => button };
  new Function('document', 'localStorage', source)(document, blocked);
  page.fire('DOMContentLoaded');
  button.fire('click');
  assert.equal(html.getAttribute('data-theme'), 'light');
  assert.equal(button.textContent, 'Tema: Claro');
});
