# MVP Acceptance Criteria (Local)

A. Local Environment
- npm ci passes
- npm run build passes
- supabase start passes
- supabase db reset passes

B. Episode Generation (JA/EN)
- Pipeline executes at least once locally
- episodes table contains:
  - >=1 row with lang='ja'
  - >=1 row with lang='en'
  - en.master_id references ja.id
  - status='published'
  - published_at IS NOT NULL

C. Audit Logs (job_runs)
- Each pipeline step inserts a new row
- History is not overwritten
- Failures record error messages

D. Letters (UGC)
- letters table accepts inserts
- Fields: display_name, text, created_at
- Insertable via API or direct SQL

E. Tips (Stripe Webhook)
- Webhook endpoint verifies signature
- tips.provider_payment_id is UNIQUE
- Duplicate events are no-op
- README documents local testing

F. Minimal UI
- /episodes page exists
- Displays title, language, published_at
- Audio playback optional
