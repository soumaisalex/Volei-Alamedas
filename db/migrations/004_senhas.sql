-- 004_senhas.sql — admin e operadores passam a usar senha própria
alter table players
  add column password_hash       text,
  add column setup_code_hash     text,
  add column setup_code_expires  timestamptz;
