// 国会会議録APIのレコードから「政府側の答弁」だけを見分け、集計する。
//
// 見分け方を speakerPosition の有無だけに頼らないのは、実データで
// 民間の参考人（「株式会社◯◯上席研究員」「日本放送協会理事」）にも
// 肩書が入ることが分かったため。政府の公式見解を集めるアプリなので、
// これらを政府として数えると表示そのものが誤情報になる。

/** 民間の参考人・議会側の役職・自治体の機関。ここに当たるものは政府ではない。 */
const NOT_GOVERNMENT = /株式会社|有限会社|一般社団|一般財団|公益社団|公益財団|放送協会|大学|学院|研究所|組合|銀行|協会|連盟|参考人|弁護士|教授|東京消防庁|^議長$|^副議長$|^(衆議院|参議院)/;

/**
 * 官庁名で始まる区切り（「・」「、」まで）の中の「大学」「銀行」「研究所」は、省内の部署名・機関名であって、
 * 民間の所属ではない（例：文部省大学局長、大蔵省銀行局長、防衛省防衛研究所長）。除外の判定の前に外す。
 */
const DEPARTMENT_WORDS = /大学|学院|研究所|銀行/g;

/** 府省庁。長い名前を先に置き、最初に当たったものをその答弁の所管とみなす。 */
const MINISTRIES = [
  '内閣官房', '内閣法制局', '内閣府', '復興庁', 'デジタル庁', 'こども家庭庁',
  '総務省', '法務省', '外務省', '財務省', '文部科学省', '厚生労働省',
  '農林水産省', '経済産業省', '国土交通省', '環境省', '防衛省',
  '金融庁', '消費者庁', '警察庁', '宮内庁', '人事院', '会計検査院',
  '公正取引委員会', '国家公安委員会', '原子力規制庁', '資源エネルギー庁',
  '中小企業庁', '特許庁', '観光庁', '気象庁', '海上保安庁', '国税庁',
  '林野庁', '水産庁', '文化庁', 'スポーツ庁', '防衛装備庁', '出入国在留管理庁',
  // 外局・委員会など、局長・部長などの一般的な役職語だけでは判定しないため、名前で拾う。
  '消防庁', '公安調査庁', '公安審査委員会', '公害等調整委員会', '中央労働委員会',
  '運輸安全委員会', '個人情報保護委員会', '原子力委員会', '内閣情報調査室',
  '国家安全保障局', '検察庁',
  // 1947年から検索するため、再編前の官庁も含める。
  '大蔵省', '文部省', '厚生省', '労働省', '農林省', '通商産業省', '運輸省',
  '建設省', '自治省', '郵政省', '総理府', '経済企画庁', '防衛庁', '環境庁',
  '科学技術庁', '北海道開発庁', '国土庁', '沖縄開発庁',
  '総務庁', '行政管理庁', '社会保険庁', '食糧庁', '原子力規制委員会',
];

/**
 * 役職名から所管を引く。「環境大臣」だけでなく「環境副大臣」「環境大臣政務官」も
 * 拾う必要がある（副大臣は省庁名を含まないため、素朴な文字列一致では取りこぼす）。
 */
const MINISTER_STEMS = [
  ['総務', '総務省'], ['法務', '法務省'], ['外務', '外務省'], ['財務', '財務省'],
  ['文部科学', '文部科学省'], ['厚生労働', '厚生労働省'], ['農林水産', '農林水産省'],
  ['経済産業', '経済産業省'], ['国土交通', '国土交通省'], ['環境', '環境省'],
  ['防衛', '防衛省'], ['復興', '復興庁'], ['デジタル', 'デジタル庁'],
  ['大蔵', '大蔵省'], ['文部', '文部省'], ['厚生', '厚生省'], ['労働', '労働省'],
  ['農林', '農林省'], ['通商産業', '通商産業省'], ['運輸', '運輸省'],
  ['建設', '建設省'], ['自治', '自治省'], ['郵政', '郵政省'],
];
const MINISTER_PATTERNS = [
  [/内閣総理大臣/, '内閣'],
  [/内閣官房長官/, '内閣官房'],
  // 政務次官は、2001年の省庁再編までの副大臣に当たる役職。
  ...MINISTER_STEMS.map(([stem, ministry]) => [
    new RegExp(`${stem}(?:副大臣|大臣政務官|大臣|総括政務次官|政務次官)`), ministry,
  ]),
];

