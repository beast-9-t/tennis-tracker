-- ============================================================
-- 网球记录助手 · Supabase (PostgreSQL) 初始化脚本
--
-- 执行方式：Supabase 控制台 → SQL Editor → New query → 粘贴全部内容 → Run
-- 脚本是幂等的，重复执行不会报错。
--
-- 说明：应用只通过服务端 service_role 密钥访问 PostgREST（service_role 会绕过 RLS），
-- 浏览器不直连数据库。因此下面同时开启 RLS 且不创建任何策略，
-- 保证 anon / authenticated 密钥即使泄露也读不到任何数据。
-- ============================================================

create table if not exists public.users (
  id                  text primary key,
  username            text not null,
  normalized_username text not null unique,
  password_hash       text not null,
  status              text not null default 'active',
  profile             jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.sessions (
  access_token       text primary key,
  refresh_token      text not null unique,
  user_id            text not null references public.users(id) on delete cascade,
  access_expires_at  timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked_at         timestamptz
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_refresh_expires_at_idx on public.sessions (refresh_expires_at);

create table if not exists public.training_records (
  id               text primary key,
  user_id          text not null references public.users(id) on delete cascade,
  client_record_id text,
  occurred_at      timestamptz not null,
  duration_minutes integer not null,
  focus            text not null,
  mood             text not null,
  self_rating      integer not null,
  energy_level     integer not null,
  notes            text,
  location         text,
  partner          text,
  weather          text,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists training_records_user_occurred_idx
  on public.training_records (user_id, occurred_at desc);

-- 幂等键：同一用户下 client_record_id 唯一（NULL 视为不同值，不参与去重）
create unique index if not exists training_records_client_id_key
  on public.training_records (user_id, client_record_id)
  where client_record_id is not null;

create table if not exists public.training_goals (
  user_id              text primary key references public.users(id) on delete cascade,
  weekly_target_count  integer not null,
  monthly_target_count integer not null,
  week_starts_on       integer not null default 1,
  timezone             text not null,
  version              integer not null default 1,
  updated_at           timestamptz not null default now()
);

create table if not exists public.feedback (
  id         text primary key,
  user_id    text not null references public.users(id) on delete cascade,
  content    text not null,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);

create table if not exists public.migration_status (
  user_id          text primary key references public.users(id) on delete cascade,
  completed        boolean not null default false,
  imported_count   integer not null default 0,
  skipped_count    integer not null default 0,
  failed_count     integer not null default 0,
  last_migrated_at timestamptz
);

-- 锁死匿名访问：应用侧使用 service_role，不受 RLS 影响
alter table public.users            enable row level security;
alter table public.sessions         enable row level security;
alter table public.training_records enable row level security;
alter table public.training_goals   enable row level security;
alter table public.feedback         enable row level security;
alter table public.migration_status enable row level security;
