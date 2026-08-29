# Al Blend PWA knowledge index

この索引は、ChatGPT、Codex、Gemini Web、Antigravity 2が同じプロジェクト情報へ到達するための入口です。

## 正本

- [計算仕様](../CALC_SPEC.md) — 数式、複数元素、精度、保存・復元仕様
- [リリースノート](../RELEASE_NOTES.md) — 実装済み変更とバージョン履歴
- [README](../README.md) — 利用方法、機能概要、保存データ

## 構造化knowledge

- [プロジェクト概要](PROJECT_CONTEXT.md) — `verified`
- [現在の状態](CURRENT_STATE.md) — `verified`
- [仕様から確認できる設計上の選択](DECISIONS.md) — `verified`
- [既知事項と未検証項目](KNOWN_ISSUES.md) — `verified`
- [追跡する作業](TASKS.md)
- [AI別アクセス・受入マトリクス](AI_ACCESS_MATRIX.md)

## 候補と引き継ぎ

- [Phase 3導入候補](inbox/knw_20260829_ab01a1b2-shared-knowledge-rollout.md) — `candidate`
- [引き継ぎの書き方](handoffs/README.md)

## 読み方

1. 計算内容の質問では `CALC_SPEC.md` を優先する。
2. 実装時期や互換性の質問では `RELEASE_NOTES.md` を優先する。
3. `status: verified` を確認済み情報として扱い、`candidate` と未検証項目は明示する。
4. ルート直下を現行配布対象として扱い、`al-blend-pwa-v1/` は比較が必要な場合だけ参照する。
5. このPublicリポジトリへprivateな横断knowledgeを複製しない。
