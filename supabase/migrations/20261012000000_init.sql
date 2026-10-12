-- Mega Hub: initial schema + row-level security.
-- Mirrors app rules in src/state/AppContext.tsx + src/state/permissions.ts:
--   owner: unrestricted. admin: department/roles/assignments only for departments they administer;
--   can't edit others' names/contact/email (dob allowed, as in the app), password, tier, or the owner.
--   volunteer: edits own profile + own unavailability.
-- Private data (names, dob, contact, email, unavailability notes) lives in separate tables readable by
-- self, owner and admins only. Everyone signed in sees the `profiles` directory (username/tier/active).


-- ───────────── tables ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  tier text not null default 'volunteer' check (tier in ('owner','admin','volunteer')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  language text check (language in ('pt','en')),
  theme text check (theme in ('light','dark')),
  legacy_id text unique,                       -- id from the on-device app (import mapping)
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9._-]{2,32}$')
);
create unique index profiles_username_lower on public.profiles (lower(username));
create unique index one_owner on public.profiles ((tier)) where tier = 'owner';

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null default '',
  middle_names text not null default '',
  last_name text not null default '',
  dob date,
  contact text,
  email text check (email is null or email = lower(btrim(email))),
  constraint email_format check (email is null or email = '' or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

create table public.departments (
  id text primary key,                         -- 'd-music' etc. (same ids as the app)
  name text not null, emoji text not null default '', color text not null default '#888888',
  sort int not null default 0
);
create table public.department_roles (
  department_id text not null references public.departments(id) on delete cascade,
  role text not null, sort int not null default 0,
  primary key (department_id, role)
);
create table public.user_departments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  primary key (user_id, department_id)
);
create table public.user_positions (
  user_id uuid not null, department_id text not null, role text not null,
  primary key (user_id, department_id, role),
  foreign key (user_id, department_id) references public.user_departments(user_id, department_id) on delete cascade,
  foreign key (department_id, role) references public.department_roles(department_id, role) on delete cascade
);
create table public.admin_of (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  primary key (user_id, department_id)
);
create table public.unavailability (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  note text check (note is null or length(note) <= 200),
  primary key (user_id, date)
);
create table public.services (
  id text primary key default gen_random_uuid()::text,   -- app ids like 'svc-…' are kept as-is
  title text not null, location text not null default '',
  date date not null, start_time time not null, end_time time not null,
  created_at timestamptz not null default now()
);
create table public.service_slots (
  service_id text not null references public.services(id) on delete cascade,
  department_id text not null, role text not null,
  count int not null check (count between 0 and 20),
  primary key (service_id, department_id, role),
  foreign key (department_id, role) references public.department_roles(department_id, role) on delete cascade
);
create table public.assignments (
  id text primary key default gen_random_uuid()::text,
  service_id text not null references public.services(id) on delete cascade,
  department_id text not null, role text not null, idx int not null check (idx >= 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique (service_id, department_id, role, idx),
  foreign key (department_id, role) references public.department_roles(department_id, role) on delete cascade
);
create table public.settings (id int primary key default 1 check (id = 1), last_location text);

-- ───────────── helper functions (security definer: read roles without recursive RLS) ─────────────
create or replace function public.my_tier() returns text language sql stable security definer set search_path = public as
$$ select tier from profiles where id = auth.uid() and active $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_tier() = 'owner', false) $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_tier() = 'admin', false) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_tier() in ('owner','admin'), false) $$;
create or replace function public.administers(dep text) returns boolean language sql stable security definer set search_path = public as
$$ select is_owner() or (is_admin() and exists (select 1 from admin_of where user_id = auth.uid() and department_id = dep)) $$;
-- admin may manage a member: not the owner, and (in one of my departments, or an unassigned volunteer)
create or replace function public.manages_user(target uuid) returns boolean language sql stable security definer set search_path = public as
$$ select is_owner() or target = auth.uid() or (is_admin() and exists (
     select 1 from profiles p where p.id = target and p.tier <> 'owner' and (
       exists (select 1 from user_departments ud join admin_of a on a.department_id = ud.department_id and a.user_id = auth.uid() where ud.user_id = target)
       or (p.tier = 'volunteer' and not exists (select 1 from user_departments where user_id = target))))) $$;
-- holds role + not unavailable on the service date (assignment rule from the picker)
create or replace function public.can_fill(p_user uuid, p_service text, p_dep text, p_role text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from user_positions where user_id = p_user and department_id = p_dep and role = p_role)
     and exists (select 1 from profiles where id = p_user and active)
     and not exists (select 1 from unavailability u join services s on s.date = u.date where u.user_id = p_user and s.id = p_service) $$;

