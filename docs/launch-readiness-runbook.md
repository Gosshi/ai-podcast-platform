# Launch Readiness Runbook

更新日: 2026-03-21  
対象サービス: `判断のじかん by SignalMove`

## 目的

ローンチ前に残っている公開面・申請面・外部連携面の確認事項を、  
「コードで対応済み」「本番設定待ち」「手動確認が必要」に分けて整理する。

## 現在の整理

### 1. 法務ページ

- 実装済みルート:
  - `/commercial-disclosure`
  - `/terms`
  - `/privacy`
- 共通フッターから常時リンク済み
- 本番前に env 設定が必要:
  - `LEGAL_REPRESENTATIVE_NAME`
  - `LEGAL_ADDRESS`
  - `LEGAL_PHONE_NUMBER` または `LEGAL_PHONE_DISCLOSURE_MODE=request`

補足:
- `特定商取引法に基づく表記` は個人開発向けに `LEGAL_PHONE_DISCLOSURE_MODE=request` を選べる
- この場合、ページ上には「請求があれば遅滞なく開示」と表示し、実際にメールで遅滞なく返せる運用が必要
- `所在地` はメールアドレスではなく住所。自宅公開を避ける場合はバーチャルオフィス利用を前提にする
- 利用規約・プライバシーポリシーは現行機能（Supabase / Stripe / Resend / OpenAI / analytics / admin OTP）に合わせて反映済み

### 2. Podcast RSS

- コード対応済み:
  - `itunes:summary`
  - `itunes:subtitle`
  - `itunes:type=episodic`
  - item ごとの `itunes:episodeType`
  - 音声 URL 拡張子に応じた `enclosure type`
- 本番確認結果:
  - `2026-03-21` 時点で `https://signal-move.com/feed.xml` は channel 自体は配信されているが、`<item>` が 0 件
- 申請前の必須確認:
  - 日本語の `published` エピソードが最低 1 件以上あること
  - そのエピソードに `audio_url` が入っていること
  - Apple Podcasts 提出用として、公開音声フォーマットが `MP3` または `AAC` であることを確認すること

補足:
- 現行パイプラインは `local/VOICEVOX` 系では `.wav` を生成する実装が残っている
- feed 側の MIME 誤表示は修正したが、Apple 提出可否は実ファイル形式に依存する

### 3. アフィリエイト URL

- コード対応済み:
  - `example.com` の直書きを撤去
  - 未設定 URL は非表示扱い
- 本番 env 設定:
  - `NEXT_PUBLIC_AFFILIATE_URL_UNEXT`
  - `NEXT_PUBLIC_AFFILIATE_URL_AUDIBLE`
  - `NEXT_PUBLIC_AFFILIATE_URL_1PASSWORD`
  - `NEXT_PUBLIC_AFFILIATE_URL_NORDVPN`
  - `NEXT_PUBLIC_AFFILIATE_URL_GAMEPASS`

### 4. X 自動投稿

- 現状の GitHub Actions workflow:
  - `app/api/social/twitter-post` で投稿文と OG URL を生成
  - `.github/workflows/twitter-post.yml` は現在まだ「生成内容を出力するだけ」で、X API への実投稿はしていない
- launch 判定:
  - 「自動投稿を必須にする」なら未完
  - 「投稿文の自動生成まででよい」なら運用可

本番確認項目:
- `APP_BASE_URL`
- `CRON_SECRET`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`

### 5. runbook / docs

- 更新済み docs:
  - `docs/external-services-inventory.md`
  - `docs/launch-readiness-runbook.md`
- 別途手動で完了確認すべき項目:
  - 管理者 OTP メールの送達確認
  - 運用端末の OS 更新 / 標準マルウェア保護
  - Apple Podcasts / Spotify 申請実行

## 申請前コマンド

```bash
curl -fsSL https://signal-move.com/feed.xml | sed -n '1,220p'
```

確認ポイント:
- `channel` にタイトル、説明、owner email、image がある
- `item` が 1 件以上ある
- `enclosure` の URL が 200 を返す
- `enclosure type` が実ファイル形式と一致する

## 関連ファイル

- [app/feed.xml/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/feed.xml/route.ts)
- [src/lib/podcastFeed.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/podcastFeed.ts)
- [src/lib/legal.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/legal.ts)
- [src/lib/affiliateLinks.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/affiliateLinks.ts)
- [docs/external-services-inventory.md](/Users/gota/Documents/src/ai-podcast-platform/docs/external-services-inventory.md)
