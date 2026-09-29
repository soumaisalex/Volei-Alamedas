-- 001_init.sql — Vôlei Alamedas (Neon PostgreSQL)
-- Aplicada por GitHub Action (sem rodar nada local).

create extension if not exists pgcrypto;

-- ───────── Tipos ─────────
create type player_role  as enum ('admin', 'operator', 'player');
create type event_status as enum ('scheduled', 'checkin_open', 'in_progress', 'finished', 'cancelled');
create type team_status  as enum ('forming', 'active', 'disbanded');
create type match_status as enum ('in_progress', 'finished');
create type poll_kind    as enum ('player', 'team');
create type poll_status  as enum ('draft', 'open', 'closed');

-- ───────── Jogadores e acesso ─────────
create table players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  photo_url  text,
  phone      text not null unique check (phone ~ '^[0-9]{11}$'), -- só dígitos (DDD + 9); máscara é da UI
  role       player_role not null default 'player',
  claimed_at timestamptz,                                        -- perfil reivindicado pelo próprio jogador
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Limite de tentativas na validação pelos 4 últimos dígitos do celular
create table auth_attempts (
  id         bigserial primary key,
  player_id  uuid references players(id) on delete cascade,
  ip         text,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_player_idx on auth_attempts (player_id, created_at desc);

-- ───────── Eventos e check-in ─────────
create table events (
  id            uuid primary key default gen_random_uuid(),
  event_date    date not null,
  title         text,
  status        event_status not null default 'scheduled',
  team_size     smallint check (team_size between 2 and 6),      -- definido ao iniciar o evento
  points_target smallint not null default 12 check (points_target > 0),
  cancel_reason text,
  started_at    timestamptz,
  finished_at   timestamptz,
  cancelled_at  timestamptz,
  created_by    uuid references players(id),
  created_at    timestamptz not null default now(),
  constraint cancel_reason_required
    check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0)
);
-- Evita duplicar o evento automático da quinta (cancelado libera recriar)
create unique index events_one_per_day on events (event_date) where status <> 'cancelled';

create table checkins (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  player_id       uuid not null references players(id),
  checked_in_at   timestamptz not null default now(),
  checked_in_by   uuid references players(id),                   -- quem fez (o próprio ou outra pessoa)
  left_at         timestamptz,                                   -- "Saí" (checkout)
  left_marked_by  uuid references players(id),
  unique (event_id, player_id)
);

-- ───────── Times e fila ─────────
-- Um time é uma identidade com elenco mutável. Só é desfeito com 2+ vagas abertas ao mesmo tempo.
-- Time 'forming' = vaga reservada na fila (herdada de um time desfeito), aguardando montagem.
create table teams (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  name         text,                                             -- opcional
  color        text,
  status       team_status not null default 'forming',
  queue_pos    integer,                                          -- null = em quadra ou desfeito
  win_streak   smallint not null default 0,
  created_at   timestamptz not null default now(),
  disbanded_at timestamptz,
  constraint teams_queue_unique unique (event_id, queue_pos) deferrable initially deferred
);

create table team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  event_id  uuid not null references events(id) on delete cascade, -- denormalizado p/ índice abaixo
  player_id uuid not null references players(id),
  joined_at timestamptz not null default now(),
  left_at   timestamptz
);
-- Um jogador só pode estar em um time por vez no evento
create unique index team_members_one_open on team_members (event_id, player_id) where left_at is null;

-- ───────── Partidas ─────────
create table matches (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  seq            smallint not null,
  team_a_id      uuid not null references teams(id),
  team_b_id      uuid not null references teams(id),
  team_size      smallint not null,                              -- registrado por partida
  points_target  smallint not null,
  score_a        smallint not null default 0,                    -- placar virtual (opcional) ou final
  score_b        smallint not null default 0,
  live_scoring   boolean not null default false,
  winner_team_id uuid references teams(id),
  status         match_status not null default 'in_progress',
  started_at     timestamptz not null default now(),             -- só registro estatístico
  finished_at    timestamptz,
  unique (event_id, seq),
  check (team_a_id <> team_b_id),
  -- Ao finalizar: placar final e vencedor obrigatórios e coerentes
  check (status <> 'finished' or (
    (winner_team_id = team_a_id and score_a > score_b) or
    (winner_team_id = team_b_id and score_b > score_a)
  ))
);

