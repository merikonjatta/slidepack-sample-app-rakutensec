# slidepack-sample-app-rakutensec

楽天証券のファンド詳細ページをスクレイプし、[SlidePack](https://slidepack.io) で
運用レポート PPTX を生成する Node.js スクリプト

SlidePack SkillをClaudeに与え、
- PLAN.md （指示書）
- pre-template.pptx （出力イメージファイル）

から作らせた。

最初に与えたイメージpptx:

<img width="370" height="610" alt="image" src="https://github.com/user-attachments/assets/b377c6d6-6649-4828-9d47-eee2c4e63869" />

出力結果:

<img width="336" height="914" alt="image" src="https://github.com/user-attachments/assets/541def16-70c3-424a-bbbb-11796b61d93b" />


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

