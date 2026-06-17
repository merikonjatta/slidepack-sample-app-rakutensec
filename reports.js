// 全ファンドを順番に処理し、運用レポート PPTX を out/ に出力する。
// ファンドごとに独立処理し、1 件失敗しても残りは続行、いずれか失敗時は非ゼロ終了。

const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { scrapeFund } = require("./scrape");
const { buildData } = require("./transform");
const { renderZipToFile } = require("./slidepack");

const pexec = promisify(execFile);
const OUT_DIR = path.join(__dirname, "out");
const TEMPLATE = path.join(__dirname, "template.pptx");
const IDS = require("./ids.json");

function isoDate(ms) {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

// template.pptx と data.json を zip ルートに収める（-j でパスを捨て basename のみ）。
async function makeZip(workDir, data) {
  const dataPath = path.join(workDir, "data.json");
  await fsp.writeFile(dataPath, JSON.stringify(data));
  const zipPath = path.join(workDir, "input.zip");
  await pexec("zip", ["-j", "-q", zipPath, TEMPLATE, dataPath]);
  return zipPath;
}

async function processFund(id, apiKey) {
  const fund = await scrapeFund(id);
  const data = buildData(fund);
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "fund-"));
  try {
    const zipPath = await makeZip(workDir, data);
    const outPath = path.join(OUT_DIR, `${id}-${isoDate(fund.asOfMs)}.pptx`);
    await renderZipToFile(apiKey, zipPath, outPath);
    return outPath;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const apiKey = process.env.SLIDEPACK_API_KEY;
  if (!apiKey) {
    console.error("SLIDEPACK_API_KEY is not set");
    process.exit(1);
  }
  await fsp.mkdir(OUT_DIR, { recursive: true });

  let failed = 0;
  for (const id of IDS) {
    try {
      const out = await processFund(id, apiKey);
      console.log(`✓ ${id} → ${path.relative(__dirname, out)}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${id}: ${e.message}`);
    }
  }
  console.log(`\n${IDS.length - failed}/${IDS.length} succeeded`);
  process.exit(failed ? 1 : 0);
}

main();
