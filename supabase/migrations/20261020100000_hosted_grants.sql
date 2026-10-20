-- Hosted Supabase gives anon and authenticated ALL privileges on public tables and views by default
-- (default privileges, including TRUNCATE). The schema was designed and tested with anon having nothing.
-- So anon gets no table access at all. Most importantly, the owner-run unavailable_days view no longer
-- leaks user_id/dates to the public anon key. authenticated keeps exactly select/insert/update/delete.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
