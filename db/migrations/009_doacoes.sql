-- 009_doacoes.sql — caixa de doações (Pix) com configurações e histórico de entradas e saídas
create table donation_settings (
  id            smallint primary key default 1 check (id = 1),
  enabled       boolean not null default false,
  pix_key       text,
  holder_name   text,
  city          text,
  default_cents integer check (default_cents is null or default_cents between 100 and 500000),
  updated_at    timestamptz not null default now()
);
insert into donation_settings (id) values (1) on conflict do nothing;

create table donation_entries (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('in', 'out')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  description  text not null default '',
  entry_date   date not null default ((now() at time zone 'America/Maceio')::date),
  created_by   uuid references players(id),
  created_at   timestamptz not null default now()
);

-- Caixa que já existia (R$ 55,99)
insert into donation_entries (kind, amount_cents, description) values ('in', 5599, 'Saldo inicial do caixa');
