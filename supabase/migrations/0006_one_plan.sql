-- Afueni One Plan: one affordable payment shared across all of a borrower's
-- lenders, plus Pause, Clean Slate and missed-payment requests to the coach.
-- Run after 0004 (WhatsApp) and 0005 (money messages).

-- New permissions: share my plan with my lenders, talk to my lenders for me
-- (letter of authority), and the optional Afueni Graduates pool.
alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('store','analyse','ai_read','reminders','share_partner','sms_read','share_plan','act_for_me','graduates'));

-- Requests the coach works on.
alter table public.distress_requests drop constraint if exists distress_requests_goal_check;
alter table public.distress_requests add constraint distress_requests_goal_check
  check (goal in ('affordable_plan','refinance','settlement','advice','one_plan','pause','clean_slate','missed_payment'));

-- Plan proposals need "share my plan with my lenders"; Pause, Clean Slate and
-- missed-payment requests need "talk to my lenders for me". The older help
-- requests keep needing the per-request share_partner consent.
drop policy if exists requests_need_consent on public.distress_requests;
create policy requests_need_consent on public.distress_requests as restrictive for insert with check (
  case
    when goal = 'one_plan' then public.has_consent('share_plan')
    when goal in ('pause','clean_slate','missed_payment') then public.has_consent('act_for_me')
    else public.has_consent('share_partner')
  end
);

-- One row per plan. The plan itself (lenders, amounts, payments, pause) is
-- kept as JSON so the shape can change during the pilot without migrations;
-- ref and status are columns so the coach can find and filter plans.
create table if not exists public.one_plans (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  ref text not null unique check (ref ~ '^AFUENI-[A-Z0-9]{6}$'),
  status text not null check (status in ('draft','active','paused','completed','ended')),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists one_plans_user on public.one_plans (user_id);
create index if not exists one_plans_status on public.one_plans (status);

alter table public.one_plans enable row level security;
create policy own_one_plans on public.one_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Storing a plan needs the same consent as storing loans.
create policy one_plans_need_consent on public.one_plans as restrictive for insert with check (public.has_consent('store'));
