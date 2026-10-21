-- Borrower loan wallet: initial schema.
-- Every table holding personal data has row-level security so a signed-in
-- borrower can read and write only their own rows. Partners never query these
-- tables directly; shared loans reach them through distress_requests only.

create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  monthly_income numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only consent log (Kenya DPA 2019 s.32: controller must prove consent).
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null check (purpose in ('store','analyse','reminders','share_partner')),
  granted boolean not null,
  version text not null,
  at timestamptz not null default now()
);
create index consents_user_purpose on public.consents (user_id, purpose, at desc);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lender text not null,
  lender_type text not null check (lender_type in ('bank','sacco','mfi','digital','chama','other')),
  product_name text,
  principal numeric(14,2) not null check (principal > 0),
  rate numeric(9,4) not null default 0,
  rate_type text not null check (rate_type in ('reducing_annual','flat_annual','flat_monthly','per_term')),
  frequency text not null check (frequency in ('monthly','weekly','bullet')),
  installments int not null check (installments >= 1),
  term_days int,
  upfront_fees numeric(14,2),
  installment_amount numeric(14,2),
  disbursed_on date not null,
  first_due_date date not null,
  outstanding_balance numeric(14,2),
  arrears_days int not null default 0,
  status text not null default 'current' check (status in ('current','late','defaulted','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index loans_user on public.loans (user_id);

-- Uploaded statements; the file lives in the private "statements" bucket and
-- is deleted after 30 days unless the borrower keeps it.
create table public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  loan_id uuid references public.loans on delete set null,
  storage_path text not null,
  kind text not null check (kind in ('mpesa','lender_pdf','lender_csv','other')),
  parsed jsonb,
  keep_file boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.distress_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  loan_id uuid not null references public.loans on delete cascade,
  goal text not null check (goal in ('restructure','settlement','advice')),
  message text,
  status text not null default 'submitted' check (status in ('submitted','in_review','closed','withdrawn')),
  consent_id bigint not null references public.consents,
  created_at timestamptz not null default now()
);

-- Audit trail of every time a borrower's data is shown to a partner.
create table public.share_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.distress_requests on delete cascade,
  partner text not null,
  shared_at timestamptz not null default now(),
  shared_by uuid
);

-- Public reference data for the Compare page (no personal data).
create table public.lender_products (
  id bigint generated always as identity primary key,
  lender_id text not null,
  lender text not null,
  lender_type text not null,
  product text not null,
  min_amount numeric(14,2), max_amount numeric(14,2),
  min_term_months int, max_term_months int,
  rate numeric(9,4) not null,
  rate_type text not null,
  fee_pct numeric(7,4), fee_flat numeric(14,2),
  collateral text,
  source_url text not null,
  checked_on date not null
);

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.loans enable row level security;
alter table public.statements enable row level security;
alter table public.distress_requests enable row level security;
alter table public.share_log enable row level security;
alter table public.lender_products enable row level security;

create policy own_profile on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_consents_read on public.consents for select using (auth.uid() = user_id);
create policy own_consents_insert on public.consents for insert with check (auth.uid() = user_id);
create policy own_loans on public.loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_statements on public.statements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_requests_read on public.distress_requests for select using (auth.uid() = user_id);
create policy own_requests_insert on public.distress_requests for insert with check (auth.uid() = user_id);
create policy own_requests_withdraw on public.distress_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id and status = 'withdrawn');
create policy own_share_log on public.share_log for select using (exists (select 1 from public.distress_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy products_public on public.lender_products for select using (true);

-- Storing loans requires the latest 'store' consent to be granted.
create or replace function public.has_consent(p text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select granted from public.consents where user_id = auth.uid() and purpose = p order by at desc limit 1), false)
$$;
create policy loans_need_consent on public.loans as restrictive for insert with check (public.has_consent('store'));
