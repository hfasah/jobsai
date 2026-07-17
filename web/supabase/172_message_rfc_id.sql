-- 172: RFC Message-ID on the conversation log, so AI SDR replies can send real
-- In-Reply-To/References headers and thread properly in the candidate's inbox.
-- Captured from Resend's email.received payload (data.message_id) on inbound.
alter table enterprise_messages add column if not exists rfc_message_id text;
