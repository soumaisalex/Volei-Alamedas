-- 007_partidas_corrigidas.sql — marca partidas com placar corrigido depois de encerradas
alter table matches
  add column corrected_at timestamptz,
  add column corrected_by uuid references players(id);
