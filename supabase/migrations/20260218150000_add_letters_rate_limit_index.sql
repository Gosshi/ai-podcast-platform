begin;

create index if not exists idx_letters_display_name_created_at
  on public.letters(display_name, created_at desc);

commit;
