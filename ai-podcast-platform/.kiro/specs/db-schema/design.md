# Design: DB Schema (MVP)

## Conventions
- Primary key: uuid (gen_random_uuid())
- Timestamps: created_at default now()
- Status/lang/category/moderation_status は CHECK 制約でenum相当

## Tables

### episodes
Columns:
- id uuid PK
- lang text NOT NULL CHECK (lang in ('ja','en'))
- master_id uuid NULL FK -> episodes(id)
- status text NOT NULL CHECK (status in ('draft','queued','generating','ready','published','failed')) default 'draft'
- title text NULL
- description text NULL
- script text NULL
- audio_url text NULL
- duration_sec integer NULL CHECK (duration_sec >= 0)
- published_at timestamptz NULL
- created_at timestamptz NOT NULL default now()

Constraints:
- en_requires_master: CHECK (
  (lang='ja' AND master_id IS NULL) OR
  (lang='en' AND master_id IS NOT NULL)
)
※ 参照先がjaであることはFKだけでは保証できないため、MVPは運用で担保。
  （厳密化はトリガ/部分インデックスで後続対応）

Indexes:
- idx_episodes_lang_published_at (lang, published_at desc)
- idx_episodes_master_id (master_id)
- idx_episodes_status (status)

### letters
Columns:
- id uuid PK
- display_name text NOT NULL
- text text NOT NULL
- moderation_status text NOT NULL CHECK (moderation_status in ('pending','ok','needs_review','reject')) default 'pending'
- category text NOT NULL CHECK (category in ('topic_request','question','feedback','other')) default 'other'
- summary text NULL
- tip_amount integer NULL CHECK (tip_amount >= 0)  -- 任意（MVP簡易）
- created_at timestamptz NOT NULL default now()

Indexes:
- idx_letters_moderation_status (moderation_status)
- idx_letters_category_created_at (category, created_at desc)

### tips
Columns:
- id uuid PK
- provider text NOT NULL default 'stripe'
- provider_payment_id text NOT NULL
- amount integer NOT NULL CHECK (amount >= 0)
- currency text NOT NULL
- letter_id uuid NULL FK -> letters(id)
- created_at timestamptz NOT NULL default now()

Constraints:
- uq_tips_provider_payment_id UNIQUE (provider_payment_id)

Indexes:
- idx_tips_created_at (created_at desc)
- idx_tips_letter_id (letter_id)

### job_runs
Columns:
- id uuid PK
- job_type text NOT NULL
- status text NOT NULL CHECK (status in ('running','success','failed')) default 'running'
- payload jsonb NOT NULL default '{}'::jsonb
- error text NULL
- started_at timestamptz NOT NULL default now()
- ended_at timestamptz NULL

Indexes:
- idx_job_runs_job_type_started_at (job_type, started_at desc)
- idx_job_runs_status_started_at (status, started_at desc)

## RLS (MVP)
方針:
- episodes: published のみ匿名閲覧OK
- letters/tips/job_runs: 認証ユーザーのみ閲覧/更新OK

実装方針（Supabase）:
- RLS enable
- episodes: SELECT policy for anon where status='published' OR published_at IS NOT NULL (どちらかに統一)
- authenticated: all access on all tables（MVP）
