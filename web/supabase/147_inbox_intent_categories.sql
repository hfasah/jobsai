-- Finer reply categories: the AI SDR now classifies "question" (engaged, asking
-- about comp/location/logistics — the AI SDR can answer from the knowledge base)
-- and "wrong_person" (reached the wrong contact). Widen the intent check so
-- these can be persisted on the thread.
alter table inbox_threads drop constraint if exists inbox_threads_intent_check;
alter table inbox_threads add constraint inbox_threads_intent_check
  check (intent in (
    'interested', 'not_interested', 'out_of_office', 'referral',
    'unsubscribe', 'meeting_requested', 'question', 'wrong_person', 'neutral'
  ));
