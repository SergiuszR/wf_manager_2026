-- Create the projects table
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table projects enable row level security;

-- Policy: Allow users to manage their own projects
create policy "Users can manage their own projects"
  on projects
  for all
  using (auth.uid() = user_id);
