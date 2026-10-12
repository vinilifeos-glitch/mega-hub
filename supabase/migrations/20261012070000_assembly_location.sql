-- Additive: Music role 'Assembly' (pt 'Montagem', labels live in the app), default slot counts for new services,
-- and the default location for NEW services. Existing services/assignments/profiles untouched.
insert into public.department_roles (department_id, role, sort)
  select 'd-music', 'Assembly', coalesce(max(sort), -1) + 1 from public.department_roles where department_id = 'd-music'
  on conflict (department_id, role) do nothing;
alter table public.department_roles add column if not exists default_count int not null default 1 check (default_count between 0 and 20);
update public.department_roles set default_count = 2 where (department_id, role) in (('d-music','Backing Vocals'), ('d-kids','Assistant')) and default_count = 1;
update public.department_roles set default_count = 3 where department_id = 'd-music' and role = 'Assembly' and default_count = 1;
alter table public.services alter column location set default '1 Main St, Farcet, Peterborough PE7 3AN';
