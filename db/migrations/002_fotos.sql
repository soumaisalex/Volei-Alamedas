-- 002_fotos.sql — fotos de perfil (JPEG já reduzido no celular, ~20-40 KB cada)
create table player_photos (
  player_id    uuid primary key references players(id) on delete cascade,
  content_type text not null default 'image/jpeg',
  data         bytea not null check (octet_length(data) <= 262144),
  updated_at   timestamptz not null default now()
);
