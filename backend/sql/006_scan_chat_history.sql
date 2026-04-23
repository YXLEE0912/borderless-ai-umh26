-- Chat history storage for follow-up Q&A per scan.
-- Run after sql/003_operational_hardening.sql.

create extension if not exists pgcrypto;

create table if not exists scan_chat_messages (
  id uuid primary key default gen_random_uuid(),
  scan_id text not null references scans(id) on delete cascade,
  role text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scan_chat_messages_scan_created
  on scan_chat_messages(scan_id, created_at asc);

create index if not exists idx_scan_chat_messages_metadata_gin
  on scan_chat_messages using gin(metadata);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_scan_chat_role'
  ) then
    alter table scan_chat_messages
    add constraint chk_scan_chat_role
    check (role in ('user', 'assistant'));
  end if;
end
$$;

drop trigger if exists trg_scan_chat_messages_updated_at on scan_chat_messages;
create trigger trg_scan_chat_messages_updated_at
before update on scan_chat_messages
for each row execute function set_updated_at();

alter table scan_chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_chat_messages' and policyname = 'scan_chat_messages_select_own'
  ) then
    create policy scan_chat_messages_select_own on scan_chat_messages
      for select using (
        exists (
          select 1 from scans s
          where s.id = scan_chat_messages.scan_id
          and s.owner_id is not distinct from auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_chat_messages' and policyname = 'scan_chat_messages_insert_own'
  ) then
    create policy scan_chat_messages_insert_own on scan_chat_messages
      for insert with check (
        exists (
          select 1 from scans s
          where s.id = scan_chat_messages.scan_id
          and (s.owner_id is null or s.owner_id is not distinct from auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scan_chat_messages' and policyname = 'scan_chat_messages_update_own'
  ) then
    create policy scan_chat_messages_update_own on scan_chat_messages
      for update using (
        exists (
          select 1 from scans s
          where s.id = scan_chat_messages.scan_id
          and s.owner_id is not distinct from auth.uid()
        )
      )
      with check (
        exists (
          select 1 from scans s
          where s.id = scan_chat_messages.scan_id
          and s.owner_id is not distinct from auth.uid()
        )
      );
  end if;
end
$$;
