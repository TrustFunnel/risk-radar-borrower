-- Work details on the profile, and documents the borrower reads into the app
-- (CRB reports, M-Pesa and bank statements). Only what was read out of each
-- document is stored; the file itself never leaves the borrower's phone.

alter table public.profiles add column if not exists work jsonb; -- {employmentType, employer, jobTitle, industry, industrySource, since}

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('crb','mpesa','bank')),
  file_name text not null,
  summary text,
  parsed jsonb, -- {crb: {...}} or {flows: [{month, inflow, outflow}]}
  created_at timestamptz not null default now()
);
create index if not exists documents_user on public.documents (user_id, created_at);

alter table public.documents enable row level security;
create policy own_documents on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy documents_need_consent on public.documents as restrictive for insert with check (public.has_consent('store'));
