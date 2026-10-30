-- Short-lived allowlist written only by the manage-staff function (service role bypasses RLS).
create table public.signup_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

create or replace function private.block_public_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.signup_allowlist
   where email = lower(new.email) and created_at > now() - interval '10 minutes';
  if found then return new; end if;
  raise exception 'public_signup_disabled' using errcode = '42501';
end $$;
