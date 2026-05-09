create table if not exists public.app_settings (
  key text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at before update on public.app_settings for each row execute function public.touch_updated_at();

alter table public.app_settings enable row level security;

-- Server-side dashboard reads/writes settings with the Supabase service role key.
