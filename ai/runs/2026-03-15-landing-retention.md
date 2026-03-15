# AI Run: landing-retention

- Date: 2026-03-15
- Status: done
- Scope: `/` の継続利用導線、alerts / 保存 / 履歴 を再訪理由として伝える

## 背景

2 周目で free / paid の価値差を足したあと、`Decision Assistant` として毎日開く理由が landing から十分に見えるかを再確認した。
特に `alerts`、保存、履歴、結果が次に返る流れを入口段階で理解できるかを見た。

## レビュー結果

- UX score: 8/10
- 問題:
  landing では保存 / 結果の存在は見えるが、通知や履歴が「再訪理由」として独立して伝わっていない
- ユーザー影響:
  単発の判断サービスに見えやすく、継続利用 UX の強みが弱く見える
- 優先度:
  P1
- 最小修正の方向性:
  `通知 / 保存 / 履歴` の 3 面を短い説明と CTA 付きで追加し、前の判断が次に返る構造を示す

## 修正対象

- `/` landing の retention 訴求
- `alerts / saved / history` への auth-aware な CTA
- mobile でも崩れない継続導線カード

## 修正内容

- `app/page.tsx` に auth 状態別の `alertsHref / savedHref / historyHref` を追加
- `retentionFlows` を定義して `通知 / 保存 / 履歴` のカードを新設
- 未ログイン時はそれぞれ対象画面へ戻る `login?next=...` 導線にした
- `app/home.module.css` に retention section / card / link のスタイルを追加

## 検証結果

- `curl -s http://127.0.0.1:3000/` で retention セクションの文言とリンクを確認
- 確認できたこと:
  - `毎日開くと、前の判断が次に返ってきます`
  - `ログインして通知を見る`
  - `ログインして保存を使う`
  - `ログインして履歴を育てる`
- verify 結果:
  landing 上で `alerts / 保存 / 履歴` が再訪理由として明示され、継続利用 UX が伝わりやすくなった
  CTA の auth-aware 導線も保持できている

## 残課題

- browser MCP での視覚確認は未実施
- 実際の logged-in / paid 状態で `通知を見る` `保存を開く` `履歴を見る` に切り替わる表示確認は次回の verify で拾う
