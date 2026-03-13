# Decision Replay

## Purpose
- `Decision Replay` は、保存済みの判断をあとから時系列で振り返り、`当時どう判断したか / なぜそう判断したか / 結果どうだったか` を並べて学べる面です。
- 単なる履歴保存ではなく、`judgment card` と `outcome` の差分を再読できることを価値に置きます。

## Why Replay, Not Just History
- `Decision History` だけでは「保存した」という事実は残りますが、当時の判断文脈まで再現しにくいです。
- Replay では `judgment_summary / action_text / deadline_at / watch_points / threshold` を時系列で見直し、結果とのズレを学習に変えます。
- これにより、後悔の原因が `frame` なのか `watch の長期化` なのか `deadline 不在` なのかを切り分けやすくします。

## Connection To Profile And Recommendation
- Replay で増えた事例は `Personal Decision Profile` の材料になります。
- per-decision insight は、将来的に `Next Best Decision` や recommendation ranking の feature として再利用できます。
- free は preview、paid は full replay + insight とすることで、学習ループ自体を有料価値として扱います。
