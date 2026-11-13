-- Afueni WhatsApp channel (WhatsApp Business Platform, Cloud API).
-- Only the server (service role) reads or writes these tables: row-level
-- security is on with no policies, so the browser's anon and signed-in keys
-- see nothing. Kenya DPA 2019: separate, provable consent (s.32), data kept
-- no longer than needed (s.39), right to erasure (s.40).

create table if not exists public.wa_contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,          -- WhatsApp id: the number, digits only
  phone text,                          -- E.164 when it is a Kenyan mobile
  profile_name text,                   -- first name from the WhatsApp profile, cleaned
  user_id uuid references auth.users on delete set null, -- linked app account, if any
  state jsonb not null,                -- conversation state (see src/lib/whatsapp/types.ts)
  version int not null default 0,      -- optimistic lock for concurrent webhooks
  last_inbound_at timestamptz,         -- opens Meta's 24-hour customer service window
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wa_contacts_user on public.wa_contacts (user_id);

create table if not exists public.wa_messages (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.wa_contacts on delete cascade,
  wamid text unique,                   -- Meta's message id; unique, so retried webhooks are ignored
  direction text not null check (direction in ('in','out')),
  author text not null check (author in ('borrower','bot','coach')),
  type text not null,                  -- text, interactive, image, document, audio, template...
  body text,                           -- set to null after 90 days by wa_purge()
  media_id text,
  media_mime text,
  file_name text,
  status text not null check (status in ('received','sent','delivered','read','failed','error')),
  error_code int,
  error_title text,
  pricing_category text,
  created_at timestamptz not null default now(),
  status_at timestamptz
);
create index if not exists wa_messages_contact on public.wa_messages (contact_id, created_at);

-- Append-only consent log; the latest row per purpose wins.
create table if not exists public.wa_consents (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.wa_contacts on delete cascade,
  purpose text not null check (purpose in ('keep','ai_read','crb','lenders','reminders')),
  granted boolean not null,
  version text not null,
  source_wamid text,                   -- the borrower's message that gave or withdrew it
  at timestamptz not null default now()
);
create index if not exists wa_consents_contact on public.wa_consents (contact_id, purpose, at desc);

-- Hand-offs to a person (coach inbox). At most one open case per borrower.
create table if not exists public.wa_cases (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.wa_contacts on delete cascade,
  reason text not null check (reason in ('asked_for_person','assessment','document','voice_note','consent_followup','safety','stuck')),
  priority text not null check (priority in ('normal','high','urgent')),
  note text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists wa_cases_one_open on public.wa_cases (contact_id) where status = 'open';

create table if not exists public.wa_assessments (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.wa_contacts on delete cascade,
  answers jsonb not null,
  level text not null check (level in ('stable','stretched','distressed','crisis')),
  dsr numeric(6,2),
  reasons text[] not null default '{}',
  at timestamptz not null default now()
);

-- Proof that erasure requests were carried out, with no personal data.
create table if not exists public.wa_erasures (
  id bigint generated always as identity primary key,
  reason text not null,
  at timestamptz not null default now()
);

alter table public.wa_contacts enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_consents enable row level security;
alter table public.wa_cases enable row level security;
alter table public.wa_assessments enable row level security;
alter table public.wa_erasures enable row level security;
revoke all on public.wa_contacts, public.wa_messages, public.wa_consents, public.wa_cases, public.wa_assessments, public.wa_erasures from anon, authenticated;

-- Daily retention job (called by /api/cron/whatsapp-retention):
--  * message text older than 90 days is cleared (the record of sending stays);
--  * people who never agreed to us keeping their information, or withdrew
--    it, are deleted 30 days after their last message.
create or replace function public.wa_purge() returns jsonb language plpgsql security definer set search_path = public as $$
declare cleared int; removed int;
begin
  update public.wa_messages set body = null
   where body is not null and created_at < now() - interval '90 days';
  get diagnostics cleared = row_count;

  with latest as (
    select distinct on (contact_id) contact_id, granted from public.wa_consents
     where purpose = 'keep' order by contact_id, at desc
  ), gone as (
    delete from public.wa_contacts c
     where coalesce(c.last_inbound_at, c.created_at) < now() - interval '30 days'
       and not coalesce((select granted from latest l where l.contact_id = c.id), false)
    returning 1
  )
  select count(*) into removed from gone;
  if removed > 0 then insert into public.wa_erasures (reason) select 'retention_no_consent' from generate_series(1, removed); end if;

  return jsonb_build_object('bodies_cleared', cleared, 'contacts_removed', removed);
end $$;
revoke all on function public.wa_purge() from public, anon, authenticated;
grant execute on function public.wa_purge() to service_role;
