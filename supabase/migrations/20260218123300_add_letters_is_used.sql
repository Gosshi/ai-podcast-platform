begin;

alter table public.letters
  add column if not exists is_used boolean default false;

update public.letters
set is_used = false
where is_used is null;

alter table public.letters
  alter column is_used set default false,
  alter column is_used set not null;

create index if not exists idx_letters_is_used_created_at on public.letters(is_used, created_at desc);

commit;
