# jobs-orchestration spec init

目的: Supabase Edge Functions + Schedulerで、日英エピソード生成パイプラインの骨格を作る。
重要: 冪等性と監査（job_runsログ、episodes.status遷移）を最優先する。
LLM/TTSはモック可。ただしI/FとDB更新は実装する。
