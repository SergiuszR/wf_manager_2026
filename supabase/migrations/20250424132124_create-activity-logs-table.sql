-- Create the user activity logs table
create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  action_type text not null, -- e.g., 'update_alt_text', 'edit_cms_item'
  entity_type text not null, -- e.g., 'asset', 'cms_item'
  entity_id text not null,   -- ID of the affected entity
  previous_data jsonb,       -- Previous state of the data (optional)
  new_data jsonb,            -- New state of the data
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table activity_logs enable row level security;

-- Policy: Allow users to read their own activity logs
create policy "Users can read their own activity logs"
  on activity_logs
  for select
  using (auth.uid() = user_id);

-- Policy: Allow users to insert into their own activity logs
create policy "Users can insert activity logs for their projects"
  on activity_logs
  for insert
  with check (auth.uid() = user_id AND 
    (project_id is null OR project_id IN (select id from projects where user_id = auth.uid())));

-- Create index to speed up queries by user_id and project_id
create index idx_activity_logs_user_id on activity_logs(user_id);
create index idx_activity_logs_project_id on activity_logs(project_id);
create index idx_activity_logs_entity_type_entity_id on activity_logs(entity_type, entity_id); 