/** 官庁名が無くても政府だと分かる役職。局長・部長等だけでは判定しない。 */
const GOV_ROLE = /内閣総理大臣|国務大臣|政府特別補佐人|内閣審議官|内閣参事官|内閣危機管理監/;

/** 官庁名で始まる区切りの中の「大学」「銀行」「研究所」を外す（除外の判定のため）。 */
function neutralizeDepartments(position) {
  return position.split(/([・、])/)
    .map((part) => (MINISTRIES.some((m) => part.startsWith(m)) ? part.replace(DEPARTMENT_WORDS, '') : part))
    .join('');
}

export function isGovernmentPosition(position) {
  if (!position) return false;
  // 省内の部署名の「大学」「銀行」「研究所」を、民間の所属と区別する。
  if (NOT_GOVERNMENT.test(neutralizeDepartments(position))) return false;
  if (MINISTRIES.some((m) => position.includes(m))) return true;
  return GOV_ROLE.test(position) || MINISTER_PATTERNS.some(([pattern]) => pattern.test(position));
}

/** 答弁者の所管官庁。判別できなければ「その他」。 */
export function ministryOf(position) {
  if (!isGovernmentPosition(position)) return null;
  let best = null;
  for (const m of MINISTRIES) {
    const i = position.indexOf(m);
    if (i !== -1 && (best === null || i < best.index)) best = { index: i, name: m };
  }
  for (const [pattern, ministry] of MINISTER_PATTERNS) {
    const hit = position.match(pattern);
    if (hit && (best === null || hit.index < best.index)) best = { index: hit.index, name: ministry };
  }
  return best ? best.name : 'その他';
}

export function isGovernmentSpeech(record) {
  return isGovernmentPosition(record?.speakerPosition);
}

export function yearOf(record) {
  return Number(String(record?.date || '').slice(0, 4)) || null;
}

/** 年ごとの答弁数。答弁が1件も無い年も0で埋めて、空白期間が見えるようにする。 */
export function aggregateByYear(records) {
  const counts = new Map();
  for (const r of records) {
    const y = yearOf(r);
    if (y) counts.set(y, (counts.get(y) || 0) + 1);
  }
  if (counts.size === 0) return [];
  const years = [...counts.keys()];
  const out = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    out.push({ year: y, count: counts.get(y) || 0 });
  }
  return out;
}

export function aggregateByMinistry(records) {
  const counts = new Map();
  for (const r of records) {
    const m = ministryOf(r.speakerPosition);
    if (m) counts.set(m, (counts.get(m) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([ministry, count]) => ({ ministry, count }))
    .sort((a, b) => b.count - a.count || a.ministry.localeCompare(b.ministry, 'ja'));
}

/** 会議録の発言は「○国務大臣（氏名君）」で始まる。読みやすさのため落とす。 */
export function cleanSpeech(text) {
  if (!text) return '';
  return text.replace(/^○[^　\s]*[　\s]*/, '').replace(/\s+/g, ' ').trim();
}

export function excerpt(text, limit = 140) {
  const t = cleanSpeech(text);
  return t.length <= limit ? t : t.slice(0, limit) + '…';
}

/**
 * レポートに貼る前提の引用文。全文は載せず抜粋＋出典URLにとどめる
 * （発言の著作権は発言者に帰属するため。詳細はREADME）。
 */
export function buildCitation(record, limit = 140) {
  const who = record.speakerPosition ? `${record.speaker}（${record.speakerPosition}）` : record.speaker;
  return [
    `「${excerpt(record.speech, limit)}」`,
    `— ${who}, ${record.nameOfHouse}${record.nameOfMeeting} ${record.date}`,
    `国会会議録検索システム ${record.speechURL}`,
  ].join('\n');
}
