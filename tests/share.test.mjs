import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = ['shareUrl', 'restoreSharedSearch'].map(name =>
  html.match(new RegExp(`function ${name}\\(\\) \\{[\\s\\S]*?\\n\\}`))[0]).join('\n');

test('共有URLから検索語と期間を復元し、検索を開始する', () => {
  const inputs = { q: {}, from: {}, to: {} };
  let submissions = 0;
  const context = {
    URL, location: { href: 'https://example.invalid/?q=古い&from=2000&to=2001' },
    state: { query: '環境 & 気候', from: 2010, to: 2020 },
    $: id => inputs[id], form: { requestSubmit: () => { submissions++; } },
  };
  const { shareUrl, restoreSharedSearch } = runInNewContext(`${source}\n({ shareUrl, restoreSharedSearch })`, context);
  const url = new URL(shareUrl());
  assert.equal(url.searchParams.get('q'), '環境 & 気候');
  assert.equal(url.searchParams.get('from'), '2010');
  assert.equal(url.searchParams.get('to'), '2020');
  context.location.href = url.href;
  restoreSharedSearch();
  assert.equal(inputs.q.value, '環境 & 気候');
  assert.equal(inputs.from.value, '2010');
  assert.equal(inputs.to.value, '2020');
  assert.equal(submissions, 1);
});

test('共有用の条件がそろっていないURLでは自動検索しない', () => {
  let submissions = 0;
  const context = { URL, location: { href: 'https://example.invalid/?q=環境' },
    $: () => ({}), form: { requestSubmit: () => { submissions++; } } };
  runInNewContext(`${source}\nrestoreSharedSearch()`, context);
  assert.equal(submissions, 0);
});
