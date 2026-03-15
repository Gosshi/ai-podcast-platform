# AI Run: landing-home-loop

- Date: 2026-03-15
- Status: done
- Scope: `/` の未ログイン初回導線、landing CTA の文言と遷移先整合

## 背景

Codex ループ導入後のサンプル運用として、ホーム画面の初見導線を 1 周回した。
対象は `Decision Assistant` の入口である `/` に限定し、未ログイン状態での CTA 期待値ずれを確認する。

## レビュー結果

- UX score: 7/10
- 良い点:
  判断カードのサンプル、保存 / 結果の価値、3 ステップの説明は landing として十分に機能している
- 問題:
  ヒーローの secondary CTA が `今日のおすすめを見る` なのに、未ログイン時は実際には `/login?next=/decisions` へ遷移する
- ユーザー影響:
  「すぐおすすめが見られる」と期待して押した初見ユーザーが、ログイン要求に切り替わって認知負荷が上がる
- 優先度:
  P1
- 最小修正の方向性:
  未ログイン時だけ CTA ラベルを実際の遷移に合わせ、ログインが必要だと先に伝える

## 修正対象

- `/` ヒーロー内の secondary CTA
- landing footer の CTA 文言のログイン状態整合
- login 状態に応じた CTA ラベルの出し分け

## 修正内容

- `app/page.tsx` に login 状態別の CTA label / href 定数を追加
- 未ログイン時の secondary CTA を `ログインして今日のおすすめを見る` に変更
- ログイン済み時の primary CTA を `好みを見直す`、footer secondary CTA を `アカウントを見る` に変更
- footer lead も login 状態に応じて説明文を出し分けるようにした
- 変更範囲は landing page のみで、ルーティングや auth ロジック自体は変更していない

## 検証結果

- `npm run lint`: pass
- `curl -s http://127.0.0.1:3000/` で未ログイン HTML を確認
- 確認できたこと:
  - ヒーロー primary CTA は `はじめる`
  - ヒーロー secondary CTA は `ログインして今日のおすすめを見る`
  - どちらも未ログイン時は `/login?next=/decisions` を向く
- 判断:
  初見ユーザーが secondary CTA を押した時の期待外れは軽減された
- verify 結果:
  今回の修正で landing の初回導線は改善。保存 / 履歴 / 結果 / alerts への全体導線には回帰なし

## 残課題

- browser MCP が既存 Chrome セッションのロックで使えず、視覚確認は未実施
- ログイン済み状態の CTA 出し分けはコード確認ベースで、ブラウザ実機確認は次回の verify で拾う
- footer では未ログイン時に `はじめる` と `ログイン` が依然として近い意味を持つため、次回は CTA 役割の整理を検討してよい
