-- 시원칸 Supabase schema v0.1
-- Apply in Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

-- 사용자 프로필
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  comfort_type text not null default 'BALANCED' check (comfort_type in ('HOT_SENSITIVE','COLD_SENSITIVE','CROWD_AVOIDER','BALANCED')),
  wait_tolerance_min int not null default 3 check (wait_tolerance_min in (0,3,5,10)),
  transfer_priority text not null default 'MEDIUM' check (transfer_priority in ('LOW','MEDIUM','HIGH')),
  avoid_priority_seat_area boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 비로그인 사용자 프로필
create table if not exists public.anonymous_profiles (
  anonymous_id uuid primary key,
  comfort_type text not null default 'BALANCED' check (comfort_type in ('HOT_SENSITIVE','COLD_SENSITIVE','CROWD_AVOIDER','BALANCED')),
  wait_tolerance_min int not null default 3 check (wait_tolerance_min in (0,3,5,10)),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 저장 경로
create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id uuid,
  label text,
  origin_station text not null,
  destination_station text,
  line text not null,
  direction text,
  comfort_type text check (comfort_type in ('HOT_SENSITIVE','COLD_SENSITIVE','CROWD_AVOIDER','BALANCED')),
  commute_type text default 'CUSTOM' check (commute_type in ('MORNING','EVENING','CUSTOM')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint saved_routes_owner_check check (user_id is not null or anonymous_id is not null)
);

-- 추천 이벤트
create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  line text not null,
  station text not null,
  destination_station text,
  direction text,
  target_time timestamptz not null,
  comfort_type text not null check (comfort_type in ('HOT_SENSITIVE','COLD_SENSITIVE','CROWD_AVOIDER','BALANCED')),
  recommended_car_no int,
  source_provider text,
  source_type text check (source_type in ('REALTIME_CAR','STATISTICAL_CAR','AVERAGE_STATION','ESTIMATED','USER_FEEDBACK')),
  confidence text check (confidence in ('HIGH','MEDIUM','LOW')),
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

-- 피드백 이벤트
create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  line text not null,
  station text not null,
  direction text,
  car_no int,
  feedback_type text not null check (feedback_type in ('GOOD','HOT','COLD','CROWDED','WRONG')),
  temperature_feel text check (temperature_feel in ('HOT','COLD','OK','COOL')),
  crowding_feel text check (crowding_feel in ('LOW','MID','HIGH')),
  created_at timestamptz not null default now()
);

-- 문의 및 문제 제보
create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INCORRECT_RECOMMENDATION','ROUTE_INFO','APP_PROBLEM','IDEA','OTHER')),
  status text not null default 'new' check (status in ('new','triaged','in_progress','resolved','closed','spam')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  message text not null check (char_length(message) between 10 and 2000),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  contact_email text,
  wants_reply boolean not null default false,
  app_context jsonb not null default '{}'::jsonb,
  client_context jsonb not null default '{}'::jsonb,
  submitter_hash text,
  discord_notified_at timestamptz,
  discord_notify_error text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 로그인 사용자 개인화 요약
create table if not exists public.user_preference_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hot_sensitivity_score numeric not null default 0,
  cold_sensitivity_score numeric not null default 0,
  crowd_avoidance_score numeric not null default 0,
  wait_acceptance_score numeric not null default 0,
  preferred_car_zones jsonb not null default '{}'::jsonb,
  disliked_car_zones jsonb not null default '{}'::jsonb,
  sample_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- 비로그인 사용자 개인화 요약
create table if not exists public.anonymous_preference_stats (
  anonymous_id uuid primary key,
  hot_sensitivity_score numeric not null default 0,
  cold_sensitivity_score numeric not null default 0,
  crowd_avoidance_score numeric not null default 0,
  wait_acceptance_score numeric not null default 0,
  preferred_car_zones jsonb not null default '{}'::jsonb,
  disliked_car_zones jsonb not null default '{}'::jsonb,
  sample_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- 정적 역 정보
create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  line text not null,
  external_code text,
  lat numeric,
  lng numeric,
  operator text,
  created_at timestamptz not null default now(),
  unique(name, line)
);

-- 약냉방칸
create table if not exists public.weak_ac_cars (
  id uuid primary key default gen_random_uuid(),
  line text not null,
  car_no int not null,
  season_start text default '04-01',
  season_end text default '10-31',
  source text,
  created_at timestamptz not null default now(),
  unique(line, car_no)
);

-- Provider/API 캐시: 무료 API 보호용. appKey 원문은 저장하지 않는다.
create table if not exists public.provider_cache_entries (
  cache_key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Provider/API 진단 이벤트: appKey 원문은 저장하지 않는다.
create table if not exists public.provider_diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  diagnostic_code text not null,
  ok boolean not null default false,
  http_status int,
  endpoint_host text,
  endpoint_path text,
  app_key_present boolean not null default false,
  app_key_source text,
  request_params jsonb,
  response_snippet text,
  duration_ms int,
  error_name text,
  error_message text,
  created_at timestamptz not null default now()
);

-- indexes
create index if not exists idx_recommendation_events_user_created on public.recommendation_events(user_id, created_at desc);
create index if not exists idx_recommendation_events_anon_created on public.recommendation_events(anonymous_id, created_at desc);
create index if not exists idx_feedback_events_user_created on public.feedback_events(user_id, created_at desc);
create index if not exists idx_feedback_events_line_station_created on public.feedback_events(line, station, created_at desc);
create index if not exists idx_support_reports_created on public.support_reports(created_at desc);
create index if not exists idx_support_reports_status_created on public.support_reports(status, created_at desc);
create index if not exists idx_support_reports_type_created on public.support_reports(type, created_at desc);
create index if not exists idx_saved_routes_user on public.saved_routes(user_id);
create index if not exists idx_stations_search on public.stations(line, name);
create index if not exists idx_provider_cache_entries_expires on public.provider_cache_entries(expires_at);
create index if not exists idx_provider_diagnostic_events_provider_created on public.provider_diagnostic_events(provider, created_at desc);
create index if not exists idx_provider_diagnostic_events_code_created on public.provider_diagnostic_events(diagnostic_code, created_at desc);

-- RLS
alter table public.user_profiles enable row level security;
alter table public.saved_routes enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.feedback_events enable row level security;
alter table public.support_reports enable row level security;
alter table public.user_preference_stats enable row level security;
alter table public.provider_cache_entries enable row level security;
alter table public.provider_diagnostic_events enable row level security;

-- user_profiles policies
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);

-- saved_routes policies
drop policy if exists "Users can manage own saved routes" on public.saved_routes;
create policy "Users can manage own saved routes" on public.saved_routes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recommendation_events policies
drop policy if exists "Users can read own recommendation events" on public.recommendation_events;
create policy "Users can read own recommendation events" on public.recommendation_events
  for select using (auth.uid() = user_id);

-- feedback_events policies
drop policy if exists "Users can read own feedback events" on public.feedback_events;
create policy "Users can read own feedback events" on public.feedback_events
  for select using (auth.uid() = user_id);

-- preference stats policies
drop policy if exists "Users can read own preference stats" on public.user_preference_stats;
create policy "Users can read own preference stats" on public.user_preference_stats
  for select using (auth.uid() = user_id);

-- NOTE: Inserts for recommendation_events/feedback_events should be performed by server routes using service role,
-- because anonymous users and normalized provider metadata are handled server-side.
