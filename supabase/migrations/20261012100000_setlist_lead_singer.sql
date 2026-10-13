-- Setlist editing: owner, Music admins, or the person assigned as Music Lead Singer in THAT service (setlist only).
-- Song library writes stay owner + Music admins (sg_write uses can_edit_setlist(), unchanged).
-- New setlist items must reference a library song (legacy free-text rows are kept; import/service role bypasses).
create or replace function public.can_edit_service_setlist(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select can_edit_setlist() or exists (select 1 from assignments a where a.service_id = sid and a.user_id = auth.uid()
       and a.department_id = 'd-music' and a.role = 'Lead Singer') $$;
drop policy si_write on public.setlist_items;
create policy si_write on public.setlist_items for all to authenticated
  using (can_edit_service_setlist(service_id)) with check (can_edit_service_setlist(service_id));
create or replace function public.setlist_library_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.song_id is null then raise exception 'setlist songs must come from the song library' using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger setlist_library_guard before insert on public.setlist_items for each row execute function public.setlist_library_guard();
