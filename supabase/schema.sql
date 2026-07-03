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
  warranty    text  default '',
  notes       text  default '',
  created_at  timestamptz default now()
);
-- Idempotent migration for existing tables that pre-date the warranty column
alter table contracts add column if not exists warranty text default '';
create index if not exists contracts_status_idx on contracts (status);
create index if not exists contracts_supplier_idx on contracts (supplier_id);

-- Suppliers: 3-state status (Active / Non-Active / Blacklist) — replaces
-- the boolean `active` column for UI purposes. Old `active` column is kept
-- for backward compat (mirrored from status at write-time).
alter table suppliers add column if not exists status text default 'Active';

-- Materials: 3-level taxonomy. Existing `category` column is repurposed as
-- the sub-category (level 2). `main_category` is the new top-level (level 1).
-- The `name` column remains the leaf item (level 3).
alter table materials add column if not exists main_category text default '';

-- Units: extend with English name + alias list. `code` is the symbol,
-- `name` is the Thai label, `name_en` is the English label, and `aliases`
-- is a comma-separated list of accepted alternative spellings/codes.
alter table units add column if not exists name_en text default '';
alter table units add column if not exists aliases text default '';

-- ============================================================
-- Materials: 3-level taxonomy with parent-linked master tables
-- ============================================================
-- The denormalized `main_category` / `category` strings on `materials`
-- stay for backward compat with existing data + Bulk Upload (we look up
-- the masters by name at save time). The masters exist primarily to
-- (a) constrain dropdowns in the UI, and (b) record the parent link
-- (sub → main) so reorganisation has a single source of truth.
create table if not exists material_main_categories (
  id          text primary key,
  name        text unique not null,
  notes       text default '',
  active      boolean default true,
  created_at  timestamptz default now()
);
create table if not exists material_sub_categories (
  id          text primary key,
  main_id     text references material_main_categories(id) on delete restrict,
  name        text not null,
  notes       text default '',
  active      boolean default true,
  created_at  timestamptz default now()
);
-- A sub-category name can repeat across different mains (e.g. "อื่นๆ")
-- but must be unique within one main.
create unique index if not exists material_sub_unique on material_sub_categories (main_id, name);

-- Sub-category short code — used as the prefix for auto-generated Item
-- codes (e.g. PILE for เสาเข็ม → items become PILE-00001, PILE-00002).
-- Per-sub counters keep item codes unambiguous across the catalog.
alter table material_sub_categories add column if not exists short_code text default '';

-- ============================================================
-- Subcontracts: 2-level taxonomy (ประเภท → ชิ้นงานจ้าง)
-- ============================================================
-- Master table for the top-level category. The `subcontracts` rows keep
-- their denormalized `category` string (Level 1 name) for backward compat
-- and bulk upload; `name` remains the leaf item (Level 2).
create table if not exists subcontract_categories (
  id          text primary key,
  name        text unique not null,
  notes       text default '',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists comparisons (
  id          text  primary key,
  no          text  unique not null,
  title       text  not null,
  project_id  text  references projects(id) on delete set null,
  status      text  default 'draft' check (status in ('draft','finalized','archived')),
  items_json  jsonb default '[]'::jsonb,
  suppliers_json jsonb default '[]'::jsonb,
  total_low   numeric default 0,
  total_high  numeric default 0,
  notes       text  default '',
  created_by  text,
  created_at  timestamptz default now()
);
create index if not exists comparisons_status_idx on comparisons (status);

-- ============================================================
-- File attachments (Google Drive metadata)
-- Actual files live in Google Drive; this table maps them to entities.
-- ============================================================

create table if not exists file_attachments (
  id              text         primary key,
  entity_type     text         default '',
  entity_id       text         default '',
  category        text         not null,
  drive_file_id   text         not null,
  drive_view_link text         default '',
  filename        text         not null,
  mime_type       text         default '',
  size            bigint       default 0,
  uploaded_by     text,
  uploaded_at     timestamptz  default now()
);
create index if not exists attachments_entity_idx on file_attachments (entity_type, entity_id);
create index if not exists attachments_category_idx on file_attachments (category);

-- ============================================================
-- Purchase Orders — created from a finalized comparison (P1)
-- ============================================================
create table if not exists purchase_orders (
  id            text primary key,
  no            text unique not null,
  comparison_id text references comparisons(id) on delete set null,
  project_id    text references projects(id) on delete set null,
  supplier_id   text references suppliers(id) on delete set null,
  supplier_name text default '',
  title         text default '',
  status        text default 'ordered' check (status in ('ordered','received','closed','cancelled')),
  items_json    jsonb default '[]',
  amount        numeric default 0,
  notes         text default '',
  created_by    text default '',
  ordered_at    date,
  received_at   date,
  closed_at     date,
  created_at    timestamptz default now()
);
create index if not exists po_status_idx on purchase_orders (status);

-- Retention release tracking (P1): who closed out the retention and when.
alter table contracts add column if not exists retention_released_at date;
alter table contracts add column if not exists retention_released_by text default '';
