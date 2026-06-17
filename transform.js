// スクレイプ結果を SlidePack の data.json に変換する。
// デッキ構成: タイトル(1) + 基準価額チャート 4 期間(2 を繰り返し) + 統計テーブル(3)。

// 各チャート期間: 遡る月数・月末サンプリングの有無・日付軸の主目盛。
let WINDOWS = [
  { label: "6ヶ月", months: 6, monthEnd: false, unit: "months", major: 1 },
  { label: "1年", months: 12, monthEnd: false, unit: "months", major: 2 },
  { label: "3年", months: 36, monthEnd: true, unit: "months", major: 6 },
  { label: "5年", months: 60, monthEnd: true, unit: "years", major: 1 },
];

let STAT_HEADER = ["", "6ヶ月", "1年", "3年", "5年"];

// スクレイプ行ラベル（ページ表記）→ テーブル表示ラベル（pre-template.pptx のもの）。
let STAT_LABELS = {
  "リターン(年率）": "リターン（年率）",
  "リスク(年率）": "リスク（年率）",
  "シャープレシオ（ＳＲ）": "シャープレシオ",
};

let MS_PER_DAY = 86400000;
let EXCEL_EPOCH_OFFSET = 25569; // 1970-01-01 の Excel シリアル値

let toSerial = (ms) => Math.round(ms / MS_PER_DAY) + EXCEL_EPOCH_OFFSET;

// epoch を N ヶ月遡った時刻（UTC、Highstock の点は UTC 深夜 = 取引日）。
function monthsBefore(ms, months) {
  let d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, d.getUTCDate());
}

// 期間でフィルタし、必要なら各月の最終データ点だけ残す。
function sampleWindow(points, asOfMs, months, monthEnd) {
  let cutoff = monthsBefore(asOfMs, months);
  let inWindow = points.filter(([ts]) => ts >= cutoff);
  if (!monthEnd) return inWindow;
  let lastOfMonth = new Map();
  for (let p of inWindow) {
    let d = new Date(p[0]);
    lastOfMonth.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, p);
  }
  return [...lastOfMonth.values()];
}

function reportDate(asOfMs) {
  let d = new Date(asOfMs);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function chartSlide(fund, win) {
  let anchor = fund.series["基準価額"]; // 全系列は同一タイムスタンプで整列
  let sampled = sampleWindow(anchor, fund.asOfMs, win.months, win.monthEnd);
  let timestamps = sampled.map(([ts]) => ts);

  let series = {};
  let i = 0;
  for (let [name, points] of Object.entries(fund.series)) {
    let byTs = new Map(points.map(([ts, v]) => [ts, v]));
    series[`s${i++}`] = { name, values: timestamps.map((ts) => byTs.get(ts)) };
  }

  let nav_chart = {
    type: "chart",
    date_labels: timestamps.map(toSerial),
    date_labels_format: "yyyy/mm",
    date_labels_major_time_unit: win.unit,
    date_labels_major_unit: win.major,
    axis1: { format: "#,##0", series },
  };

  // 純資産（億円）は桁が異なるため第 2 軸に。NAV と同一タイムスタンプで整列する。
  // 面グラフは基線から塗られるため最小値を 0 に固定する。
  if (fund.netAssets) {
    let byTs = new Map(fund.netAssets.map(([ts, v]) => [ts, v]));
    nav_chart.axis2 = {
      format: "#,##0",
      bounds: { minimum: 0 },
      series: {
        na: {
          name: "純資産（億円）",
          values: timestamps.map((ts) => byTs.get(ts)),
          // 系列の上書きで塗りが失われるため明示する（NAV 折れ線は accent1/2）。
          styles: { shape: { fill: "accent6" } },
        },
      },
    };
  }

  return { template: 2, chart_title: `基準価額（${win.label}）`, nav_chart };
}

// 数値セル: マイナスは reddish(accent4)、プラスは dark gray(dk1)。テーマ定義色のみ使用。
function valueCell(v) {
  let color = v.trim().startsWith("-") ? "accent4" : "dk1";
  return { type: "text", value: v, styles: { font: { color } } };
}

function statsTable(fund) {
  let rows = [STAT_HEADER];
  for (let [label, values] of Object.entries(fund.stats)) {
    rows.push([STAT_LABELS[label], ...values.map(valueCell)]);
  }
  return { template: 3, stats_table: { type: "table", rows } };
}

function buildData(fund) {
  return {
    slides: [
      { template: 1, fund_name: fund.name, report_date: reportDate(fund.asOfMs) },
      ...WINDOWS.map((w) => chartSlide(fund, w)),
      statsTable(fund),
    ],
  };
}

module.exports = { buildData };
