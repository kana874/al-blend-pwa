---
status: verified
reviewed_source: repository-main
last_checked: 2026-08-29
---

# Decisions referenced from existing specifications

この文書は既存仕様への索引であり、数式や履歴を複製しません。

## 10進計算を同梱する

外部CDNへ依存せず、BigInt係数と10進スケール方式の `DecimalLite` を同梱します。中間値は表示桁数で丸めず、秤量器分解能の適用時に指定方式で丸めます。詳細は [CALC_SPEC.mdの数値精度](../CALC_SPEC.md#数値精度) を参照してください。

## 複数元素では共通の最終総重量を考慮する

各添加量による最終総重量の増加は連立で考慮します。一方、添加材の副次成分によるクロス影響はVer.1系では扱いません。詳細は [CALC_SPEC.mdの複数元素](../CALC_SPEC.md#複数元素) を参照してください。

## マスタと履歴の復元は非破壊を基本とする

CSV復元は全行検証後に保存し、同一IDの更新または新規追加を行います。CSVに存在しない既存データは削除しません。詳細は [CALC_SPEC.md](../CALC_SPEC.md) と [RELEASE_NOTES.md](../RELEASE_NOTES.md) を参照してください。
