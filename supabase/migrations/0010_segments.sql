create table if not exists public.segments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  description text,
  tag_filters jsonb not null default '[]',
  -- array of { tag: string, required: boolean }
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.segments enable row level security;

create policy "Users manage own segments" on public.segments
  for all using (auth.uid() = user_id);
