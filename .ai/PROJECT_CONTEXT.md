---
status: verified
reviewed_source: repository-main
last_checked: 2026-08-29
---

# Project context

Al Blend PWAは、純Alから高純度Alを母材とする配合計算、添加確認、歩留まり逆算、希釈計算をブラウザ内で行うPWAです。

## 目的

- Cu、Si、Tiなどの添加量を単一・複数元素条件で計算する。
- wt%、ppm、ppbとmg、g、kg、tの単位を扱う。
- 添加材、秤量器、歩留まり、履歴、配合プリセットを端末内に保存する。
- JSONバックアップと各種CSVの出力・復元を提供する。
- デスクトップとスマートフォンからPWAとして利用できるようにする。

## 境界

- 計算式と数値精度の正本は [CALC_SPEC.md](../CALC_SPEC.md) です。
- 実装済み機能と互換性の正本は [RELEASE_NOTES.md](../RELEASE_NOTES.md) です。
- Ver.1系は複合母合金の副次成分連成計算と製品規格判定を対象外としています。
- データはlocalStorageとIndexedDBへ保存されるため、ブラウザデータ消去に備えてバックアップが必要です。
