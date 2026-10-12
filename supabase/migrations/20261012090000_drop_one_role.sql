-- Replace the one-role block with colour-coded pickers: double booking across roles in a service is allowed again.
-- Only guard kept: the same person can't hold two slots of the SAME role in one service (new writes only; import bypasses).
drop trigger if exists one_role_guard on public.assignments;
drop function if exists public.one_role_guard();
drop function if exists public.is_exempt_role(text, text);
create or replace function public.same_role_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or new.user_id is null then return new; end if;
  if tg_op = 'UPDATE' and (new.user_id, new.department_id, new.role, new.service_id) is not distinct from (old.user_id, old.department_id, old.role, old.service_id) then return new; end if;
  if exists (select 1 from assignments a where a.service_id = new.service_id and a.user_id = new.user_id and a.id <> new.id
             and a.department_id = new.department_id and a.role = new.role) then
    raise exception 'role conflict: already in %/% in this service', new.department_id, new.role using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger same_role_guard before insert or update on public.assignments for each row execute function public.same_role_guard();
