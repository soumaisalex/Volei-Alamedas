-- 012_notificacoes.sql — notificações push (Web Push): um registro por aparelho/navegador inscrito
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  topics     text[] not null default '{event,polls,notice}', -- event: eventos · polls: enquetes · notice: avisos do admin · admin: alertas só do admin
  created_at timestamptz not null default now()
);
create index push_subscriptions_player_idx on push_subscriptions (player_id);
