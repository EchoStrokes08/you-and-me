-- 012_fotos_duenio.sql
-- Fotos de recuerdos: las ven los dos, pero solo quien la subió (o el admin)
-- la puede reemplazar o borrar. Storage guarda quién subió cada archivo en owner_id.

begin;

drop policy if exists recuerdos_update on storage.objects;
drop policy if exists recuerdos_delete on storage.objects;

create policy recuerdos_update on storage.objects for update to authenticated
  using (bucket_id = 'recuerdos' and (owner_id = auth.uid()::text or public.es_admin()))
  with check (bucket_id = 'recuerdos' and (owner_id = auth.uid()::text or public.es_admin()));

create policy recuerdos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recuerdos' and (owner_id = auth.uid()::text or public.es_admin()));

commit;
