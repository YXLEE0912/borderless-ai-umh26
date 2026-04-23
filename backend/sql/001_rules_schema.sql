-- Enterprise rule storage for compliance policies

create extension if not exists pgcrypto;

create table if not exists regulatory_rulesets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  jurisdiction text not null default 'MY',
  status text not null default 'draft',
  published_at timestamptz,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists regulatory_rules (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references regulatory_rulesets(id) on delete cascade,
  layer text not null,
  rule_code text not null,
  title text not null,
  keywords jsonb not null default '[]'::jsonb,
  action text not null,
  message text not null,
  permits jsonb not null default '[]'::jsonb,
  agencies jsonb not null default '[]'::jsonb,
  severity integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruleset_id, rule_code)
);

create table if not exists destination_policies (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references regulatory_rulesets(id) on delete cascade,
  country_code text not null,
  country_name text not null,
  absolute_prohibited_keywords jsonb not null default '[]'::jsonb,
  restricted_keywords jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruleset_id, country_code)
);

create table if not exists document_profiles (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references regulatory_rulesets(id) on delete cascade,
  profile_key text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruleset_id, profile_key)
);

create index if not exists idx_rulesets_status_published
  on regulatory_rulesets(status, published_at desc);

create index if not exists idx_rules_ruleset_layer
  on regulatory_rules(ruleset_id, layer, severity);

create index if not exists idx_destination_ruleset_country
  on destination_policies(ruleset_id, country_code);

create index if not exists idx_document_profiles_ruleset_key
  on document_profiles(ruleset_id, profile_key);