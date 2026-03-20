# Stripe セキュリティ対策回答の根拠

更新日: 2026-03-21  
対象サービス: `判断のじかん by SignalMove`  
公開ドメイン: `https://signal-move.com`

## 目的

本書は、Stripe のセキュリティ対策確認画面に入力した回答について、根拠となる実装・運用前提・関連コードを整理するための内部メモです。  
Stripe 画面の回答は本書を基準に見直し、実装または運用が変更された場合は本書も更新します。

## 回答サマリー

- 決済方法: `その他 (Stripe Checkout / Billing Portal)`
- 商品・サービスのオンライン販売: `はい`
- 1. 管理者画面のアクセス制限と管理者の ID / PW 管理: `はい`
- 2. データディレクトリ露出による設定不備対策: `はい`
- 3. Web アプリケーションの脆弱性対策: `はい`
- 4. マルウェア対策としてのウイルス対策ソフトの導入、運用: `はい`
- 5. 悪質な有効性確認、クレジットマスターへの対策: `はい`
- 6. 不正ログイン対策: `はい`
- 委託先情報: `従業員`

## 前提

- 本番環境は `Vercel`、`Supabase`、`Stripe` のマネージド基盤で運用する。
- 決済は `Stripe Checkout` を使用し、カード情報は自社サーバーで保持しない。
- 管理画面は一般会員画面と分離し、管理者メールの許可リストに加えて、管理者専用の追加アクセス確認を要求する。
- 開発端末および運用端末では、OS 標準のセキュリティアップデートとマルウェア保護機能を有効化して運用する。

## 導入方法の予定

会員登録済みユーザーがアプリから有料プラン申込を行うと、サーバーサイドで Stripe Checkout Session を発行し、Stripe がホストする Checkout 画面へ遷移して決済を実施する。決済完了後は Stripe Webhook により会員状態を更新し、契約変更・解約は Stripe Billing Portal を用いて行う。カード情報は自社サーバーでは保持しない。

関連コード:
- [app/api/stripe/subscription-checkout/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/subscription-checkout/route.ts)
- [app/api/stripe/billing-portal/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/billing-portal/route.ts)
- [app/api/stripe/webhook/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/webhook/route.ts)

## 1. 管理者画面のアクセス制限と管理者の ID / PW 管理

回答: `はい`

根拠:
- 管理画面は `/admin/*` 配下に分離している。
- 管理画面の閲覧は `ADMIN_EMAILS` に登録されたメールアドレスに限定する。
- 管理画面へのアクセスには、通常の会員ログインに加えて、管理者専用の追加アクセス確認を要求する。
- 管理者向け追加アクセス確認では、管理者専用パスコードを要求し、10 回連続失敗で一定時間ロックする。

運用前提:
- `ADMIN_EMAILS` を本番環境に設定する。
- `ADMIN_ACCESS_SECRET` と `ADMIN_ACCESS_PASSCODE` を本番環境に設定する。
- 必要に応じて Cloudflare Access 等の上位制御を併用する。

関連コード:
- [app/lib/adminGuard.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/adminGuard.ts)
- [app/lib/adminAccess.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/adminAccess.ts)
- [app/lib/adminAccessToken.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/adminAccessToken.ts)
- [app/admin/access/page.tsx](/Users/gota/Documents/src/ai-podcast-platform/app/admin/access/page.tsx)
- [app/api/admin/access/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/admin/access/route.ts)
- [supabase/migrations/20260321113000_add_admin_access_attempts.sql](/Users/gota/Documents/src/ai-podcast-platform/supabase/migrations/20260321113000_add_admin_access_attempts.sql)

備考:
- Stripe 画面上の「二段階認証または二要素認証」は、会員ログイン済み状態に加えた管理者専用アクセス確認で担保する運用を前提とする。
- 追加で Cloudflare Access などのネットワーク側制御を導入した場合は本書に追記する。

## 2. データディレクトリ露出による設定不備対策

回答: `はい`

根拠:
- 決済情報は Stripe Checkout 側で処理し、カード情報を公開ディレクトリに保存しない。
- アプリの機密情報は環境変数として管理し、公開領域から分離する。
- 会員・課金状態は Supabase 上に保持し、公開ディレクトリから直接参照しない。

関連コード:
- [app/api/stripe/subscription-checkout/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/subscription-checkout/route.ts)
- [app/api/stripe/webhook/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/webhook/route.ts)
- [app/lib/supabaseClients.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/supabaseClients.ts)
- [.env.example](/Users/gota/Documents/src/ai-podcast-platform/.env.example)

