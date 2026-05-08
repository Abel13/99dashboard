create table if not exists public.opportunities (
  project_id text primary key,
  title text not null,
  status text,
  score integer,
  price_suggested numeric,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  project_id text primary key,
  status text,
  reason text,
  notes text,
  outcome text,
  price_override numeric,
  proposal_sent_price numeric,
  proposal_sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_state (
  key text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.import_runs (
  id bigserial primary key,
  kind text not null default 'gmail',
  ok boolean not null default false,
  found integer,
  saved integer,
  query text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists opportunities_touch_updated_at on public.opportunities;
create trigger opportunities_touch_updated_at before update on public.opportunities for each row execute function public.touch_updated_at();

drop trigger if exists feedback_touch_updated_at on public.feedback;
create trigger feedback_touch_updated_at before update on public.feedback for each row execute function public.touch_updated_at();

alter table public.opportunities enable row level security;
alter table public.feedback enable row level security;
alter table public.import_state enable row level security;
alter table public.import_runs enable row level security;

-- Local/self-hosted dashboard writes through the server with service role key.
-- No public anon policies by default.
