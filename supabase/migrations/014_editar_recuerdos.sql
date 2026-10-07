-- 014_editar_recuerdos.sql
-- Editar y borrar recuerdos desde la app.
-- Las fotos se guardan en recuerdos/<id del recuerdo>/…; quien creó el recuerdo
-- ahora también puede borrar sus archivos aunque los haya subido el otro
-- (antes solo quien subió cada archivo o el admin). Así borrar un recuerdo
-- completo no deja fotos huérfanas en Storage.

begin;

drop policy if exists recuerdos_delete on storage.objects;

create policy recuerdos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'recuerdos' and (
      owner_id = auth.uid()::text
      or public.es_admin()
      or exists (
        select 1 from public.recuerdos r
        where r.id::text = (storage.foldername(name))[1]
          and r.creado_por = auth.uid()
      )
    )
  );

commit;
