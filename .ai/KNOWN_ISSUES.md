---
status: verified
reviewed_source: repository-main
last_checked: 2026-08-29
---

# Known issues and constraints

## 文書・構成上の既知事項

- README見出しとpackage metadataはVer.1.4.0ですが、リリースノートと実行時UIパッチはVer.1.5.0です。
- Service Workerのキャッシュキーは `al-blend-pwa-v1.5.2` です。表示バージョンとは役割が異なります。
- `al-blend-pwa-v1/` はルートと内容が異なる古いスナップショットです。現行変更ではルート直下を対象とし、両方を機械的に同期しません。

## 製品上の境界

- 複合母合金の副次成分連成計算はVer.2.0対象です。
- 製品規格判定はVer.2.0対象です。
- 端末保存データはブラウザデータ消去で失われる可能性があるため、定期的なJSONバックアップが必要です。

## 未検証項目

- ChatGPT、Gemini Web、Antigravity 2からの共通knowledge読取は、人間による各画面の受入確認が必要です。
- デスクトップ、iOS、Androidの実機PWAインストールとオフライン再起動は、この文書追加では自動検証しません。
