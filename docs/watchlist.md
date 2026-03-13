# Saved Decisions / Watchlist

- `Saved Decisions / Watchlist` は、`まだ採用していない判断` を保留状態のまま残すための surface です。
- `Decision History` が採用済み判断と outcome 学習を扱うのに対し、Watchlist は `saved / watching / archived` の中間状態を扱います。

## Purpose

- `今は決めないが後で見返したい`
- `期限や条件変化まで監視したい`
- `alerts / replay / decision workflow` に返す未決判断の土台を持ちたい

## Product Connections

- `/decisions` と `/decisions/library` の Judgment Card から Save / Watch を追加できる
- `/watchlist` から episode / history / replay に戻れる
- `deadline_at` と `urgency` を基に、将来的な alert delivery と revisit ranking に流用できる

## Free / Paid

- free:
  - active item は最大5件
  - 一覧は簡易表示
  - urgency filter と deadline sort はロック
- paid:
  - 件数無制限
  - full list
  - deadline / urgency を使った再訪を開放

## Why This Is Not History

- History:
  - 採用済み判断
  - outcome を記録
  - personal learning loop を育てる
- Watchlist:
  - 未採用判断
  - 状態を保留管理
  - future alerts / replay 導線の起点になる
