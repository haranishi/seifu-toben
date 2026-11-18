import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGovernmentPosition, ministryOf, aggregateByYear, aggregateByMinistry,
  cleanSpeech, excerpt, buildCitation, yearOf,
} from '../lib/gov.js';

// 実データ（国会会議録API 2020-2026）で観測した役職をそのまま使う。
const 政府 = [
  '内閣総理大臣', '外務大臣', '防衛大臣', '厚生労働大臣',
  '環境大臣・内閣府特命担当大臣（原子力防災）',
  '内閣府特命担当大臣（沖縄及び北方対策・消費者及び食品安全・こども政策・少子化対策・若者活躍・男女共同参画・地方創生・アイヌ施策・共生・共助）',
  '環境省自然環境局長', '環境省大臣官房審議官', '環境省大臣官房長',
  '農林水産省消費・安全局長', '資源エネルギー庁電力・ガス事業部長',
  '外務省国際協力局長', '内閣府副大臣', '環境大臣政務官', '環境副大臣',
  'こども家庭庁長官官房長', 'デジタル庁統括官', '防衛装備庁防衛技監',
  '内閣官房長官', '宮内庁次長', '法務省民事局長',
];
const 政府でない = [
  '日本放送協会理事', '株式会社ニッセイ基礎研究所上席研究員',
  '参議院事務総長', '衆議院事務総長', '議長',
];

test('実データの政府役職をすべて政府と判定する', () => {
  for (const p of 政府) assert.equal(isGovernmentPosition(p), true, p);
});

test('民間参考人と議会役職を政府から除外する', () => {
  for (const p of 政府でない) assert.equal(isGovernmentPosition(p), false, p);
});

test('役職が空の発言（質問した議員）は政府ではない', () => {
  for (const v of ['', null, undefined]) assert.equal(isGovernmentPosition(v), false);
});

test('国家公安委員会委員長は委員長だが政府に含める', () => {
  assert.equal(isGovernmentPosition('国家公安委員会委員長'), true);
});

test('所管官庁を役職名から引く', () => {
  assert.equal(ministryOf('環境省自然環境局長'), '環境省');
  assert.equal(ministryOf('環境大臣・内閣府特命担当大臣（原子力防災）'), '環境省');
  assert.equal(ministryOf('内閣総理大臣'), '内閣');
  assert.equal(ministryOf('資源エネルギー庁長官'), '資源エネルギー庁');
  assert.equal(ministryOf('日本放送協会理事'), null);
});

test('複合役職では先に書かれたほうを所管とする', () => {
  assert.equal(ministryOf('経済産業大臣・内閣府特命担当大臣（原子力損害賠償・廃炉等支援機構）'), '経済産業省');
});

test('副大臣・政務官も所管を引ける（省庁名を含まないため取りこぼしやすい）', () => {
  assert.equal(ministryOf('環境副大臣'), '環境省');
  assert.equal(ministryOf('外務副大臣'), '外務省');
  assert.equal(ministryOf('環境大臣政務官'), '環境省');
  assert.equal(ministryOf('経済産業副大臣'), '経済産業省');
  assert.equal(ministryOf('デジタル副大臣'), 'デジタル庁');
});

test('府省庁名が無い政府役職はその他に落とす', () => {
  assert.equal(ministryOf('政府特別補佐人'), 'その他');
});

test('答弁が無い年も0で埋める', () => {
  const rows = [{ date: '2020-04-01' }, { date: '2020-06-01' }, { date: '2023-01-01' }];
  assert.deepEqual(aggregateByYear(rows), [
    { year: 2020, count: 2 }, { year: 2021, count: 0 },
    { year: 2022, count: 0 }, { year: 2023, count: 1 },
  ]);
});

test('空配列の年別集計は空を返す', () => {
  assert.deepEqual(aggregateByYear([]), []);
});

test('省庁別集計は件数の多い順に並ぶ', () => {
  const rows = [
    { speakerPosition: '環境省自然環境局長' },
    { speakerPosition: '環境大臣' },
    { speakerPosition: '外務大臣' },
    { speakerPosition: '議長' },
  ];
  assert.deepEqual(aggregateByMinistry(rows), [
    { ministry: '環境省', count: 2 }, { ministry: '外務省', count: 1 },
  ]);
});

test('会議録の話者記号を落とす', () => {
  assert.equal(cleanSpeech('○国務大臣（高市早苗君）　お答えいたします。'), 'お答えいたします。');
});

