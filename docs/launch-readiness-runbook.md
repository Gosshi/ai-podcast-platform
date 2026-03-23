# Launch Readiness Runbook

更新日: 2026-03-23  
対象サービス: `判断のじかん by SignalMove`

## 目的

ローンチ前に残っている公開面・申請面・外部連携面の確認事項を、  
「コードで対応済み」「本番設定待ち」「手動確認が必要」に分けて整理する。

## Phase 1 Checklist

### 今週やること

- [x] Apple Podcasts 申請を出す
- [x] Spotify 申請を出す
- [x] X アカウントを作る
- [x] X のプロフィール、固定ポスト、リンク先を整える
- [x] `LEGAL_REPRESENTATIVE_NAME` を本番値で確定する
- [x] `LEGAL_ADDRESS` を本番値で確定する
- [x] GMO を契約し、住所を本番反映する

補足:
- Apple Podcasts は公開済み
- Spotify は公開済み: `https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH`
- X アカウントは `@signalmove_jp` で手動運用を開始できる状態

### 今はやらないこと

- [ ] `daily-generate` の本番自動運用
- [ ] OpenAI を使う日次自動生成の常時実行
- [ ] 広告費を使った拡大

補足:
- リリースまでは OpenAI コスト抑制のため、公開エピソードは手動作成・手動公開を前提にする
- 日次自動生成の配線は残してあるが、現時点では本番安定運用の前提に置かない
- `Scheduled Daily Publish` と X 自動投稿 workflow は、明示的に有効化するまでは manual-only で扱う

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
  - feed には `MP3/AAC/M4A` の公開音声だけを載せる
  - `/api/tts` は本番では `Supabase Storage` の `audio` bucket に保存する
- 本番確認結果:
  - `2026-03-22` 時点で `https://signal-move.com/feed.xml` は `<item>` が 1 件以上ある
  - `enclosure type="audio/mpeg"` の公開 `mp3` が配信されている
  - 公開音声 URL は `Supabase Storage` の public URL で 200 を返す
  - show cover は `https://signal-move.com/podcast-cover.png` で配信し、`3000x3000` の PNG を返す
  - 公開 permalink は `https://signal-move.com/episodes/<id>` で 200 を返す
  - 公開済み Spotify listing: `https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH`
- 申請前の必須確認:
  - 日本語の `published` エピソードが最低 1 件以上あること
  - そのエピソードに `audio_url` が入っていること
  - Apple Podcasts 提出用として、公開音声フォーマットが `MP3` または `AAC` であることを確認すること
  - `PODCAST_FEED_OWNER_EMAIL` を本番値で設定すること

補足:
- OpenAI TTS の既定フォーマットは `mp3` に寄せた
- `feed.xml` は `wav` を除外するため、`published` でも `audio_url` が `.wav` のままだと item に出ない
- Apple 提出可否は feed XML ではなく実ファイル形式に依存する
- `audio` bucket migration を本番へ反映していないと、TTS 保存で失敗する
- `daily-generate` は `WORKER_LIMIT` に当たりやすいため、現時点では feed 更新の運用前提にしない

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
  - `app/api/social/twitter-post` の `GET` は投稿文 preview
  - `app/api/social/twitter-post` の `POST` は `X_AUTO_POST_ENABLED=true` かつ X credentials 設定済みなら実投稿
  - `.github/workflows/twitter-post.yml` は publish endpoint を叩き、未設定時は skip、設定済みなら実投稿する
- launch 判定:
  - `X_AUTO_POST_ENABLED=false` の間は dry-run 相当
  - 実運用するなら先に X アカウントを作成し、プロフィールと固定ポストを整えたうえで env を有効化し、手動 dispatch で 1 回確認する

本番確認項目:
- `X_AUTO_POST_ENABLED`
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
  - Apple Podcasts / Spotify / X の導線計測
  - 公開回ごとの trial 開始率 / paid 転換率 / 継続率の記録

## Soft Launch 運用メモ

- 今週やること:
  - 公開回の `description` と `preview` を人向けに整える
  - footer から `Apple Podcasts` `Spotify` `X` `公開エピソード` へ直リンクする
  - `robots.txt` と `sitemap.xml` を公開する
  - manual-only 運用を docs に明記する
  - 毎週見る数字を固定する
