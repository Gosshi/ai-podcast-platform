begin;

alter table public.user_decisions
  alter column outcome drop not null,
  alter column outcome drop default;

comment on column public.user_decisions.outcome is
  'Nullable until the user records how the saved judgment actually turned out.';

commit;
