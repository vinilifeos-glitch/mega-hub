-- Department pages (About + link resources) and the Music song library.
alter table public.departments add column description text check (description is null or length(description) <= 1000);
create table public.department_resources (
  id text primary key,
  department_id text not null references public.departments(id) on delete cascade,
  position int not null,
  title text not null check (length(trim(title)) > 0),
  url text check (url is null or url ~* '^https?://'),
  kind text not null default 'link' check (kind in ('link','file')),
  file_ref text null, -- reserved: Supabase Storage object path for uploads (not built)
  check ((kind = 'link' and url is not null) or (kind = 'file' and file_ref is not null))
);
create index department_resources_dep on public.department_resources(department_id, position);
create table public.songs (
  id text primary key,
  department_id text not null default 'd-music' references public.departments(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  artist text, key text check (key is null or length(key) <= 8), chords text, link text check (link is null or link ~* '^https?://')
);
alter table public.setlist_items add constraint setlist_song_fk foreign key (song_id) references public.songs(id) on delete set null;

create or replace function public.is_member(dep text) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from user_departments where user_id = auth.uid() and department_id = dep) $$;

-- department description: only owner/dept admins may change it (other department columns stay owner-only)
create or replace function public.dept_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_owner() then return new; end if; -- service role (import) or owner
  if administers(old.id) and (new.name, new.emoji, new.color, new.sort) is not distinct from (old.name, old.emoji, old.color, old.sort) then return new; end if;
  raise exception 'not allowed';
end $$;
create trigger dept_guard before update on public.departments for each row execute function public.dept_guard();
create policy dp_admin_about on public.departments for update to authenticated using (administers(id)) with check (administers(id));

alter table public.department_resources enable row level security;
create policy dr_read on public.department_resources for select to authenticated using (is_staff() or is_member(department_id));
create policy dr_write on public.department_resources for all to authenticated using (administers(department_id)) with check (administers(department_id));

alter table public.songs enable row level security;
create policy sg_read on public.songs for select to authenticated using (is_staff() or is_member(department_id)
  or exists (select 1 from setlist_items si where si.song_id = songs.id and can_see_setlist(si.service_id)));
create policy sg_write on public.songs for all to authenticated using (can_edit_setlist()) with check (can_edit_setlist());
grant select, insert, update, delete on public.department_resources, public.songs to authenticated;
