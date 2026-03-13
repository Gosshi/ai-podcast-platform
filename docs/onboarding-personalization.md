# Onboarding Personalization

## Purpose
- `user_preferences` は初回オンボーディングで収集する explicit preference を保存するテーブルです
- cold start で履歴がゼロでも、興味・利用サービス・判断優先軸・可処分時間を ranking に渡せるようにします
- `Personal Decision Profile` は `user_decisions` から組み立てる implicit learning layer であり、役割を分けて共存させます

## Stored Fields
- `interest_topics`
- `active_subscriptions`
- `decision_priority`
- `daily_available_time`
- `budget_sensitivity` (optional)
- `created_at`
- `updated_at`

## Product Flow
1. ログイン直後に `preferences` 未設定なら `/onboarding` に誘導します
2. 4 step の軽量フローで required fields を埋めます
3. `POST /api/user-preferences` で `user_preferences` に upsert します
4. 完了後は `next` つきで元画面、未指定なら `/decisions` に戻します
5. `/account` からいつでも見直しできます

## Difference From Personal Profile
- `user_preferences`
  - 初回から取得できる
  - ユーザーの explicit intent を保持する
  - free / paid 共通で取得する
- `Personal Decision Profile`
  - `Decision History` の蓄積が必要
  - outcome ベースの implicit learning を返す
  - 履歴が育つほど精度が上がる

## Integration Points
- `src/lib/userPreferences.ts`
  - `validateUserPreferencesInput`
  - `initializeUserPreferenceProfile`
  - `buildUserPreferenceSurfaceContext`
- 想定接続先
  - `next best decision ranking`
  - `personal hints`
  - `watchlist / alerts`
  - `paywall copy`
  - `weekly digest personalization`

## Analytics
- `onboarding_start`
- `onboarding_step_complete`
- `onboarding_complete`
- `preference_update`