-- Quem jogou cada partida (base das estatísticas do jogador, mesmo com troca de elenco)
create table match_players (
  match_id  uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id),
  team_id   uuid not null references teams(id),
  primary key (match_id, player_id)
);
create index match_players_player_idx on match_players (player_id);

-- ───────── Enquetes e troféus ─────────
create table poll_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  emoji       text,
  kind        poll_kind not null default 'player',
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create table polls (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events(id) on delete cascade,      -- null = enquete avulsa
  category_id uuid references poll_categories(id),
  title       text not null,
  description text,
  kind        poll_kind not null,
  status      poll_status not null default 'draft',
  opens_at    timestamptz,
  closes_at   timestamptz,
  created_at  timestamptz not null default now()
);

create table poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references polls(id) on delete cascade,
  player_id uuid references players(id),
  team_id   uuid references teams(id),
  label     text,                                                -- opções livres das enquetes avulsas
  check (num_nonnulls(player_id, team_id, label) >= 1)
);

-- Voto secreto: quem votou fica só para garantir 1 voto por pessoa; a API nunca expõe voter_id.
create table votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references polls(id) on delete cascade,
  option_id  uuid not null references poll_options(id) on delete cascade,
  voter_id   uuid not null references players(id),
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

-- Troféus (empate: todos os empatados; time vencedor: um registro por integrante que jogou)
create table awards (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  category_id uuid references poll_categories(id),
  event_id    uuid references events(id),
  player_id   uuid not null references players(id),
  votes_count integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (poll_id, player_id)
);
create index awards_player_idx on awards (player_id);

-- ───────── Estatísticas ─────────
create view player_stats as
select
  p.id as player_id,
  (select count(*) from checkins c
     join events e on e.id = c.event_id
    where c.player_id = p.id and e.status in ('in_progress', 'finished')) as events_played,
  count(m.id)                                              as matches_played,
  count(m.id) filter (where m.winner_team_id =  mp.team_id) as wins,
  count(m.id) filter (where m.winner_team_id <> mp.team_id) as losses,
  (select count(*) from awards a where a.player_id = p.id)  as trophies
from players p
left join match_players mp on mp.player_id = p.id
left join matches m on m.id = mp.match_id and m.status = 'finished'
group by p.id;

create view team_stats as
select
  t.id as team_id,
  t.event_id,
  t.name,
  count(m.id) filter (where m.status = 'finished')  as matches_played,
  count(m.id) filter (where m.winner_team_id = t.id) as wins
from teams t
left join matches m on m.team_a_id = t.id or m.team_b_id = t.id
group by t.id;

-- ───────── Categorias iniciais (editáveis pelo admin) ─────────
insert into poll_categories (name, description, emoji, kind, sort_order) values
  ('Melhor jogador(a) em quadra', 'Quem mais brilhou em quadra hoje', '🏐', 'player', 1),
  ('Melhor time do dia',          'O time que mais mandou bem hoje',  '🥇', 'team',   2),
  ('Craque da galera',            'O queridinho da galera',           '⭐', 'player', 3),
  ('Rede é parede',               'Pula com toda a força do mundo, faz o movimento perfeito... e erra o ponto lindamente', '🧱', 'player', 4),
  ('O chão é lava',               'Se joga no chão para dar um peixinho em qualquer bola, até nas fáceis', '🌋', 'player', 5),
  ('Tartaruga ninja',             'A bola cai a um palmo do pé e ele só olha, de braços cruzados', '🐢', 'player', 6),
  ('Rádio Quadra',                'Não cala a boca um segundo: narra, reclama e desconcentra até o juiz', '📻', 'player', 7),
  ('Saque Performático',          'Saca com estilo e precisão', '🎯', 'player', 8);