-- ───────────── guard triggers (column-level rules RLS can't express) ─────────────
create or replace function public.guard_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;            -- service role / migrations
  if is_owner() then
    if old.tier = 'owner' and new.tier <> 'owner' then raise exception 'owner cannot demote self'; end if;
    return new;
  end if;
  -- non-owner: only own row, only language/theme/must_change_password(true->false via change-password)
  if new.id <> auth.uid() then raise exception 'not allowed'; end if;
  if new.username <> old.username or new.tier <> old.tier or new.active <> old.active or new.legacy_id is distinct from old.legacy_id
     or (new.must_change_password and not old.must_change_password) then
    raise exception 'only the owner can change username, tier or status';
  end if;
  return new;
end $$;
create trigger guard_profiles before update on public.profiles for each row execute function public.guard_profiles();

create or replace function public.guard_private() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_owner() or new.user_id = auth.uid() then
    new.email := nullif(lower(btrim(coalesce(new.email,''))), '');
    return new;
  end if;
  -- admin editing a member: names/contact/email are protected (dob allowed, as in the app)
  if not manages_user(new.user_id) then raise exception 'not allowed'; end if;
  if new.first_name is distinct from old.first_name or new.middle_names is distinct from old.middle_names
     or new.last_name is distinct from old.last_name or new.contact is distinct from old.contact
     or new.email is distinct from old.email then
    raise exception 'only the owner can change someone else''s name, contact or email';
  end if;
  return new;
end $$;
create trigger guard_private before update on public.profile_private for each row execute function public.guard_private();

-- marking yourself unavailable drops your assignments that day (same as the app)
create or replace function public.unavail_clears_assignments() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from assignments a using services s where a.service_id = s.id and s.date = new.date and a.user_id = new.user_id;
  return new;
end $$;
create trigger unavail_clears after insert on public.unavailability for each row execute function public.unavail_clears_assignments();

-- leaving a role/department drops matching assignments
create or replace function public.position_removed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from assignments where user_id = old.user_id and department_id = old.department_id and role = old.role;
  return old;
end $$;
create trigger position_removed after delete on public.user_positions for each row execute function public.position_removed();

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.departments enable row level security;
alter table public.department_roles enable row level security;
alter table public.user_departments enable row level security;
alter table public.user_positions enable row level security;
alter table public.admin_of enable row level security;
alter table public.unavailability enable row level security;
alter table public.services enable row level security;
alter table public.service_slots enable row level security;
alter table public.assignments enable row level security;
alter table public.settings enable row level security;

-- directory: username/tier/active visible to all signed-in users (shared views show @username only)
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (is_owner() or id = auth.uid());
-- inserts/deletes of profiles only via edge function (service role)

create policy private_read on public.profile_private for select to authenticated using (user_id = auth.uid() or is_staff());
create policy private_update on public.profile_private for update to authenticated using (manages_user(user_id));

create policy dept_read on public.departments for select to authenticated using (true);
create policy dept_owner on public.departments for all to authenticated using (is_owner()) with check (is_owner());
create policy droles_read on public.department_roles for select to authenticated using (true);
create policy droles_owner on public.department_roles for all to authenticated using (is_owner()) with check (is_owner());

create policy ud_read on public.user_departments for select to authenticated using (true);
create policy ud_write on public.user_departments for all to authenticated
  using (administers(department_id) and manages_user(user_id))
  with check (administers(department_id) and manages_user(user_id));
create policy up_read on public.user_positions for select to authenticated using (true);
create policy up_write on public.user_positions for all to authenticated
  using (administers(department_id) and manages_user(user_id)) with check (administers(department_id) and manages_user(user_id));

create policy ao_read on public.admin_of for select to authenticated using (true);
create policy ao_owner on public.admin_of for all to authenticated using (is_owner()) with check (is_owner());

-- unavailability incl. notes: self, owner, admins (admins write only for members they manage)
create policy un_read on public.unavailability for select to authenticated using (user_id = auth.uid() or is_staff());
create policy un_write on public.unavailability for all to authenticated
  using (manages_user(user_id)) with check (manages_user(user_id) and date >= current_date);

create policy sv_read on public.services for select to authenticated using (true);
create policy sv_owner on public.services for all to authenticated using (is_owner()) with check (is_owner());
create policy sl_read on public.service_slots for select to authenticated using (true);
create policy sl_owner on public.service_slots for all to authenticated using (is_owner()) with check (is_owner());

create policy as_read on public.assignments for select to authenticated using (true);
create policy as_insert on public.assignments for insert to authenticated
  with check (administers(department_id) and can_fill(user_id, service_id, department_id, role));
create policy as_update on public.assignments for update to authenticated
  using (administers(department_id)) with check (administers(department_id) and can_fill(user_id, service_id, department_id, role));
create policy as_delete on public.assignments for delete to authenticated using (administers(department_id));

create policy st_read on public.settings for select to authenticated using (true);
create policy st_owner on public.settings for all to authenticated using (is_owner()) with check (is_owner());

-- shared, note-free busy view for everyone (who's away on a date, no notes) — runs as view owner
create view public.unavailable_days as select user_id, date from public.unavailability;
grant select on public.unavailable_days to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, delete on public.profile_private from authenticated;

-- seed departments/roles (same ids/order as the app)
insert into public.departments (id, name, emoji, color, sort) values
  ('d-music','Music','🎵','#7C3AED',0), ('d-kids','Kids','🧸','#10B981',1), ('d-obreiros','Obreiros','🤝','#F59E0B',2);
insert into public.department_roles (department_id, role, sort)
select d, r, o - 1 from (values
  ('d-music', array['Keys','Bass','Drums','Guitar','Desk','Lead Singer','Backing Vocals']),
  ('d-kids', array['Teacher','Assistant']),
  ('d-obreiros', array['Atalaia','Dízimo','Abertura','Projeção','Mídia'])) v(d, roles),
  unnest(roles) with ordinality as t(r, o);
insert into public.settings (id) values (1);
