-- 011_hall_da_fama.sql — escolhe quais categorias aparecem no Hall da fama (esconder não apaga os troféus)
alter table poll_categories add column hall_visible boolean not null default true;
update poll_categories set hall_visible = false where kind = 'team'; -- categorias de times começam ocultas
