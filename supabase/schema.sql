-- Initial Estate Supply Chain — Supabase schema
-- Run this once in the Supabase SQL editor after creating your project.

-- ===== Users =====
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

-- ===== Workspace settings (single row) =====
create table if not exists workspace_settings (
  id        text  primary key default 'default',
  settings  jsonb not null
);

-- ===== DSAR queue =====
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

-- ===== Forgot-password queue =====
create table if not exists forgot_password_queue (
  id           bigserial    primary key,
  email        text         not null,
  requested_at timestamptz  default now(),
  resolved_at  timestamptz,
  resolved_by  text
);
create index if not exists forgot_status_idx on forgot_password_queue (resolved_at);

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

-- ============================================================
-- Master data
-- ============================================================

create table if not exists units (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  type        text  default 'count',
  notes       text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists project_types (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  description text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists projects (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  type_id     text  references project_types(id) on delete set null,
  status      text  default 'planning',
  location    text  default '',
  budget      numeric default 0,
  start_date  date,
  end_date    date,
  notes       text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists suppliers (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  type        text  default 'company',
  contact_name text default '',
  email       text  default '',
  phone       text  default '',
  address     text  default '',
  tax_id      text  default '',
  payment_terms text default '',
  rating      numeric default 0,
  notes       text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists materials (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  category    text  default '',
  unit_id     text  references units(id) on delete set null,
  spec        text  default '',
  notes       text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists subcontracts (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  category    text  default '',
  unit_id     text  references units(id) on delete set null,
  notes       text  default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists contract_types (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  description text  default '',
  deposit_pct numeric default 0,
  retention_pct numeric default 0,
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists approval_roles (
  id          text  primary key,
  code        text  unique not null,
  name        text  not null,
  level       int   default 1,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ============================================================
-- Operational (RFQ / Price DB / Contracts) — basic schemas
-- ============================================================

create table if not exists rfqs (
  id          text  primary key,
  no          text  unique not null,
  project_id  text  references projects(id) on delete set null,
  title       text  not null,
  status      text  default 'draft' check (status in ('draft','sent','received','closed','cancelled')),
  due_date    date,
  notes       text  default '',
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists rfqs_status_idx on rfqs (status);
create index if not exists rfqs_project_idx on rfqs (project_id);

create table if not exists rfq_items (
  id          text  primary key,
  rfq_id      text  references rfqs(id) on delete cascade,
  material_id text  references materials(id) on delete set null,
  name        text  not null,
  spec        text  default '',
  qty         numeric default 0,
  unit_id     text  references units(id) on delete set null,
  notes       text  default '',
  sort_order  int   default 0
);
create index if not exists rfq_items_rfq_idx on rfq_items (rfq_id);

create table if not exists price_points (
  id          text  primary key,
  material_id text  references materials(id) on delete cascade,
  supplier_id text  references suppliers(id) on delete set null,
  price       numeric not null,
  unit_id     text  references units(id) on delete set null,
  source      text  default 'manual',
  source_id   text  default '',
  captured_at timestamptz default now()
);
create index if not exists price_points_material_idx on price_points (material_id);

create table if not exists contracts (
  id          text  primary key,
  no          text  unique not null,
  project_id  text  references projects(id) on delete set null,
  supplier_id text  references suppliers(id) on delete set null,
  type_id     text  references contract_types(id) on delete set null,
  title       text  not null,
  amount      numeric default 0,
  currency    text  default 'THB',
  status      text  default 'draft' check (status in ('draft','active','expired','terminated')),
  start_date  date,
  end_date    date,
  signed_at   date,
  notes       text  default '',
  created_at  timestamptz default now()
);
create index if not exists contracts_status_idx on contracts (status);
create index if not exists contracts_supplier_idx on contracts (supplier_id);
