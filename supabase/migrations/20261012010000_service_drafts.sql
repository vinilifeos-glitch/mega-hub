-- Service drafts: status defaults to 'published' (existing rows unaffected).
-- Non-staff (volunteers) can't select draft services, their slots, or their assignments.
alter table public.services add column status text not null default 'published' check (status in ('draft','published'));
create or replace function public.service_visible(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select is_staff() or exists (select 1 from services s where s.id = sid and s.status = 'published') $$;
drop policy sv_read on public.services;
create policy sv_read on public.services for select to authenticated using (status = 'published' or is_staff());
drop policy sl_read on public.service_slots;
create policy sl_read on public.service_slots for select to authenticated using (service_visible(service_id));
drop policy as_read on public.assignments;
create policy as_read on public.assignments for select to authenticated using (service_visible(service_id));
