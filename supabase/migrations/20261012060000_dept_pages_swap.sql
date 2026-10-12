-- 1) Private department descriptions: move departments.description into department_pages (read: views_dept; write: administers).
create table public.department_pages (
  department_id text primary key references public.departments(id) on delete cascade,
  description text check (description is null or length(description) <= 1000)
);
insert into public.department_pages (department_id, description) select id, description from public.departments where description is not null;
drop policy if exists dp_admin_about on public.departments;
alter table public.departments drop column description;
alter table public.department_pages enable row level security;
create policy dpg_read on public.department_pages for select to authenticated using (views_dept(department_id));
create policy dpg_write on public.department_pages for all to authenticated using (administers(department_id)) with check (administers(department_id));
grant select, insert, update, delete on public.department_pages to authenticated;

-- 2) Double booking: assignments have no per-user uniqueness, so the same person may hold several slots in one service
--    (can_fill checks role, active and unavailability only). Swap: atomic RPC, runs as the caller so RLS applies to every write.
create or replace function public.assign_swap(p_service text, p_dep text, p_role text, p_idx int, p_user uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare f assignments%rowtype; prev uuid; k int;  -- swap = move in + clear the other slot; any occupant here is replaced, never traded
begin
  select * into f from assignments where service_id = p_service and user_id = p_user
    and not (department_id = p_dep and role = p_role and idx = p_idx) order by department_id, role, idx limit 1;
  select user_id into prev from assignments where service_id = p_service and department_id = p_dep and role = p_role and idx = p_idx;
  if prev = p_user then return; end if;
  if f.id is not null then
    delete from assignments where id = f.id; get diagnostics k = row_count;
    if k = 0 then raise exception 'not allowed: cannot change % slot', f.department_id; end if;
  end if;
  delete from assignments where service_id = p_service and department_id = p_dep and role = p_role and idx = p_idx;
  insert into assignments (service_id, department_id, role, idx, user_id) values (p_service, p_dep, p_role, p_idx, p_user);
end $$;
revoke all on function public.assign_swap(text, text, text, int, uuid) from public, anon;
grant execute on function public.assign_swap(text, text, text, int, uuid) to authenticated;
