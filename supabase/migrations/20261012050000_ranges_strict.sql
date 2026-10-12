-- 1) Unavailability date ranges: date = from, date_to = inclusive end (null = single day). RLS unchanged.
alter table public.unavailability add column date_to date null check (date_to is null or date_to >= date);
create or replace function public.unavailable_on(p_user uuid, p_date date) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from unavailability u where u.user_id = p_user and p_date between u.date and coalesce(u.date_to, u.date)) $$;
create or replace function public.can_fill(p_user uuid, p_service text, p_dep text, p_role text) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from user_positions where user_id = p_user and department_id = p_dep and role = p_role)
     and exists (select 1 from profiles where id = p_user and active)
     and not exists (select 1 from services s where s.id = p_service and unavailable_on(p_user, s.date)) $$;
create or replace function public.unavail_clears_assignments() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from assignments a using services s where a.service_id = s.id and a.user_id = new.user_id
    and s.date between new.date and coalesce(new.date_to, new.date);
  return new;
end $$;
drop trigger if exists unavail_clears on public.unavailability;
create trigger unavail_clears after insert or update of date, date_to on public.unavailability for each row execute function public.unavail_clears_assignments();
create or replace view public.unavailable_days as select user_id, date, date_to from public.unavailability;
grant select on public.unavailable_days to authenticated;

-- 2) STRICT admin scoping: dept pages / resources / songs / setlists visible only to owner, that dept's admins, or its members.
create or replace function public.views_dept(dep text) returns boolean language sql stable security definer set search_path = public as
  $$ select administers(dep) or is_member(dep) $$;  -- administers() already includes the owner
create or replace function public.can_see_setlist(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select service_visible(sid) and views_dept('d-music') $$;
drop policy dr_read on public.department_resources;
create policy dr_read on public.department_resources for select to authenticated using (views_dept(department_id));
drop policy sg_read on public.songs;
create policy sg_read on public.songs for select to authenticated using (views_dept(department_id));
