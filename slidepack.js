// SlidePack API の 4 ステップ（セッション作成 → S3 アップロード → レンダリング →
// ダウンロード）。zip は呼び出し側が用意する。

let fs = require("node:fs/promises");

let BASE = process.env.SLIDEPACK_HOST || "https://slidepack.io";

function auth(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}

// 1. セッション作成。既存の未レンダーセッションは破棄される（アカウントに 1 つ）。
async function createSession(apiKey) {
  let res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: auth(apiKey),
  });
  if (!res.ok) throw new Error(`session create failed: HTTP ${res.status}`);
  let { session, upload } = await res.json();
  return { uuid: session.uuid, upload };
}

// 2. zip を S3 へアップロード。params を順番どおりに入れ、file を最後に付ける。
async function uploadZip(upload, zipPath) {
  let form = new FormData();
  for (let [k, v] of Object.entries(upload.params)) form.append(k, v);
  let bytes = await fs.readFile(zipPath);
  form.append("file", new Blob([bytes]), "input.zip");

  let res = await fetch(upload.action, { method: "POST", body: form });
  if (res.status !== 204) {
    throw new Error(`upload failed: HTTP ${res.status}`);
  }
}

// 3. レンダリング。失敗でも HTTP 200 が返るため body を確認する。
async function render(uuid, apiKey) {
  let res = await fetch(`${BASE}/sessions/${uuid}/render`, {
    method: "POST",
    headers: auth(apiKey),
  });
  if (!res.ok) throw new Error(`render request failed: HTTP ${res.status}`);
  let body = await res.json();
  if (!body.session.render_succeeded) {
    throw new Error(`render failed: ${body.session.render_message || "unknown error"}`);
  }
  return body;
}

// 4. 生成 PPTX をダウンロードして保存する。
async function download(url, destPath) {
  let res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

// zip を 1 件レンダリングし PPTX を保存する（セッションは毎回新規）。
async function renderZipToFile(apiKey, zipPath, destPath) {
  let session = await createSession(apiKey);
  await uploadZip(session.upload, zipPath);
  let result = await render(session.uuid, apiKey);
  await download(result.download_url, destPath);
}

module.exports = { renderZipToFile };
