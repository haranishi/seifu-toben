import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// 実際の一覧描画を、通信なしで実行する。
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const drawList = html.match(/let listPage = 0;[\s\S]*?\n\}/)[0];
class Element {
  constructor() { this.children = []; this.textContent = ''; }
  set innerHTML(value) { if (value === '') this.children = []; }
  append(...children) { this.children.push(...children); }
  addEventListener() {}
}
function setup(count) {
  const elements = Object.fromEntries(['cards', 'filter-note', 'list-sub', 'pager', 'page-prev', 'page-next', 'page-status'].map(id => [id, new Element()]));
  const state = { records: Array.from({ length: count }, (_, i) => ({
    date: '2020-01-01', speaker: `発言者${i + 1}`, speakerPosition: '環境大臣',
    speech: '本文', speechURL: 'https://example.invalid/', nameOfHouse: '', nameOfMeeting: '',
  })), year: null, order: 'old' };
  const context = { state, document: { createElement: () => new Element() }, $: id => elements[id],
    ministryOf: () => '環境省', excerpt: text => text, buildCitation: () => '', navigator: {}, setTimeout };
  const { render, setPage } = runInNewContext(`${drawList}; ({ render: renderList, setPage: n => { listPage = n; } })`, context);
  return { elements, state, render, setPage };
}

test('同じ年に600件あっても中央と最後の答弁に到達できる', () => {
  const { elements, render, setPage } = setup(600);
  render();
  assert.equal(elements.cards.children.length, 200);
  assert.equal(elements['page-prev'].disabled, true);
  assert.equal(elements['page-next'].disabled, false);
  setPage(1); render();
  assert.equal(elements.cards.children[99].children[1].textContent, '発言者300（環境大臣）');
  assert.equal(elements['page-status'].textContent, '2 / 3ページ');
  setPage(2); render();
  assert.equal(elements.cards.children[199].children[1].textContent, '発言者600（環境大臣）');
  assert.equal(elements['page-next'].disabled, true);
});

test('ページ送りを隠す hidden 属性が、display:flex の指定で打ち消されない', () => {
  assert.match(html, /\.toolbar\[hidden\]\s*\{\s*display\s*:\s*none\s*\}/);
});

test('200件以下と0件ではページ送りを表示しない', () => {
  for (const count of [0, 200]) {
    const { elements, render } = setup(count);
    render();
    assert.equal(elements.pager.hidden, true);
    assert.equal(elements.cards.children.length, count);
  }
});
