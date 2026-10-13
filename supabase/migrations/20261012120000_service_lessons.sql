-- Kids lessons picked for a service (ordered), mirroring setlist rules:
-- read: the service is visible and the reader can see Kids (owner, Kids admins, Kids members);
-- write: owner, Kids admins, or the person assigned as Kids Teacher in THAT service.
-- lesson_id has no FK on purpose: if a lesson is deleted from the catalog the row stays and the app shows 'Lesson removed'.
-- New rows must reference an existing Kids lesson (service-role import bypasses, like setlist_library_guard).
create table public.service_lessons (
  service_id text not null references public.services(id) on delete cascade,
  lesson_id uuid not null,
  position integer not null check (position >= 0),
  primary key (service_id, lesson_id)
);
create index service_lessons_lesson on public.service_lessons(lesson_id);
alter table public.service_lessons enable row level security;
create or replace function public.can_edit_service_lessons(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select administers('d-kids') or exists (select 1 from assignments a where a.service_id = sid and a.user_id = auth.uid()
       and a.department_id = 'd-kids' and a.role = 'Teacher') $$;
create policy svl_read on public.service_lessons for select to authenticated using (service_visible(service_id) and views_dept('d-kids'));
create policy svl_insert on public.service_lessons for insert to authenticated with check (can_edit_service_lessons(service_id));
create policy svl_update on public.service_lessons for update to authenticated using (can_edit_service_lessons(service_id)) with check (can_edit_service_lessons(service_id));
create policy svl_delete on public.service_lessons for delete to authenticated using (can_edit_service_lessons(service_id));
grant select, insert, update, delete on public.service_lessons to authenticated;
create or replace function public.service_lessons_catalog_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and new.lesson_id = old.lesson_id then return new; end if;   -- reorder of an existing (maybe removed) lesson
  if not exists (select 1 from lessons where id = new.lesson_id and department_id = 'd-kids') then
    raise exception 'service lessons must come from the Kids lesson catalog' using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger service_lessons_catalog_guard before insert or update on public.service_lessons for each row execute function public.service_lessons_catalog_guard();
