-- Separate consent for sending a document's text to our AI provider
-- (Anthropic, United States) to read CRB reports and bank statements, and to
-- name an industry from the employer and job title. Kenya DPA 2019 s.32 and
-- s.48: the borrower must be told about the transfer and agree to it.

alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('store','analyse','ai_read','reminders','share_partner'));
