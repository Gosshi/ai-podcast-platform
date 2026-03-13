# Decision Library

## Role
- `Decision Library` は `episode_judgment_cards` を横断して再利用するための surface です
- 入口を episode 単位から judgment 単位に切り替え、あとで検索・再訪・比較できる状態を作ります
- `/decisions/library` は `Judgment Cards`、`Decision History`、`Weekly Digest` の中間レイヤーとして機能します

## Value
- `topic_title` / `judgment_summary` 検索で過去の判断を引き直せます
- `genre` / `frame_type` / `judgment_type` / `urgency` で絞り、判断の比較コストを下げます
- free は最近の preview、paid は全件と `deadline / action / watch_points` を再訪できます

## Next Connections
- `Decision Replay`: 同じ topic / frame の判断を後日再提示する入口
- `Saved Decisions`: library 上で保存済み判断を再発見しやすくする土台
- `Alerts`: `due_soon / overdue` をトリガーに通知面へつなぐ基盤
