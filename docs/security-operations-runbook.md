# Security Operations Runbook

更新日: 2026-03-21  
対象サービス: `判断のじかん by SignalMove`

## 目的

Stripe のセキュリティ確認と、その後の継続運用の証跡を残すための運用メモです。  
コードで担保する対策に加えて、端末保護、脆弱性スキャン、通知運用の実施状況をここで確認します。

## 本番運用前提

- 本番アプリは `Vercel` にデプロイする
- 認証 / DB は `Supabase` を利用する
- 決済は `Stripe Checkout / Billing Portal` を利用し、カード情報は自社サーバーで保持しない
- 開発端末 / 運用端末では OS 標準のマルウェア保護機能と自動更新を有効化する

## 管理者アクセス

- 管理画面は `/admin/*` に限定する
- `ADMIN_EMAILS` に登録された管理者のみアクセス可能とする
- `/admin/*` と `/api/admin/*` は `ADMIN_IP_ALLOWLIST` または `ADMIN_BASIC_AUTH_USER` / `ADMIN_BASIC_AUTH_PASSWORD` のどちらかで外側制限を有効にする
- 管理画面は通常ログインに加えて、管理者メール宛てのワンタイムコードで追加確認する
- ワンタイムコード誤入力が `10` 回続いた場合、`30` 分ロックする

## 脆弱性スキャン

週次の GitHub Actions workflow:
- `Weekly Security Scan`
- 依存監査: `npm audit --omit=dev --audit-level=high`
- 動的確認: `ZAP baseline scan` against `https://signal-move.com`

確認手順:
1. GitHub Actions の最新成功 run を開く
2. `dependency-audit-report` artifact を確認する
3. `zap-baseline-report` artifact を確認する
4. 警告または失敗があれば issue 化し、是正後に再実行する
5. 初回ベースラインの記録は [security-scan-evidence-2026-03-21.md](/Users/gota/Documents/src/ai-podcast-platform/docs/security-scan-evidence-2026-03-21.md) に残す

判定ルール:
- `npm audit` は `high` 以上を失敗条件にする
- `ZAP baseline` は `FAIL` と実行エラーを失敗条件にし、`WARN` は artifact を確認して是正管理する

## 端末保護

提出前に確認すること:
- macOS / Windows の自動更新が有効
- OS 標準マルウェア保護機能が有効
- 開発端末で未知のバイナリを恒常的に実行しない
- 本番秘密情報は環境変数で管理し、平文ファイルで共有しない

## ログイン / アカウント変更通知

- ログイン成功時は本人メール宛てに通知を送る
- 設定変更時も本人メール宛てに通知を送る
- `RESEND_API_KEY` と `EMAIL_FROM` を本番環境に設定する
- 本番切替後に、実メールが送達されることを確認する

## 運用記録

提出前の確認ログ:
- [x] 週次スキャン workflow が少なくとも 1 回成功している
- [x] ZAP / npm audit artifact を確認した
- [ ] `ADMIN_IP_ALLOWLIST` または `ADMIN_BASIC_AUTH_*` を本番に設定した
- [ ] 管理者ワンタイムコードの送達を確認した
- [ ] ログイン通知メールの送達を確認した
- [ ] アカウント変更通知メールの送達を確認した
- [ ] 開発端末の OS 更新と標準マルウェア保護が有効
