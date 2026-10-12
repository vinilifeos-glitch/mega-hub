-- Songs v2: composer (was artist), key ('C','F#','Am'), time signature, bpm, structured sections (jsonb). Legacy `chords` text kept.
alter table public.songs rename column artist to composer;
alter table public.songs add column time_signature text check (time_signature is null or length(time_signature) <= 10),
  add column bpm int check (bpm is null or bpm between 1 and 400),
  add column sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array');
alter table public.songs add constraint songs_key_fmt check (key is null or key ~ '^[A-G][#b]?m?$');
-- sections: [{id, name, cue?, bars: text[], notes?}] — chords written in songs.key; transposition is client-side.
-- Live mode needs no table: access = owner / Music admin / Music member assigned on the service (same data the setlist RLS exposes).
create or replace function public.can_live(sid text) returns boolean language sql stable security definer set search_path = public as
  $$ select service_visible(sid) and (can_edit_setlist() or (is_member('d-music') and exists (select 1 from assignments where service_id = sid and user_id = auth.uid()))) $$;
grant execute on function public.can_live(text) to authenticated;
