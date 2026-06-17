// 楽天証券のファンド詳細ページから運用データをスクレイプする。
// データはページ HTML に埋め込まれている（Highstock の系列はインライン JS、
// パフォーマンス指標は静的な HTML テーブル）。ブラウザは不要。

let DETAIL_URL = (id) => `https://www.rakuten-sec.co.jp/web/fund/detail/?ID=${id}`;

// チャートに重ねる系列。ページに存在するものだけ採用する（優先順は表示順）。
// どちらも円単位で同一スケール（分配金なしファンドでは一致＝1 本に見える）。
let CHART_SERIES = ["基準価額", "基準価額+分配金"];

// 純資産（億円）。NAV とは桁が異なるためチャートの第 2 軸に乗せる。
let NET_ASSETS_SERIES = "純資産";

// パフォーマンステーブルから抜き出す行ラベル（完全一致）。
// 半角/全角括弧の混在はページ表記そのまま。楽天証券分類平均・期間の行と区別するため完全一致。
let STAT_ROWS = ["リターン(年率）", "リスク(年率）", "シャープレシオ（ＳＲ）"];

async function fetchPage(id) {
  let res = await fetch(DETAIL_URL(id));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${id}`);
  return res.text();
}

// `name : '<系列名>' … data : [[ts,v],…]` を 1 系列ぶん取り出す。
function extractSeries(html, name) {
  let head = new RegExp(`name\\s*:\\s*'${escapeRe(name)}'`).exec(html);
  if (!head) return null;
  // この系列の name 以降で最初に現れる data 配列を、括弧の対応で正確に切り出す
  // （単純な非貪欲マッチは最初の点 `]` で止まってしまうため括弧深度で走査する）。
  let open = html.indexOf("[", html.indexOf("data", head.index));
  if (open < 0) return null;
  let depth = 0,
    close = open;
  for (; close < html.length; close++) {
    if (html[close] === "[") depth++;
    else if (html[close] === "]" && --depth === 0) break;
  }
  let block = html.slice(open, close + 1);
  let points = [...block.matchAll(/\[(\d{12,13}),([\d.]+)\]/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  return points.length ? points : null;
}

// パフォーマンステーブルを「行ラベル → 4 期間の値」に展開する。
// テーブルの所在は固有ラベル「シャープレシオ（ＳＲ）」を含むことで特定する。
function extractPerfTable(html) {
  let anchor = html.indexOf("シャープレシオ（ＳＲ）");
  if (anchor < 0) return new Map();
  let start = html.lastIndexOf("<table", anchor);
  let end = html.indexOf("</table>", anchor);
  let table = html.slice(start, end);

  let rows = new Map();
  for (let row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    let cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)]
      .map((m) => stripTags(m[1]))
      .filter((c) => c !== "");
    if (cells.length) rows.set(cells[0], cells.slice(1, 5));
  }
  return rows;
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function scrapeFund(id) {
  let html = await fetchPage(id);

  let nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  let name = nameMatch ? stripTags(nameMatch[1]) : id;

  let series = {};
  for (let key of CHART_SERIES) {
    let points = extractSeries(html, key);
    if (points) series[key] = points;
  }
  if (!series["基準価額"]) {
    throw new Error(`基準価額 series not found for ${id}`);
  }

  // 純資産は存在すれば第 2 軸に出す（必須ではない）。
  let netAssets = extractSeries(html, NET_ASSETS_SERIES);

  let perf = extractPerfTable(html);
  let stats = {};
  for (let label of STAT_ROWS) {
    let values = perf.get(label);
    if (!values || values.length !== 4) {
      throw new Error(`stat row "${label}" not found for ${id}`);
    }
    stats[label] = values;
  }

  // 基準日 = 基準価額系列の最終データ点の日付。
  let asOfMs = series["基準価額"].at(-1)[0];

  return { id, name, asOfMs, series, netAssets, stats };
}

module.exports = { scrapeFund };
