-- One-role rule per service: at most one non-exempt role per person (Desk/Assembly exempt, by role id), never
-- two slots of the same role. Enforced for NEW writes only; existing (legacy) rows are not modified.
-- Service-role/import (auth.uid() is null) bypasses so legacy data can be imported as-is.
create or replace function public.is_exempt_role(dep text, r text) returns boolean language sql immutable as
  $$ select (dep, r) in (('d-music','Desk'), ('d-music','Assembly')) $$;
create or replace function public.one_role_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and (new.user_id, new.department_id, new.role, new.service_id) is not distinct from (old.user_id, old.department_id, old.role, old.service_id) then return new; end if;
  select department_id, role into c from assignments a
   where a.service_id = new.service_id and a.user_id = new.user_id and a.id <> new.id
     and not (a.department_id = new.department_id and a.role = new.role and a.idx = new.idx)
     and ((a.department_id = new.department_id and a.role = new.role) or (not is_exempt_role(new.department_id, new.role) and not is_exempt_role(a.department_id, a.role)))
   limit 1;
  if found then raise exception 'role conflict: already serving as %/% in this service', c.department_id, c.role using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger one_role_guard before insert or update on public.assignments for each row execute function public.one_role_guard();
