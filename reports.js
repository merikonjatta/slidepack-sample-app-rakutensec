// 全ファンドを順番に処理し、運用レポート PPTX を out/ に出力する。
// ファンドごとに独立処理し、1 件失敗しても残りは続行、いずれか失敗時は非ゼロ終了。

let fsp = require("node:fs/promises");
let os = require("node:os");
let path = require("node:path");
let { execFile } = require("node:child_process");
let { promisify } = require("node:util");

let { scrapeFund } = require("./scrape");
let { buildData } = require("./transform");
let { renderZipToFile } = require("./slidepack");

let pexec = promisify(execFile);
let OUT_DIR = path.join(__dirname, "out");
let TEMPLATE = path.join(__dirname, "template.pptx");
let IDS_FILE = path.join(__dirname, "ids.txt");

function isoDate(ms) {
  let d = new Date(ms);
  let mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  let dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

// template.pptx と data.json を zip ルートに収める（-j でパスを捨て basename のみ）。
async function makeZip(workDir, data) {
  let dataPath = path.join(workDir, "data.json");
  await fsp.writeFile(dataPath, JSON.stringify(data));
  let zipPath = path.join(workDir, "input.zip");
  await pexec("zip", ["-j", "-q", zipPath, TEMPLATE, dataPath]);
  return zipPath;
}

async function processFund(id, apiKey) {
  let fund = await scrapeFund(id);
  let data = buildData(fund);
  let workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "fund-"));
  try {
    let zipPath = await makeZip(workDir, data);
    let outPath = path.join(OUT_DIR, `${id}-${isoDate(fund.asOfMs)}.pptx`);
    await renderZipToFile(apiKey, zipPath, outPath);
    return outPath;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

// `--id=<ID>` 指定時はそのファンドだけ処理する。
// 既定は ids.txt の全件（1 行 1 ID、空行は無視）。--id 指定時は ids.txt を読まない。
async function targetIds() {
  let arg = process.argv.find((a) => a.startsWith("--id="));
  if (arg) return [arg.slice("--id=".length)];
  let text = await fsp.readFile(IDS_FILE, "utf8");
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function main() {
  let apiKey = process.env.SLIDEPACK_API_KEY;
  if (!apiKey) {
    console.error("SLIDEPACK_API_KEY is not set");
    process.exit(1);
  }
  await fsp.mkdir(OUT_DIR, { recursive: true });

  let ids = await targetIds();
  let failed = 0;
  for (let id of ids) {
    try {
      let out = await processFund(id, apiKey);
      console.log(`✓ ${id} → ${path.relative(__dirname, out)}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${id}: ${e.message}`);
    }
  }
  console.log(`\n${ids.length - failed}/${ids.length} succeeded`);
  process.exit(failed ? 1 : 0);
}

main();
