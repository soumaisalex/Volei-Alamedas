-- 010_transmissao.sql — link da transmissão (live/gravação) de cada evento
alter table events add column stream_url text check (stream_url is null or length(stream_url) <= 300);
