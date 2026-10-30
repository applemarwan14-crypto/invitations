-- Public sign-ups can only set user_metadata; app_metadata is settable only by the service role.
-- So any account not created by the admin (via the manage-staff function) is rejected.
create or replace function private.block_public_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data->>'created_by_admin', '') <> 'true' then
    raise exception 'public_signup_disabled' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.block_public_signup() from public, anon, authenticated;
create trigger block_public_signup before insert on auth.users
  for each row execute function private.block_public_signup();

-- Mark the existing owner account as admin-created.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"created_by_admin":"true"}'::jsonb;
