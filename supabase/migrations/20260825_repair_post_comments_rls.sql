-- Repair permissions/RLS for post_comments.
-- Safe to run more than once in Supabase SQL Editor.

alter table if exists public.post_comments enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.post_comments to authenticated;

-- Identity/serial sequences may require explicit sequence privileges.
do $$
declare
  seq_name text;
begin
  select pg_get_serial_sequence('public.post_comments', 'id') into seq_name;
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq_name);
  end if;
end $$;

drop policy if exists "Authenticated users can read post comments" on public.post_comments;
create policy "Authenticated users can read post comments"
  on public.post_comments
  for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own comments" on public.post_comments;
create policy "Users can create their own comments"
  on public.post_comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.post_comments;
create policy "Users can update their own comments"
  on public.post_comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.post_comments;
create policy "Users can delete their own comments"
  on public.post_comments
  for delete
  to authenticated
  using (auth.uid() = user_id);
