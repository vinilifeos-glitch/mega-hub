-- Additive: rota acknowledgements + web push subscriptions for Mega Hub hold-nov5 updates.
-- Do NOT apply until Marcos says upload.

-- ── Rota ack (one status per person per service) ─────────────────────────────
create table if not exists public.rota_acks (
  service_id text not null references public.services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'unavailable')),
  ack_at timestamptz,
  last_notified_at timestamptz,
  primary key (service_id, user_id)
);

alter table public.rota_acks enable row level security;

-- Everyone signed in can read acks (admins see unavailable on Events/Admin; people see own).
create policy rota_acks_read on public.rota_acks for select to authenticated using (true);

-- People set their own ack (pending -> acknowledged|unavailable). Staff may also update (e.g. clear).
create policy rota_acks_upsert on public.rota_acks for insert to authenticated
  with check (user_id = auth.uid() or is_staff());
create policy rota_acks_update on public.rota_acks for update to authenticated
  using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());
create policy rota_acks_delete on public.rota_acks for delete to authenticated
  using (user_id = auth.uid() or is_staff() or administers(
    coalesce((select a.department_id from public.assignments a
              where a.service_id = rota_acks.service_id and a.user_id = rota_acks.user_id limit 1), '')));

-- Drop ack when the person is no longer assigned to that service.
create or replace function public.rota_acks_prune() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.assignments where service_id = old.service_id and user_id = old.user_id) then
      delete from public.rota_acks where service_id = old.service_id and user_id = old.user_id;
    end if;
    return old;
  end if;
  -- user_id change on a slot: prune old user if they have no other slots; new user starts with no row (= pending)
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    if not exists (select 1 from public.assignments where service_id = old.service_id and user_id = old.user_id) then
      delete from public.rota_acks where service_id = old.service_id and user_id = old.user_id;
    end if;
    delete from public.rota_acks where service_id = new.service_id and user_id = new.user_id; -- reassign = re-ack
  end if;
  return new;
end $$;

drop trigger if exists rota_acks_prune_del on public.assignments;
create trigger rota_acks_prune_del after delete on public.assignments
  for each row execute function public.rota_acks_prune();
drop trigger if exists rota_acks_prune_upd on public.assignments;
create trigger rota_acks_prune_upd after update of user_id on public.assignments
  for each row execute function public.rota_acks_prune();

-- ── Web Push subscriptions (browser endpoints) ───────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy push_sub_read on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid() or is_owner());
create policy push_sub_ins on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy push_sub_upd on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_sub_del on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid() or is_owner());

-- Realtime: clients subscribe to assignment/service/ack changes for live sync.
-- (Safe no-op if already members.)
do $$ begin
  alter publication supabase_realtime add table public.assignments;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.services;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.service_slots;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.setlist_items;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.service_lessons;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rota_acks;
exception when duplicate_object then null; when undefined_object then null; end $$;

revoke all on table public.rota_acks from anon;
revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.rota_acks to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
