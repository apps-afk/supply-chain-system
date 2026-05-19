-- Initial Estate Supply Chain — Supabase schema
-- Run this once in the Supabase SQL editor after creating your project.

-- ===== Users table =====
create table if not exists users (
  id          text         primary key,
  email       text         unique not null,
  name        text         not null,
  phone       text         default '',
  role        text         default 'user',
  salt        text         not null,
  hash        text         not null,
  verified    boolean      default true,
  created_at  timestamptz  default now(),
  last_login  timestamptz
);
create index if not exists users_email_lower_idx on users (lower(email));

-- ===== Workspace settings (single row, id='default') =====
create table if not exists workspace_settings (
  id        text  primary key default 'default',
  settings  jsonb not null
);

-- ===== DSAR (Data Subject Access Request) queue =====
create table if not exists dsar_requests (
  id                text         primary key,
  applicant_email   text         not null,
  type              text         not null check (type in ('access','export','correct','delete')),
  status            text         default 'pending' check (status in ('pending','resolved')),
  note              text         default '',
  created_at        timestamptz  default now(),
  resolved_at       timestamptz,
  resolved_by       text
);
create index if not exists dsar_status_idx on dsar_requests (status);

-- ===== Forgot-password queue (for admin to action) =====
create table if not exists forgot_password_queue (
  id           bigserial    primary key,
  email        text         not null,
  requested_at timestamptz  default now(),
  resolved_at  timestamptz
);

-- ===== Audit log =====
create table if not exists audit_log (
  id         bigserial    primary key,
  actor      text         not null,
  action     text         not null,
  target     text,
  metadata   jsonb,
  timestamp  timestamptz  default now()
);
create index if not exists audit_log_timestamp_idx on audit_log (timestamp desc);
