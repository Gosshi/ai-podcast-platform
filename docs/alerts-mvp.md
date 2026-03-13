# Alerts MVP

## Purpose
- `Decision Library / Watchlist / Outcome Reminder` の再訪を、アプリを開いたときだけに依存させない
- deadline / 未処理 / weekly digest を `user_alerts` に保存し、in-app delivery と将来の email / push を同じ土台で扱う

## Generated Alert Types
- `deadline_due_soon`
  - `episode_judgment_cards.deadline_at` が近い judgment を対象にする
  - 既定では 72 時間以内を抽出する
- `watchlist_due_soon`
  - `user_watchlist_items` の `saved / watching` で、deadline が近い judgment を対象にする
  - 既定では 120 時間以内を抽出する
- `outcome_reminder`
  - `user_decisions.outcome is null` で、期限経過または保存から一定日数経過した decision を対象にする
- `weekly_digest_ready`
  - `weeklyDecisionDigest` の件数が 0 より大きい週だけ生成する

## Storage
- `user_alerts`
  - in-app alerts の現在表示用ストア
  - `alert_payload` に link や source metadata を保持する
  - `dismissed_at` を持つので、将来の mute / snooze に拡張しやすい
- `user_notification_preferences`
  - `weekly_digest_enabled`
  - `deadline_alert_enabled`
  - `outcome_reminder_enabled`

## Free / Paid
- free
  - `user_alerts` は preview 前提で最大 4 件
  - alert type ごとに 1 件まで
  - `weekly_digest_ready` は preview copy
  - deadline / watchlist / outcome reminder も部分表示
- paid
  - 最大 12 件まで表示
  - weekly digest を full で誘導
  - outcome reminders と deadline alerts を full で扱う

## Surfaces
- `/alerts`
  - full in-app inbox
- `/decisions`
  - 再訪の入口として上部に alert preview を表示
- `/account`
  - retention 状態と lightweight notification preferences を表示

## Analytics
- `alert_impression`
- `alert_click`
- `alert_mark_read`
- `alert_dismiss`
- `weekly_digest_alert_click`
- `outcome_reminder_alert_click`

## Future Connection
- `user_alerts.is_sent` を email / push delivery status に流用できる
- `source_kind / source_id / alert_payload` を使って scheduled jobs から再生成・送信しやすい
- `user_notification_preferences` を channel-aware preferences に拡張できる
