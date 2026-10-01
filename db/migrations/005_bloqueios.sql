-- 005_bloqueios.sql — jogadores impedidos de fazer check-in em um evento
create table checkin_blocks (
  event_id   uuid not null references events(id) on delete cascade,
  player_id  uuid not null references players(id),
  blocked_by uuid references players(id),
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
