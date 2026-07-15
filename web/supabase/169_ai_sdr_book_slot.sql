-- AI SDR conversational booking: when a candidate agrees to one of the open
-- times the SDR proposed, the draft carries the chosen slot; the send step
-- books it (calendar event + invite) right before the email goes out.
alter table ai_sdr_replies
  add column if not exists book_slot timestamptz;
