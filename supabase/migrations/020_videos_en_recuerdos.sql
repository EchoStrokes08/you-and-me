-- 020_videos_en_recuerdos.sql
-- Un recuerdo ahora guarda hasta 15 fotos y 5 videos (el tope lo cuida la app).
--   · fotos_recuerdo.tipo distingue 'foto' de 'video'; lo que ya había es 'foto'.
--   · El bucket 'recuerdos' acepta archivos de hasta 50 MB (un video corto de celular).

begin;

alter table public.fotos_recuerdo
  add column if not exists tipo text not null default 'foto' check (tipo in ('foto', 'video'));

update storage.buckets set file_size_limit = 52428800 where id = 'recuerdos';

commit;