test('抜粋は上限を超えたら省略記号を付ける', () => {
  assert.equal(excerpt('あ'.repeat(200), 10), 'あ'.repeat(10) + '…');
  assert.equal(excerpt('短い文', 10), '短い文');
});

test('引用は抜粋・発言者・出典URLの3行になる', () => {
  const c = buildCitation({
    speaker: '高市早苗', speakerPosition: '内閣総理大臣',
    nameOfHouse: '衆議院', nameOfMeeting: '予算委員会', date: '2026-07-27',
    speech: '○内閣総理大臣（高市早苗君）　お答えいたします。',
    speechURL: 'https://kokkai.ndl.go.jp/txt/122105261X01720260727/5',
  });
  const lines = c.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '「お答えいたします。」');
  assert.match(lines[1], /高市早苗（内閣総理大臣）, 衆議院予算委員会 2026-07-27/);
  assert.match(lines[2], /kokkai\.ndl\.go\.jp/);
});

test('日付から年を取り出す', () => {
  assert.equal(yearOf({ date: '2026-07-27' }), 2026);
  assert.equal(yearOf({}), null);
});

test('自治体・議会・民間の一般的な役職を政府として数えない', () => {
  for (const p of ['東京都教育庁指導部長', '国立国会図書館調査及び立法考査局長', '日本商工会議所事務局長']) {
    assert.equal(isGovernmentPosition(p), false, p);
  }
});

test('省庁の外局・委員会などの役職は、局長・長官のような役職語だけでも政府として数える', () => {
  for (const p of ['消防庁長官', '公安調査庁次長', '中央労働委員会事務局長', '運輸安全委員会事務局長', '個人情報保護委員会事務局長', '内閣情報調査室内閣情報官']) {
    assert.equal(isGovernmentPosition(p), true, p);
  }
  assert.equal(ministryOf('消防庁次長'), '消防庁');
});

test('再編前の府省庁の役職も政府として数える', () => {
  assert.equal(ministryOf('大蔵省主計局長'), '大蔵省');
  assert.equal(ministryOf('通商産業大臣'), '通商産業省');
});

test('政府機関の事務総長や省内の大学振興課は除外しない', () => {
  assert.equal(ministryOf('公正取引委員会事務総長'), '公正取引委員会');
  assert.equal(ministryOf('文部科学省高等教育局大学振興課長'), '文部科学省');
  assert.equal(isGovernmentPosition('参議院事務総長'), false);
  assert.equal(isGovernmentPosition('東京大学教授'), false);
  assert.equal(isGovernmentPosition('文部科学省大学振興課・東京大学教授'), false);
});

test('省内の部署名に「大学」「銀行」「研究所」を含む役職も、政府として数える', () => {
  assert.equal(ministryOf('文部省大学局長'), '文部省');
  assert.equal(ministryOf('文部科学省高等教育局国立大学法人支援課長'), '文部科学省');
  assert.equal(ministryOf('大蔵省銀行局長'), '大蔵省');
  assert.equal(ministryOf('金融庁監督局銀行第一課長'), '金融庁');
  assert.equal(ministryOf('防衛省防衛研究所長'), '防衛省');
  // 複合肩書は、区切りごとに見る。官庁の部署名は政府、民間の所属が混じるものは除外する
  assert.equal(isGovernmentPosition('内閣官房内閣参事官・文部科学省高等教育局大学振興課長'), true);
  assert.equal(isGovernmentPosition('財務省大臣官房参事官・日本銀行理事'), false);
  assert.equal(isGovernmentPosition('日本銀行理事'), false);
});

test('再編前の外局・政務次官・官庁名を省いた内閣の役職も、政府として数える', () => {
  for (const p of ['総務庁長官', '行政管理庁長官', '社会保険庁長官', '食糧庁長官', '原子力規制委員会事務局長', '内閣審議官', '大蔵政務次官', '通商産業総括政務次官']) {
    assert.equal(isGovernmentPosition(p), true, p);
  }
  assert.equal(ministryOf('大蔵政務次官'), '大蔵省');
});

test('自治体の消防は、国の消防庁と区別して、政府として数えない', () => {
  for (const p of ['東京消防庁消防総監', '東京消防庁予防部長', '東京消防庁次長']) {
    assert.equal(isGovernmentPosition(p), false, p);
  }
  assert.equal(isGovernmentPosition('総務省消防庁次長'), true);
});
