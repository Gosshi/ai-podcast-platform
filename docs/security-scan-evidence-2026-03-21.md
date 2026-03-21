# Security Scan Evidence — 2026-03-21

対象サービス: `判断のじかん by SignalMove`  
公開ドメイン: `https://signal-move.com`

## 実施概要

初回のベースライン確認として、ローカルから依存監査と公開サイトのヘッダ確認を実施した。  
その後、GitHub Actions の `Weekly Security Scan` workflow を本番ドメインに対して実行し、成功 run と artifact を確認した。

GitHub Actions 実行記録:
- Workflow: `Weekly Security Scan`
- Run URL: [23370409073](https://github.com/Gosshi/ai-podcast-platform/actions/runs/23370409073)
- 実施日: 2026-03-21
- 結果: `success`
- Job:
  - `dependency-audit`: `success`
  - `zap-baseline`: `success`

## 1. 依存監査

実施コマンド:

```bash
npm audit --omit=dev --audit-level=high
```

実施日:
- 2026-03-21
- GitHub Actions run `23370409073` の artifact も確認

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
- `high` 以上が出た場合は issue 化して是正後に再実行する

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
age: 0
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-security-policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' data: blob: https:; frame-src 'self' https:; worker-src 'self' blob:; upgrade-insecure-requests
content-type: text/html; charset=utf-8
cross-origin-embedder-policy: credentialless
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains; preload
server: Vercel
x-content-type-options: nosniff
x-frame-options: DENY
```

補足:
- 本番応答で `CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COEP`, `COOP`, `CORP` を確認した
- HSTS の現行値は `max-age=31536000; includeSubDomains; preload`

## 3. GitHub Actions artifact 確認結果

確認した artifact:
- `dependency-audit-report/npm-audit.json`
- `dependency-audit-report/npm-audit.exitcode`
- `zap-baseline-report/zap-report.md`
- `zap-baseline-report/zap-report.json`
- `zap-baseline-report/zap.exitcode`

確認結果:
- `npm-audit.exitcode`: `0`
- `zap.exitcode`: `2`
- `ZAP` は `High 0 / Medium 6 / Low 0 / Informational 5`
- Medium は CSP の緩い設定と `Cross-Domain Misconfiguration` に関する警告が中心
- 現在の workflow では `WARN` を artifact review に回し、`FAIL` と実行エラーのみ失敗扱いとする

対応メモ:
- Next.js / Turbopack 由来の `unsafe-inline` / `unsafe-eval` を含む CSP は継続的に見直す
- Cross-domain 警告は `connect-src https: wss:` を広めに許可していることに起因するため、利用実態に合わせて段階的に絞る

## 4. 継続実施の方法

- GitHub Actions: `Weekly Security Scan`
- 依存監査 artifact: `dependency-audit-report`
- 動的確認 artifact: `zap-baseline-report`

実施フロー:
1. 毎週の自動実行または `workflow_dispatch` を実行する
2. artifact を確認する
3. 警告や失敗が出た場合は issue 化し、是正後に再実行する

## 5. 参照

- [/.github/workflows/weekly-security-scan.yml](/Users/gota/Documents/src/ai-podcast-platform/.github/workflows/weekly-security-scan.yml)
- [/next.config.ts](/Users/gota/Documents/src/ai-podcast-platform/next.config.ts)
- [/docs/security-operations-runbook.md](/Users/gota/Documents/src/ai-podcast-platform/docs/security-operations-runbook.md)
