import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNdlFetcher, NDL_REQUEST_GAP_MS } from '../lib/ndl.js';

function clock() {
  let time = 0;
  const waits = [];
  return {
    now: () => time,
    advance: (ms) => { time += ms; },
    sleep: async (ms) => { waits.push(ms); time += ms; },
    waits,
  };
}

test('件数確認の最初の取得には待機せず、本文受領後3秒空けてページを取る', async () => {
  const timer = clock();
  const starts = [];
  const request = createNdlFetcher({
    ...timer,
    fetchImpl: async (url) => {
      starts.push({ url, at: timer.now() });
      return { ok: true, json: async () => { timer.advance(50); return { url }; } };
    },
  });
  assert.equal(NDL_REQUEST_GAP_MS, 3000);
  await request('https://example.invalid/count');
  await request('https://example.invalid/page');
  assert.deepEqual(starts.map((s) => s.at), [0, 3050]);
  assert.deepEqual(timer.waits, [3000]);
});

test('同時に要求しても直列に処理し、本文の取得完了から間隔を測る', async () => {
  const timer = clock();
  const starts = [];
  let active = 0;
  let maxActive = 0;
  const request = createNdlFetcher({
    ...timer,
    fetchImpl: async (url) => {
      active++;
      maxActive = Math.max(maxActive, active);
      starts.push(timer.now());
      return { ok: true, json: async () => { timer.advance(25); active--; return { url }; } };
    },
  });
  const results = await Promise.all(['count', 'page1', 'page2'].map((id) => request(`https://example.invalid/${id}`)));
  assert.equal(results.length, 3);
  assert.equal(maxActive, 1);
  assert.deepEqual(starts, [0, 3025, 6050]);
  assert.deepEqual(timer.waits, [3000, 3000]);
});

test('待機時間を超えて利用者が待ったときは余分に待たない', async () => {
  const timer = clock();
  const request = createNdlFetcher({
    ...timer,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  await request('https://example.invalid/count');
  timer.advance(4000);
  await request('https://example.invalid/page');
  assert.deepEqual(timer.waits, []);
});

for (const failure of ['fetch', 'http', 'json']) {
  test(`${failure} の失敗後も3秒待ち、次の取得を再開できる`, async () => {
    const timer = clock();
    const starts = [];
    let attempt = 0;
    let canceled = false;
    const request = createNdlFetcher({
      ...timer,
      fetchImpl: async () => {
        starts.push(timer.now());
        if (++attempt === 1) {
          if (failure === 'fetch') throw new Error('offline');
          if (failure === 'http') return { ok: false, status: 429, body: { cancel: async () => { canceled = true; } } };
          return { ok: true, json: async () => { timer.advance(10); throw new Error('invalid JSON'); } };
        }
        return { ok: true, json: async () => ({ done: true }) };
      },
    });
    await assert.rejects(request('https://example.invalid/first'));
    assert.deepEqual(await request('https://example.invalid/second'), { done: true });
    assert.deepEqual(starts, [0, failure === 'json' ? 3010 : 3000]);
    assert.deepEqual(timer.waits, [3000]);
    if (failure === 'http') assert.equal(canceled, true);
  });
}
