# db-schema spec init

目的: Supabase(Postgres)でMVPを成立させる最小スキーマを仕様として確定し、migrationsで実装できるタスクに落とす。

対象:
- episodes: 日英エピソード（英語はmaster_idで日本語を参照）
- letters: お便り（モデレーション・カテゴリ・要約）
- tips: 投げ銭（Stripe webhookで確定、冪等キー必須）
- job_runs: ジョブ実行ログ（監査・冪等・再実行の核）

重要:
- langは ja/en（将来拡張可能）
- episodes.en は episodes.ja を master_id で参照
- tips.provider_payment_id はUNIQUE（重複計上防止）
- 主要検索用indexを定義
- RLSはMVP最小（公開閲覧=匿名OK、管理操作=認証必須）