備考:
- 本アプリは一般ユーザーからのファイルアップロード機能を提供しない。

## 3. Web アプリケーションの脆弱性対策

回答: `はい`

根拠:
- 状態変更 API では Origin / Referer ベースの CSRF 検証を行う。
- 決済・AI 生成・一般ミューテーション API にレート制限を導入している。
- フロントエンドは Next.js / React の標準エスケープに乗せ、DB 操作は Supabase クライアント経由で実施する。
- CI で継続的に build と test を実行している。
- 週次の脆弱性スキャン workflow を追加し、依存監査 (`npm audit`) と公開サイトへの ZAP baseline scan のレポートを artifact として保管する。

関連コード:
- [app/lib/csrf.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/csrf.ts)
- [app/lib/rateLimit.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/rateLimit.ts)
- [app/api/generate-card/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/generate-card/route.ts)
- [app/api/stripe/subscription-checkout/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/subscription-checkout/route.ts)
- [app/api/stripe/billing-portal/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/billing-portal/route.ts)
- [.github/workflows/ci.yml](/Users/gota/Documents/src/ai-podcast-platform/.github/workflows/ci.yml)
- [.github/workflows/weekly-security-scan.yml](/Users/gota/Documents/src/ai-podcast-platform/.github/workflows/weekly-security-scan.yml)

備考:
- 定期的な脆弱性診断やペネトレーションテストを実施した場合は、実施日・結果・是正内容を本書に追記する。

## 4. マルウェア対策としてのウイルス対策ソフトの導入、運用

回答: `はい`

根拠:
- 本番環境は Vercel / Supabase / Stripe のマネージド基盤を利用し、自社で公開 Web サーバーを直接運用しない。
- 開発端末・運用端末では、OS 標準のセキュリティ更新とマルウェア対策機能を有効化して運用する。

運用前提:
- macOS / Windows 等の標準セキュリティ機能を無効化しない。
- セキュリティアップデートを継続適用する。

備考:
- この項目はコード単体ではなく、運用上の統制を含む。

## 5. 悪質な有効性確認、クレジットマスターへの対策

回答: `はい`

根拠:
- 決済入力は Stripe Checkout 上で行い、Stripe 側のカードテスティング対策の適用を受ける。
- アプリ側でも決済開始 API にレート制限を設け、短時間の大量試行を抑制する。
- Webhook では Stripe 署名検証を行い、決済状態の更新をサーバーサイドで処理する。

関連コード:
- [app/api/stripe/subscription-checkout/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/subscription-checkout/route.ts)
- [app/api/stripe/webhook/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/stripe/webhook/route.ts)
- [app/lib/rateLimit.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/rateLimit.ts)

## 6. 不正ログイン対策

回答: `はい`

選択した対策:
- `ログイン試行回数の制限とスロットリング`
- `ログイン時またはアカウント情報変更時のメール / SMS 通知`

根拠:
- 会員ログインは Supabase Auth のメール Magic Link 方式を採用している。
- ログイン処理はメールリンク送信を伴い、本人のメールアドレスへの通知を兼ねる。
- 認証基盤側のレート制限により、短時間の大量試行を抑制する。
- ログイン成功時にはセキュリティ通知メールを送信し、同一サインインイベントへの重複送信を抑制する。
- ポッドキャストの好み設定や通知設定を変更した場合も、アカウント変更通知メールを送信する。

関連コード:
- [app/components/MemberControls.tsx](/Users/gota/Documents/src/ai-podcast-platform/app/components/MemberControls.tsx)
- [app/api/auth/session/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/auth/session/route.ts)
- [src/lib/supabase/browserClient.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/supabase/browserClient.ts)
- [app/lib/accountSecurityNotifications.ts](/Users/gota/Documents/src/ai-podcast-platform/app/lib/accountSecurityNotifications.ts)
- [app/api/user-preferences/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/user-preferences/route.ts)
- [app/api/alerts/preferences/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/api/alerts/preferences/route.ts)
- [supabase/migrations/20260321153000_add_account_security_notification_state.sql](/Users/gota/Documents/src/ai-podcast-platform/supabase/migrations/20260321153000_add_account_security_notification_state.sql)

## 変更時の更新ルール

- Stripe の回答内容を変更したら、本書を同じブランチで更新する。
- 管理者アクセス制御、認証方式、決済方式、ホスティング構成のいずれかを変更した場合は更新必須とする。
- 脆弱性診断やマルウェア対策の実施手順が明確化された場合は、その内容を追記する。
