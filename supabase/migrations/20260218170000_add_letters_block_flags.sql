begin;

alter table public.letters
  add column if not exists is_blocked boolean,
  add column if not exists blocked_reason text;

update public.letters
set is_blocked = false
where is_blocked is null;

update public.letters
set
  is_blocked = true,
  blocked_reason = coalesce(blocked_reason, 'legacy_reject')
where moderation_status = 'reject'
  and (is_blocked is false or is_blocked is null);

alter table public.letters
  alter column is_blocked set default false,
  alter column is_blocked set not null;

create index if not exists idx_letters_is_blocked_created_at
  on public.letters(is_blocked, created_at desc);

commit;
