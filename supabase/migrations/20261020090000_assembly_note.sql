-- Additive: per-service Assembly note (free text, default empty).
-- Writes: owner + admins (tier admin-level and above, is_staff()). Admins may change ONLY assembly_note on a service;
-- every other column stays owner-only (sv_owner policy unchanged). Reads follow sv_read (published, or staff).
alter table public.services add column if not exists assembly_note text not null default ''
  check (char_length(assembly_note) <= 2000);

-- staff may UPDATE services rows they can see; the trigger below limits non-owners to assembly_note.
drop policy if exists sv_staff_note on public.services;
create policy sv_staff_note on public.services for update to authenticated using (is_staff()) with check (is_staff());

-- SECURITY INVOKER so current_user is the caller's role: only signed-in app users ('authenticated') are limited;
-- service_role/postgres (import, migrations) and the owner are unrestricted.
create or replace function public.services_note_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or is_owner() then return new; end if;
  if (to_jsonb(new) - 'assembly_note') is distinct from (to_jsonb(old) - 'assembly_note') then
    raise exception 'only the owner can change service details' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists services_note_guard on public.services;
create trigger services_note_guard before update on public.services for each row execute function public.services_note_guard();
