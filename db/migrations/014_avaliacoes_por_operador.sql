-- 014_avaliacoes_por_operador.sql — cada operador/admin dá a sua própria nota (1 a 5) a cada jogador; o sorteio usa a média
create table player_ratings (
  player_id uuid not null references players(id) on delete cascade,
  rater_id  uuid not null references players(id) on delete cascade,
  rating    smallint not null check (rating between 1 and 5),
  rated_at  timestamptz not null default now(),
  primary key (player_id, rater_id)
);

-- As notas que já existiam (uma por jogador) passam a ser do admin; os demais operadores avaliam a partir de agora.
insert into player_ratings (player_id, rater_id, rating, rated_at)
select p.id, a.id, p.rating, p.rated_at
from players p, (select id from players where role = 'admin' order by created_at limit 1) a
where p.rated_at is not null;

alter table players drop column rating;
alter table players drop column rated_at;
