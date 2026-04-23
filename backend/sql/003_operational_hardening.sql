-- Operational hardening and runtime tables.
-- Run after sql/001_rules_schema.sql.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Runtime scan storage used by backend/app/services/scan_repository.py
create table if not exists scans (
  id text primary key,
  owner_id uuid,
  prompt text not null,
  destination_country text,
  merchant_name text,
  merchant_ssm text,
  image_asset text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scans_created_at on scans(created_at desc);
create index if not exists idx_scans_destination_country on scans(destination_country);
create index if not exists idx_scans_result_gin on scans using gin(result);

-- Optional audit trail for ruleset changes.
create table if not exists ruleset_audit_log (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid references regulatory_rulesets(id) on delete set null,
  actor_id uuid,
  action text not null,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz not null default now()
);

-- Track authoritative source links and freshness checks.
create table if not exists regulatory_source_registry (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  country_code text,
  source_type text not null,
  title text not null,
  url text not null unique,
  authority_name text,
  status text not null default 'active',
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_source_registry_jurisdiction on regulatory_source_registry(jurisdiction, country_code);
create index if not exists idx_source_registry_status on regulatory_source_registry(status);

-- Enforce key domain constraints safely.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_ruleset_status'
  ) then
    alter table regulatory_rulesets
    add constraint chk_ruleset_status
    check (status in ('draft', 'review', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_rule_layer'
  ) then
    alter table regulatory_rules
    add constraint chk_rule_layer
    check (layer in ('layer1', 'layer2', 'layer3'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_rule_action'
  ) then
    alter table regulatory_rules
    add constraint chk_rule_action
    check (action in ('reject', 'permit_required', 'conditional', 'allow', 'review'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_source_status'
  ) then
    alter table regulatory_source_registry
    add constraint chk_source_status
    check (status in ('active', 'deprecated', 'blocked', 'archived'));
  end if;
end
$$;

create index if not exists idx_rules_keywords_gin
  on regulatory_rules using gin (keywords jsonb_path_ops);

create index if not exists idx_destination_abs_keywords_gin
  on destination_policies using gin (absolute_prohibited_keywords jsonb_path_ops);

create index if not exists idx_destination_restricted_keywords_gin
  on destination_policies using gin (restricted_keywords jsonb_path_ops);

drop trigger if exists trg_rulesets_updated_at on regulatory_rulesets;
create trigger trg_rulesets_updated_at
before update on regulatory_rulesets
for each row execute function set_updated_at();

drop trigger if exists trg_rules_updated_at on regulatory_rules;
create trigger trg_rules_updated_at
before update on regulatory_rules
for each row execute function set_updated_at();

drop trigger if exists trg_destination_updated_at on destination_policies;
create trigger trg_destination_updated_at
before update on destination_policies
for each row execute function set_updated_at();

drop trigger if exists trg_document_profiles_updated_at on document_profiles;
create trigger trg_document_profiles_updated_at
before update on document_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_scans_updated_at on scans;
create trigger trg_scans_updated_at
before update on scans
for each row execute function set_updated_at();

drop trigger if exists trg_source_registry_updated_at on regulatory_source_registry;
create trigger trg_source_registry_updated_at
before update on regulatory_source_registry
for each row execute function set_updated_at();

alter table scans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scans' and policyname = 'scans_select_own'
  ) then
    create policy scans_select_own on scans
      for select using (owner_id is not distinct from auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scans' and policyname = 'scans_insert_own'
  ) then
    create policy scans_insert_own on scans
      for insert with check (owner_id is null or owner_id is not distinct from auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scans' and policyname = 'scans_update_own'
  ) then
    create policy scans_update_own on scans
      for update using (owner_id is not distinct from auth.uid())
      with check (owner_id is not distinct from auth.uid());
  end if;
end
$$;