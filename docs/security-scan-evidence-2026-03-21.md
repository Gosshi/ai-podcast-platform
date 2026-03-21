# Security Scan Evidence — 2026-03-21

対象サービス: `判断のじかん by SignalMove`  
公開ドメイン: `https://signal-move.com`

## 実施概要

初回のベースライン確認として、ローカルから依存監査と公開サイトのヘッダ確認を実施した。  
以後の継続実施は GitHub Actions の `Weekly Security Scan` workflow で運用する。

## 1. 依存監査

実施コマンド:

```bash
npm audit --omit=dev --audit-level=high
```

実施日:
- 2026-03-21

結果:
- `high` / `critical` 該当なし
- `moderate` 1 件
- 対象: `next`
- 内容:
  - HTTP request smuggling in rewrites
  - Unbounded `next/image` disk cache growth
  - Unbounded postponed resume buffering
  - null origin による Server Actions / dev HMR の CSRF 回避

補足:
- CLI の終了コードは `0`
- 現行アプリでは `rewrites` を使用していない
- 画像キャッシュや dev HMR の指摘は本番運用に直接一致しないが、Next.js の upstream advisory として継続監視対象にする

対応方針:
- Next.js の修正版が利用可能になり次第アップデートを検討する
- 週次 workflow で継続監視する

## 2. 公開サイトのセキュリティヘッダ確認

実施コマンド:

```bash
curl -I https://signal-move.com
```

実施日:
- 2026-03-21

主要レスポンスヘッダ:

```text
HTTP/2 200
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8
strict-transport-security: max-age=63072000
server: Vercel
x-powered-by: Next.js
```

補足:
- アプリ側では `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` を返す設定を保持している
- CDN / ホスティング設定の反映差異がある場合は、デプロイ後の本番レスポンスを再確認する

## 3. 継続実施の方法

- GitHub Actions: `Weekly Security Scan`
- 依存監査 artifact: `dependency-audit-report`
- 動的確認 artifact: `zap-baseline-report`

実施フロー:
1. 毎週の自動実行または `workflow_dispatch` を実行する
2. artifact を確認する
3. 警告や失敗が出た場合は issue 化し、是正後に再実行する

## 4. 参照

- [/.github/workflows/weekly-security-scan.yml](/Users/gota/Documents/src/ai-podcast-platform/.github/workflows/weekly-security-scan.yml)
- [/next.config.ts](/Users/gota/Documents/src/ai-podcast-platform/next.config.ts)
- [/docs/security-operations-runbook.md](/Users/gota/Documents/src/ai-podcast-platform/docs/security-operations-runbook.md)
