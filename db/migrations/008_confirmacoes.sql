-- 008_confirmacoes.sql — "Eu vou": intenção de presença, anterior ao check-in (não conta como presença)
create table event_rsvps (
  event_id   uuid not null references events(id) on delete cascade,
  player_id  uuid not null references players(id),
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