- 6週間の運用指標:
  - 公開回 → 無料登録率
  - trial 開始率
  - trial → paid
  - 4週継続率

## 中期改善メモ

### Public Podcast と Member Episode の分離

- 背景:
  - Apple / Spotify 向けの公開回は `新規獲得導線`
  - 会員向けの深い回は `継続課金の本体`
  - 1 本で両方を満たそうとすると、公開回は長くなりやすく、会員回は浅くなりやすい
- 将来案:
  - `public_podcast`
    - Apple / Spotify / RSS に配信する短めの公開回
    - 1テーマに絞り、タイトルは悩み名・判断名ベースにする
    - 公開 permalink に着地させ、無料登録と有料開始の入口に使う
  - `member_only`
    - 会員向けの詳細回
    - 行動提案、見直しタイミング、比較軸、Replay / Alerts 連携を含める
- 実装イメージ:
  - `episodes` に `visibility` または `distribution_channel` を追加する
  - `feed.xml` は `public_podcast` だけ載せる
  - 会員画面では `public_podcast` と `member_only` の両方を扱えるようにする
- 優先度:
  - soft launch の初期数値確認後に検討する
  - リリース直前の blocker ではない

## 申請前コマンド

```bash
npm run podcast:check
curl -fsSL https://signal-move.com/feed.xml | sed -n '1,220p'
```

確認ポイント:
- `channel` にタイトル、説明、owner email、image がある
- `item` が 1 件以上ある
- `enclosure` の URL が 200 を返す
- `enclosure type` が実ファイル形式と一致する
- `https://signal-move.com/episodes/<id>` が login に飛ばず公開で開く

## Apple / Spotify 提出前チェック

- `PODCAST_FEED_OWNER_EMAIL` が運用メールアドレスになっている
- feed の `<itunes:owner>` に name と email が出ている
- show cover が 1400px 以上の正方形画像として取得できる
- `enclosure` に `url`, `length`, `type` が入っている
- `enclosure type` が `audio/mpeg` または `audio/aac` になっている
- 音声 URL が 200 を返し、実際に再生できる
- 公開 episode permalink が 200 を返す
- 最低 1 本の日本語 `published` episode がある

補足:
- Apple は RSS feed の技術検証を行い、必須タグ・メディアファイル・show cover を確認する
- Apple の音声要件は `MP3` を受け付ける
- Spotify も RSS の必須要素とメディアの取得性を前提にする

## Apple 提出手順

1. Apple Podcasts Connect にサインインする
2. RSS feed URL `https://signal-move.com/feed.xml` を指定して show を追加する
3. validation 結果で metadata / artwork / audio のエラーがないことを確認する
4. 問題なければ review に送る

状態メモ:
- `2026-03-22` 時点で公開操作は実施済み
- listing URL / 審査反映の最終確認は別途行う

## Spotify 提出手順

1. Spotify for Creators にサインインする
2. RSS feed URL `https://signal-move.com/feed.xml` を追加する
3. show 情報、カテゴリ、表示内容を確認する
4. 問題なければ submit する

状態メモ:
- `2026-03-22` 時点で公開済み
- 公開 URL: `https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH`

## 公式要件

- Apple Podcasts: [Podcast RSS feed validation](https://podcasters.apple.com/es-es/support/829-validate-your-podcast)
- Apple Podcasts: [Audio requirements](https://podcasters.apple.com/de-de/support/893-audio-requirements)
- Apple Podcasts: [Show cover](https://podcasters.apple.com/support/5514-show-cover-template)
- Spotify for Creators: [Podcast specification doc](https://support.spotify.com/ci-en/creators/article/podcast-specification-doc/)
- Spotify for Creators: [Missing elements in RSS feed](https://support.spotify.com/bf-en/creators/article/missing-elements-in-rss-feed-link/)

## 関連ファイル

- [app/feed.xml/route.ts](/Users/gota/Documents/src/ai-podcast-platform/app/feed.xml/route.ts)
- [src/lib/podcastFeed.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/podcastFeed.ts)
- [src/lib/legal.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/legal.ts)
- [src/lib/affiliateLinks.ts](/Users/gota/Documents/src/ai-podcast-platform/src/lib/affiliateLinks.ts)
- [docs/external-services-inventory.md](/Users/gota/Documents/src/ai-podcast-platform/docs/external-services-inventory.md)
