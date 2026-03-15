# Codex AI Development Loop

このディレクトリは、Codex だけで `review -> fix -> verify -> next fix` を回すための最小運用セットです。
長いプロンプトを毎回作り直さず、短い指示と run log だけで、UX 改善と不具合修正を継続できる状態を目的にしています。

## Purpose

- `Decision Assistant` としての UX / 品質を継続改善する
- `Judgment Card`、保存 / 履歴 / 結果、`alerts`、free / paid 差分を同じ観点で見続ける
- レビュー役と実装役を Codex 内で切り替えやすくする
- 作業ログを `ai/runs` に残し、前回判断を次の修正へつなげる

## Directory Layout

- `prompts/review.md`
  UX / 品質レビュー用の共通プロンプト
- `prompts/fix.md`
  レビュー結果から最小修正を進める共通プロンプト
- `prompts/verify.md`
  修正後の再評価と回帰確認用の共通プロンプト
- `prompts/issue-fix.md`
  Critical バグ修正専用プロンプト
- `templates/review-report.md`
  レビュー出力テンプレート
- `templates/fix-plan.md`
  修正計画テンプレート
- `templates/verification-report.md`
  検証出力テンプレート
- `runs/`
  各ループの作業ログ置き場

## Basic Flow

### STEP 1

Codex で `ai/prompts/review.md` を使ってレビューする。

### STEP 2

レビュー結果を `ai/runs/YYYY-MM-DD-<topic>.md` に保存する。

### STEP 3

Codex で `ai/prompts/fix.md` を使って修正する。

### STEP 4

Codex で `ai/prompts/verify.md` を使って再評価する。

### STEP 5

問題が残れば、run log を更新したうえで再度 `fix` に戻る。

## When To Use

- `review`
  新しい UX 改善サイクルを始めるとき
- `fix`
  レビュー結果や既知課題をもとに実装するとき
- `verify`
  修正後に改善確認と回帰確認をするとき
- `issue-fix`
  Critical バグを最短で安全に直したいとき

## Recommended Operation

1. topic ごとに 1 run log を作る
2. レビュー結果は run log の `レビュー結果` に残す
3. 今回触る項目だけ `修正対象` に切り出す
4. 修正内容と確認結果を run log に追記する
5. verify 後に残った問題だけを次のループへ持ち越す

## State Management Format

`ai/runs` の各ファイルは、最低限次の状態を持ちます。

- 背景
- レビュー結果
- 修正対象
- 修正内容
- 検証結果
- 残課題

推奨ファイル名:

- `ai/runs/2026-03-15-demo-auth-fix.md`
- `ai/runs/2026-03-15-mobile-paywall-copy.md`

推奨フォーマット:

```md
# AI Run: <topic>

- Date: YYYY-MM-DD
- Status: review | fixing | verifying | done
- Scope:

## 背景

## レビュー結果

## 修正対象

## 修正内容

## 検証結果

## 残課題
```

## Quick Start

review を始める:

```bash
npm run ai:review -- landing-ux
```

fix を始める:

```bash
npm run ai:fix -- landing-ux
```

verify を始める:

```bash
npm run ai:verify -- landing-ux
```

issue fix を始める:

```bash
npm run ai:issue-fix -- demo-auth
```

上のコマンドは run log を作成し、使う prompt と template を表示します。

## Short Instructions For Codex

- review:
  `ai/prompts/review.md を使って landing-ux をレビューし、結果を ai/runs/... に残して`
- fix:
  `ai/prompts/fix.md を使って landing-ux の P1 を最小修正して`
- verify:
  `ai/prompts/verify.md を使って landing-ux の修正を再評価して`
- issue-fix:
  `ai/prompts/issue-fix.md を使って demo auth の critical bug を直して`

## Project-Specific Review Lens

このリポジトリでは、毎回次の点を確認します。

- `Decision Assistant` として、今日の判断を助けているか
- `Judgment Card` の意味と次の行動が明確か
- 保存 / 履歴 / 結果 の状態モデルが自然か
- `alerts` が再訪理由になっているか
- free / paid の差が成果ベースで伝わるか
- mobile でも主要タスクが完了できるか
