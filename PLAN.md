SlidePack APIを使って投資信託の運用状況をPPTXレポートで出力するNode.jsアプリを作って下さい。

## アプリ仕様

### 実行

`node reports.js` で実行する。
オプションはない。全金融商品のpptxを順番に処理して出力する。

### 入力

ids.json に対象ファンドのID配列がある。
各IDについて https://www.rakuten-sec.co.jp/web/fund/detail/?ID=<ID>
にアクセスし、必要なデータを取得する。

### 出力

1ファンドに対して1件のpptxを出力する。

### その他

- APIキーはmiseによって process.env.SLIDEPACK_API_KEY にロードされたものを利用する。

## 実装方針

1. template.pptxの作成

pre-template.pptx が、イメージする出力内容。ページ数および構成はどのファンドでも共通で固定。
このpre-template.pptxを元にSlidePack用のtemplate.pptxを作成して下さい。
基準価額のチャートは6ヶ月、1年、3年、5年の4スライド生成する。

2. データ変換コードの実装

入力データの内容を確認し、slidepack用data.jsonを生成するモジュールを実装して下さい。

3. アプリケーションにまとめる

`node reports.js` でデータ取得 → SlidePack APIを使用したレンダリングまでできるようまとめます。

4. デバッグ・リファクタリング・クリーンアップ

誰が見てもキレイなコードになるまで徹底的にお掃除すること。
