-- 013_avaliacoes.sql — avaliação (1 a 5 estrelas) dos jogadores pelos operadores, usada só no sorteio dentro do evento
alter table players add column rating smallint not null default 2 check (rating between 1 and 5);
alter table players add column rated_at timestamptz; -- null = ainda não avaliado (vale o padrão de 2 estrelas)
