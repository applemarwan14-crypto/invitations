-- ===== Schemas & extensions =====
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ===== Secure code generator (16 chars, 32-char alphabet => unbiased, ~80 bits) =====
create or replace function private.gen_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(16);
  out text := '';
begin
  for i in 0..15 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

-- ===== Tables =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default private.gen_code() check (code ~ '^[A-Z2-9]{16}$'),
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  allowed int not null default 1 check (allowed between 1 and 100),
  entered int not null default 0 check (entered >= 0),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entered_le_allowed check (entered <= allowed)
);

create table public.scans (
  id bigint generated always as identity primary key,
  invitation_id uuid references public.invitations(id) on delete set null,
  code text,
  staff_id uuid references auth.users(id) on delete set null,
  result text not null check (result in ('valid','admitted','not_found','cancelled','used','exceeds')),
  people int not null default 0,
  scanned_at timestamptz not null default now()
);
create index scans_scanned_at_idx on public.scans (scanned_at desc);
create index scans_invitation_idx on public.scans (invitation_id);
create index scans_staff_idx on public.scans (staff_id);

create table public.event_settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'دعوة كريمة',
  host_line text not null default 'يتشرف بدعوتكم',
  event_name text not null default 'لحضور حفل',
  date_text text not null default '',
  venue_text text not null default '',
  note text not null default 'نأمل إبراز الدعوة عند الدخول',
  theme text not null default 'gold',
  updated_at timestamptz not null default now()
);
insert into public.event_settings (id) values (1);

-- ===== Role helpers (in non-exposed schema) =====
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin' and is_active);
$$;
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin','staff') and is_active);
$$;
revoke all on function private.is_admin(), private.is_staff(), private.gen_code() from public, anon;
grant execute on function private.is_admin(), private.is_staff() to authenticated;
grant execute on function private.gen_code() to authenticated;

-- ===== New auth user => inactive staff profile =====
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger invitations_touch before update on public.invitations
  for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.event_settings
  for each row execute function private.touch_updated_at();

-- ===== RLS: deny by default =====
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.scans enable row level security;
alter table public.event_settings enable row level security;

revoke all on public.profiles, public.invitations, public.scans, public.event_settings from anon;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy invitations_admin_all on public.invitations for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy scans_admin_select on public.scans for select to authenticated
  using ((select private.is_admin()));

create policy settings_admin_all on public.event_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ===== Gate functions =====
create or replace function public.scan_invitation(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.invitations; r text;
begin
  if not private.is_staff() then raise exception 'not_authorized' using errcode = '42501'; end if;
  p_code := upper(left(trim(coalesce(p_code,'')), 64));
  select * into v from public.invitations where code = p_code;
  if not found then r := 'not_found';
  elsif v.status = 'cancelled' then r := 'cancelled';
  elsif v.entered >= v.allowed then r := 'used';
  else r := 'valid'; end if;
  insert into public.scans (invitation_id, code, staff_id, result, people)
    values (v.id, p_code, auth.uid(), r, 0);
  return jsonb_build_object('result', r, 'code', v.code, 'guest_name', v.guest_name,
    'allowed', v.allowed, 'entered', v.entered,
    'remaining', greatest(coalesce(v.allowed,0) - coalesce(v.entered,0), 0));
end $$;

create or replace function public.admit_guests(p_code text, p_count int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.invitations; r text;
begin
  if not private.is_staff() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'invalid_count' using errcode = '22023'; end if;
  p_code := upper(left(trim(coalesce(p_code,'')), 64));
  select * into v from public.invitations where code = p_code for update;
  if not found then r := 'not_found';
  elsif v.status = 'cancelled' then r := 'cancelled';
  elsif v.entered >= v.allowed then r := 'used';
  elsif v.entered + p_count > v.allowed then r := 'exceeds';
  else
    update public.invitations set entered = entered + p_count where id = v.id returning * into v;
    r := 'admitted';
  end if;
  insert into public.scans (invitation_id, code, staff_id, result, people)
    values (v.id, p_code, auth.uid(), r, case when r = 'admitted' then p_count else 0 end);
  return jsonb_build_object('result', r, 'code', v.code, 'guest_name', v.guest_name,
    'allowed', v.allowed, 'entered', v.entered,
    'remaining', greatest(coalesce(v.allowed,0) - coalesce(v.entered,0), 0));
end $$;

create or replace function public.search_invitations(p_query text)
returns table (code text, guest_name text, allowed int, entered int, status text)
language plpgsql stable security definer set search_path = '' as $$
declare q text;
begin
  if not private.is_staff() then raise exception 'not_authorized' using errcode = '42501'; end if;
  q := trim(coalesce(p_query,''));
  if char_length(q) < 2 then return; end if;
  q := replace(replace(replace(left(q, 60), '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select i.code, i.guest_name, i.allowed, i.entered, i.status
    from public.invitations i
    where i.guest_name ilike '%' || q || '%'
    order by i.guest_name limit 20;
end $$;

revoke all on function public.scan_invitation(text), public.admit_guests(text,int), public.search_invitations(text) from public, anon;
grant execute on function public.scan_invitation(text), public.admit_guests(text,int), public.search_invitations(text) to authenticated;

alter publication supabase_realtime add table public.invitations, public.scans;
