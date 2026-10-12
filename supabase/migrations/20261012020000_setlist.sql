-- Service setlist phase 1. Order = position. song_id reserved for the phase-2 song library (see docs/SONG_LIBRARY_PLAN.md).
create table public.setlist_items (
  id text primary key,
  service_id text not null references public.services(id) on delete cascade,
  position int not null,
  title text not null check (length(trim(title)) > 0),
  key text check (key is null or length(key) <= 8),
  notes text check (notes is null or length(notes) <= 200),
  song_id text null -- later: references public.songs(id) on delete set null
);
create index setlist_items_service on public.setlist_items(service_id, position);
create or replace function public.can_edit_setlist() returns boolean language sql stable security definer set search_path = public as
  $$ select is_owner() or administers('d-music') $$;
create or replace function public.can_see_setlist(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select service_visible(sid) and (is_staff()
       or exists (select 1 from user_departments where user_id = auth.uid() and department_id = 'd-music')
       or exists (select 1 from assignments where service_id = sid and user_id = auth.uid())) $$;
alter table public.setlist_items enable row level security;
create policy si_read on public.setlist_items for select to authenticated using (can_see_setlist(service_id));
create policy si_write on public.setlist_items for all to authenticated using (can_edit_setlist()) with check (can_edit_setlist());
grant select, insert, update, delete on public.setlist_items to authenticated;
