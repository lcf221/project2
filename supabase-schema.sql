-- Run in Supabase → SQL Editor (once per project)

create table if not exists public.moods (
  user_id uuid not null references auth.users on delete cascade,
  date_str text not null,
  mood text not null,
  primary key (user_id, date_str)
);

alter table public.moods enable row level security;

drop policy if exists "Users select own moods" on public.moods;
drop policy if exists "Users insert own moods" on public.moods;
drop policy if exists "Users update own moods" on public.moods;
drop policy if exists "Users delete own moods" on public.moods;

create policy "Users select own moods"
  on public.moods for select
  using (auth.uid() = user_id);

create policy "Users insert own moods"
  on public.moods for insert
  with check (auth.uid() = user_id);

create policy "Users update own moods"
  on public.moods for update
  using (auth.uid() = user_id);

create policy "Users delete own moods"
  on public.moods for delete
  using (auth.uid() = user_id);
