-- 006_conteudo.sql — textos da tela inicial (informações, links e regras), editados pelo admin
create table site_content (
  slug       text primary key check (slug in ('informacoes', 'links', 'regras')),
  body       text not null default '' check (length(body) <= 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references players(id)
);
