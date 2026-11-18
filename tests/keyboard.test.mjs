import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.match(/function renderYears\(rows\) \{[\s\S]*?\n\}/)[0];

test('年の絞り込みを切り替えても同じ棒にフォーカスが残る', () => {
  const doc = { activeElement: null };
  class Element {
    constructor() { this.children = []; this.attributes = {}; }
    set innerHTML(value) {
      if (value === '' && this.children.includes(doc.activeElement)) doc.activeElement = null;
      if (value === '') this.children = [];
    }
    append(child) { this.children.push(child); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, callback) { this[type] = callback; }
    focus() { doc.activeElement = this; }
    click() { this.clickHandler(); }
    set click(callback) { this.clickHandler = callback; }
  }
  const bars = new Element();
  doc.createElement = () => new Element();
  const state = { year: null };
  let listUpdates = 0;
  const renderYears = runInNewContext(`${code}; renderYears`, {
    state, document: doc, $: () => bars, renderList: () => { listUpdates++; },
  });
  renderYears([{ year: 2020, count: 1 }, { year: 2021, count: 2 }]);
  const first = bars.children[0];
  first.focus(); first.clickHandler();
  assert.equal(doc.activeElement, first);
  assert.equal(first.attributes['aria-pressed'], 'true');
  assert.equal(bars.children[1].attributes['aria-pressed'], 'false');
  first.clickHandler();
  assert.equal(doc.activeElement, first);
  assert.equal(first.attributes['aria-pressed'], 'false');
  assert.equal(listUpdates, 2);
});
