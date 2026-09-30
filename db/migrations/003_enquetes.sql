-- 003_enquetes.sql — uma enquete por categoria em cada evento
create unique index polls_event_category_uniq
  on polls (event_id, category_id)
  where event_id is not null and category_id is not null;
