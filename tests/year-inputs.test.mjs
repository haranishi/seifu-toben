import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.match(/function initYearInputs\(\) \{[\s\S]*?\n\}/)[0];

test('日本時間で2027年になれば終了年の初期値と上限が2027年になる', () => {
  const inputs = { from: {}, to: {} };
  const fakeDate = class extends Date { constructor() { super('2026-12-31T15:00:00Z'); } };
  const year = runInNewContext(`${code}; initYearInputs()`, { Intl, Date: fakeDate, $: id => inputs[id] });
  assert.equal(year, 2027);
  assert.equal(inputs.from.max, '2027');
  assert.equal(inputs.to.max, '2027');
  assert.equal(inputs.to.value, '2027');
});
