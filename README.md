# fund-reports

楽天証券のファンド詳細ページをスクレイプし、[SlidePack](https://slidepack.io) で
運用レポート PPTX を生成する Node.js スクリプト

SlidePack SkillをClaudeに与え、
- PLAN.md （指示書）
- pre-template.pptx （出力イメージファイル）
から作らせた。

## 必要なもの

- Node.js 18 以上
- シェルの `zip` コマンド
- `SLIDEPACK_API_KEY` 環境変数

## 実行

```sh
node reports.js            # ids.txt の全 ID を処理
node reports.js --id=<ID>  # 指定したファンドだけ処理（開発・確認用）
```

## 入出力

- 入力: `ids.txt`（1 行 1 ID、空行は無視）。雛形は `ids.example.txt`。
- 出力: `out/{ID}-YYYY-MM-DD.pptx`（日付は基準価額の最新データ日）。

