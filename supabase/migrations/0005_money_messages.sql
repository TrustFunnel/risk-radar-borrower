-- Money messages: transactions read from the borrower's M-PESA, Airtel Money,
-- bank and lender SMS, as they arrive (Android app) or when shared or pasted.
--
-- The SMS text itself is never stored or uploaded. It is read on the phone and
-- only the fields below are kept (Kenya DPA 2019 s.25(c) data minimisation).
-- People's names and phone numbers are dropped on the phone; counterparty holds
-- business or lender names only. ref_hash is a one-way hash used to skip
-- duplicates, not the M-PESA receipt number.

alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('store','analyse','ai_read','reminders','share_partner','sms_read'));

create table if not exists public.money_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  ref_hash text not null,
  source text not null check (source in ('mpesa','airtel','bank','lender')),
  kind text not null check (kind in ('received','sent','paybill','buygoods','withdraw','deposit','airtime',
    'loan_disbursed','loan_repaid','loan_due','loan_overdue','overdraft','reversal')),
  direction text not null check (direction in ('in','out','none')),
  amount numeric(14,2) not null check (amount > 0),
  fee numeric(14,2),
  balance numeric(14,2),
  occurred_at timestamptz not null,
  counterparty text,
  category text not null check (category in ('income','loan','betting','bills','shopping','cash','airtime','transfer','other')),
  lender text,
  due_date date,
  outstanding numeric(14,2),
  days_overdue int,
  channel text not null check (channel in ('auto','share','paste')), -- how it reached us
  created_at timestamptz not null default now(),
  unique (user_id, ref_hash)
);
create index if not exists money_events_user_time on public.money_events (user_id, occurred_at desc);

alter table public.money_events enable row level security;
create policy own_money_events on public.money_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy money_events_need_consent on public.money_events as restrictive for insert with check (public.has_consent('sms_read'));

-- Withdrawing consent deletes what was captured (the borrower can also do it
-- from the Money screen). Retention: events older than 24 months are purged.
create or replace function public.money_events_on_withdraw() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.purpose = 'sms_read' and not new.granted then
    delete from public.money_events where user_id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists money_events_withdraw on public.consents;
create trigger money_events_withdraw after insert on public.consents for each row execute function public.money_events_on_withdraw();

create or replace function public.money_events_purge() returns void language sql security definer set search_path = public as $$
  delete from public.money_events where occurred_at < now() - interval '24 months'
$$;
revoke all on function public.money_events_purge() from public, anon, authenticated;
