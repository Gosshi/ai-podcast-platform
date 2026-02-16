# Tasks: DB Schema (MVP)

## T1: Create migration SQL
- Create SQL in supabase/migrations/<timestamp>_mvp_schema.sql
- Create tables: episodes, letters, tips, job_runs
- Add constraints, indexes per design
- Ensure uuid generation (gen_random_uuid) is available (pgcrypto extension if needed)

## T2: Add RLS policies (minimal)
- Enable RLS for 4 tables
- episodes: allow anon SELECT only for published items
- authenticated: allow full CRUD for MVP (or restrict later)

## T3: Document usage
- Update README with:
  - how to apply migrations (supabase db push)
  - how to reset locally (optional)

## T4: Verification queries
- Provide a small SQL snippet to verify:
  - en_requires_master CHECK works
  - tips UNIQUE works
  - indexes exist
