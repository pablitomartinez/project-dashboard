-- Initial V1 schema: projects, tasks and project_resources.
--
-- RLS: enabled on every table with no policies, and table privileges revoked
-- from the `anon` and `authenticated` roles. The Data API with the public
-- (anon) key therefore cannot read or write anything. All access goes through
-- server-side Next.js code using the service role key, which must never be
-- exposed to the browser. See docs/ARCHITECTURE.md.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- projects

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  progress_mode text not null default 'manual',
  manual_progress smallint not null default 0,
  local_path text,
  repository_url text,
  production_url text,
  branch text,
  stack text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_name_not_blank check (btrim(name) <> ''),
  constraint projects_status_check check (status in ('active', 'paused', 'completed')),
  constraint projects_progress_mode_check check (progress_mode in ('manual', 'tasks')),
  constraint projects_manual_progress_range check (manual_progress between 0 and 100),
  constraint projects_repository_url_http check (repository_url is null or repository_url ~* '^https?://'),
  constraint projects_production_url_http check (production_url is null or production_url ~* '^https?://')
);

create index projects_status_idx on public.projects (status);
create index projects_updated_at_idx on public.projects (updated_at desc);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- tasks

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_position_non_negative check (position >= 0)
);

-- Covers the project_id foreign key and ordering by position
-- (the first pending task is the project's next step).
create index tasks_project_id_position_idx on public.tasks (project_id, position);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- project_resources

create table public.project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null default 'other',
  label text not null,
  url text,
  account text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_resources_type_check check (
    type in ('github', 'supabase', 'vercel', 'domain', 'figma', 'analytics', 'other')
  ),
  constraint project_resources_label_not_blank check (btrim(label) <> ''),
  constraint project_resources_url_http check (url is null or url ~* '^https?://')
);

create index project_resources_project_id_idx on public.project_resources (project_id);

create trigger project_resources_set_updated_at
before update on public.project_resources
for each row execute function public.set_updated_at();

-- Row Level Security

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.project_resources enable row level security;

revoke all on table public.projects, public.tasks, public.project_resources from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
