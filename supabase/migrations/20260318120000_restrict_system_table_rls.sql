-- Restrict RLS policies on system tables (episodes, letters, tips, job_runs)
-- Previously all authenticated users had full CRUD via using(true),
-- allowing any logged-in user to modify/delete shared content.
-- Fix: Remove write policies; system writes happen via service_role only.
--
-- Also add read-only policies to episode_judgment_cards (RLS was enabled
-- but no policies existed, so reads only worked through service_role).

begin;

-- ============================================================
-- EPISODES — authenticated users can READ only
-- ============================================================
drop policy if exists episodes_authenticated_insert on public.episodes;
drop policy if exists episodes_authenticated_update on public.episodes;
drop policy if exists episodes_authenticated_delete on public.episodes;

-- ============================================================
-- LETTERS — authenticated users can READ + INSERT (submit)
-- ============================================================
drop policy if exists letters_authenticated_update on public.letters;
drop policy if exists letters_authenticated_delete on public.letters;

-- ============================================================
-- TIPS — authenticated users can READ only
-- ============================================================
drop policy if exists tips_authenticated_insert on public.tips;
drop policy if exists tips_authenticated_update on public.tips;
drop policy if exists tips_authenticated_delete on public.tips;

-- ============================================================
-- JOB_RUNS — no access for authenticated users (system-only)
-- ============================================================
drop policy if exists job_runs_authenticated_select on public.job_runs;
drop policy if exists job_runs_authenticated_insert on public.job_runs;
drop policy if exists job_runs_authenticated_update on public.job_runs;
drop policy if exists job_runs_authenticated_delete on public.job_runs;

-- ============================================================
-- EPISODE_JUDGMENT_CARDS — add authenticated read-only policy
-- (RLS was enabled in 20260312 migration but no policies created,
--  so all reads currently rely on service_role bypassing RLS)
-- ============================================================
drop policy if exists episode_judgment_cards_authenticated_select on public.episode_judgment_cards;
create policy episode_judgment_cards_authenticated_select
  on public.episode_judgment_cards
  for select
  to authenticated
  using (true);

commit;
