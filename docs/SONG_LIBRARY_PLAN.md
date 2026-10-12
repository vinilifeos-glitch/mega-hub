# Song library — phase 2 plan (not built)

Phase 1 (live): each service has `setlist: { id, title, key?, notes?, songId? }[]`. `songId` is always empty today.

Phase 2:
1. Library: `songs { id, title, artist?, defaultKey?, chords?, link? }`, editable by owner + Music admins, readable by Music members, owner, admins and anyone with a song in a visible setlist.
2. Setlist "Pick from library": copies title + defaultKey into the item and sets `songId`; the item's `key` stays as a per-service override. Free-text items keep working.
3. Chord view `/song/[id]` (monospace, transpose later).
4. Migration: none for existing data — free-text items stay `songId: null`; optionally offer "link to library" by title match.

Planned table (NOT applied — keep commented until approved):
```sql
-- create table public.songs (
--   id text primary key,
--   title text not null, artist text, default_key text, chords text, link text,
--   created_at timestamptz default now()
-- );
-- alter table public.setlist_items add constraint setlist_song_fk foreign key (song_id) references public.songs(id) on delete set null;
-- alter table public.songs enable row level security;
-- create policy songs_read on public.songs for select to authenticated using (is_staff() or exists (select 1 from user_departments where user_id = auth.uid() and department_id = 'd-music'));
-- create policy songs_write on public.songs for all to authenticated using (can_edit_setlist()) with check (can_edit_setlist());
```
