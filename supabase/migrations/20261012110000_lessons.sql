-- Kids lessons (design; app still uses local megahub:files:v1 until switch-over).
-- Metadata in public.lessons; file bytes in Storage bucket 'lessons' at path '<department_id>/<lesson id>/<file name>'.
-- Read: owner, that department's admins, its members (views_dept). Write (upload/rename/delete): owner + that department's admins (administers).
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  department_id text not null references public.departments(id) on delete cascade check (department_id = 'd-kids'),
  title text not null check (length(btrim(title)) between 1 and 120),
  file_name text not null check (length(file_name) between 1 and 255),
  mime text not null check (mime ~* '^(application/pdf|image/[a-z0-9.+-]+|application/msword|application/vnd\.ms-(excel|powerpoint)|application/vnd\.openxmlformats-officedocument\.[a-z.]+|application/vnd\.oasis\.opendocument\.[a-z.]+)$'),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  storage_path text not null unique,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path like department_id || '/%')
);
alter table public.lessons enable row level security;
create policy ls_read on public.lessons for select to authenticated using (views_dept(department_id));
create policy ls_insert on public.lessons for insert to authenticated with check (administers(department_id));
create policy ls_update on public.lessons for update to authenticated using (administers(department_id)) with check (administers(department_id));
create policy ls_delete on public.lessons for delete to authenticated using (administers(department_id));
grant select, insert, update, delete on public.lessons to authenticated;
-- rename only: file columns are immutable after upload (replace = delete + re-upload)
create or replace function public.lessons_rename_only() returns trigger language plpgsql set search_path = public as $$
begin
  if new.department_id <> old.department_id or new.file_name <> old.file_name or new.mime <> old.mime or new.size_bytes <> old.size_bytes
     or new.storage_path <> old.storage_path or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'only the lesson title can be changed' using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger lessons_rename_only before update on public.lessons for each row execute function public.lessons_rename_only();

-- Storage bucket (private; 5 MB; PDF, images, Office docs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('lessons', 'lessons', false, 5242880, array[
  'application/pdf', 'image/*', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- first path segment is the department id
create policy lessons_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'lessons' and public.views_dept((storage.foldername(name))[1]));
create policy lessons_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lessons' and (storage.foldername(name))[1] = 'd-kids' and public.administers((storage.foldername(name))[1]));
create policy lessons_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'lessons' and public.administers((storage.foldername(name))[1]))
  with check (bucket_id = 'lessons' and (storage.foldername(name))[1] = 'd-kids' and public.administers((storage.foldername(name))[1]));
create policy lessons_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lessons' and public.administers((storage.foldername(name))[1]));
