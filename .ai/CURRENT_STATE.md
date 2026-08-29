---
status: verified
reviewed_source: repository-main
last_checked: 2026-08-29
---

# Current state

## バージョン表示

- リリースノートと実行時UIパッチ: `1.5.0`
- ベースHTML、計算エンジン、package metadata: `1.4.0`
- Service Workerキャッシュキー: `1.5.2`

単一の番号へ推測統合せず、現在は上記の分割状態として扱います。

## 実装済み

- 複数元素の共通最終総重量を考慮する配合計算
- 添加確認、歩留まり逆算、希釈計算
- 有効な添加材マスタから生成する元素選択
- 添加材・秤量器マスタとCSV出力・復元
- 計算履歴の自動保存、種類別タブ、CSV出力・復元
- 配合プリセットと標準プリセット19種
- JSONバックアップ・復元
- PWA、オフラインキャッシュ、iPhone/iPad向けホーム画面追加案内
- 依存CDNなしのDecimalLite計算

## 検証基準

ルートで `npm test` を実行し、2026-08-29時点のベースラインは `123 assertions` 成功です。
