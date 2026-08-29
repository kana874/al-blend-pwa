# AI access and acceptance matrix

| 利用面 | actor_id | 読取入口 | 書込時の扱い | Phase 3状態 |
| --- | --- | --- | --- | --- |
| ChatGPT Plus（Desktop / Web / Mobile） | `ai:chatgpt` | `.ai/INDEX.md` | GitHub書込能力を推測せず、利用できない場合は提案文を返す | 手動確認待ち |
| Codex Desktop | `ai:codex` | `AGENTS.md` → `.ai/INDEX.md` | 作業ブランチとDraft PRまで | ローカル確認済み |
| Gemini Web | `ai:gemini-web` | GitHub Pagesの `ai-knowledge/` → JSON → `.ai/INDEX.md` | 書込能力を推測せず、利用できない場合は提案文を返す | 互換経路の手動確認待ち |
| Antigravity 2 Desktop | `ai:antigravity-2` | `.agents/rules/shared-knowledge.md` → `.ai/INDEX.md` | 作業ブランチとDraft PRまで。GitHub認証状態を推測しない | 手動確認待ち |

## 共通プローブ

各AIで次を依頼します。

> このリポジトリの `.ai/INDEX.md` を起点に、Phase 3導入候補の `title`、`status`、`provenance.actor_id` をそのまま返してください。取得できない項目は推測せず「取得不可」としてください。

期待値:

- title: `Al Blend PWA共有knowledge導入引き継ぎ`
- status: `candidate`
- provenance.actor_id: `ai:codex`

各画面で同じ期待値が返るまで、Phase 3の複数AI受入は完了扱いにしません。

## Gemini Web互換経路

GitHubとraw.githubusercontent.comを取得できない場合は、次のGitHub Pages URLを使用します。

- `https://kana874.github.io/al-blend-pwa/ai-knowledge/`
- `https://kana874.github.io/al-blend-pwa/ai-knowledge/phase3.json`

この経路は公開可能な最小メタデータだけを掲載し、`.ai/` の内容全体を複製しません。
