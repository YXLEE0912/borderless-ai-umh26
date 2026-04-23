-- Governance and audit layer for enterprise compliance operations.
-- Run after sql/003_operational_hardening.sql.

create extension if not exists pgcrypto;

create table if not exists rule_change_requests (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid references regulatory_rulesets(id) on delete set null,
  target_table text not null,
  target_row_id uuid,
  change_type text not null,
  proposed_by uuid,
  reviewed_by uuid,
  review_status text not null default 'pending',
  reason text,
  proposed_patch jsonb not null default '{}'::jsonb,
  approved_patch jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists rule_execution_log (
  id uuid primary key default gen_random_uuid(),
  scan_id text,
  ruleset_id uuid references regulatory_rulesets(id) on delete set null,
  destination_country text,
  final_status text not null,
  rule_hits jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  required_permits jsonb not null default '[]'::jsonb,
  required_agencies jsonb not null default '[]'::jsonb,
  ssm_check text,
  source text,
  execution_ms integer,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rule_change_requests_status
  on rule_change_requests(review_status, created_at desc);

create index if not exists idx_rule_change_requests_ruleset
  on rule_change_requests(ruleset_id);

create index if not exists idx_rule_execution_log_scan
  on rule_execution_log(scan_id, created_at desc);

create index if not exists idx_rule_execution_log_ruleset
  on rule_execution_log(ruleset_id, created_at desc);

create index if not exists idx_rule_execution_log_rule_hits_gin
  on rule_execution_log using gin(rule_hits jsonb_path_ops);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_rule_change_type'
  ) then
    alter table rule_change_requests
    add constraint chk_rule_change_type
    check (change_type in ('insert', 'update', 'delete', 'publish', 'archive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_rule_review_status'
  ) then
    alter table rule_change_requests
    add constraint chk_rule_review_status
    check (review_status in ('pending', 'approved', 'rejected', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_rule_final_status'
  ) then
    alter table rule_execution_log
    add constraint chk_rule_final_status
    check (final_status in ('green', 'conditional', 'restricted', 'review'));
  end if;
end
$$;

drop trigger if exists trg_rule_change_requests_updated_at on rule_change_requests;
create trigger trg_rule_change_requests_updated_at
before update on rule_change_requests
for each row execute function set_updated_at();

alter table rule_change_requests enable row level security;
alter table rule_execution_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_change_requests' and policyname = 'rule_change_requests_service_only'
  ) then
    create policy rule_change_requests_service_only on rule_change_requests
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_execution_log' and policyname = 'rule_execution_log_service_only'
  ) then
    create policy rule_execution_log_service_only on rule_execution_log
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;