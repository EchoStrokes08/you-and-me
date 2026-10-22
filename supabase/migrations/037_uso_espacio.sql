-- 037_uso_espacio.sql — Cuánto ocupa la app (para el aviso de espacio del panel)
-- Los archivos viven en storage.objects, que la app no puede leer directo: esta función solo le da al admin
-- los totales y los archivos más pesados (rutas y tamaños, nunca el contenido).

begin;

create or replace function public.uso_espacio()
returns jsonb
language plpgsql security definer set search_path = public, storage stable
as $$
begin
  if not es_admin() then raise exception 'Solo el admin puede ver el espacio'; end if;
  return jsonb_build_object(
    'base', pg_database_size(current_database()),
    'carpetas', coalesce((
      select jsonb_agg(jsonb_build_object('carpeta', bucket_id, 'archivos', n, 'bytes', b) order by b desc)
        from (select bucket_id, count(*) n, coalesce(sum((metadata->>'size')::bigint), 0) b from storage.objects group by bucket_id) x
    ), '[]'::jsonb),
    'pesados', coalesce((
      select jsonb_agg(jsonb_build_object('carpeta', bucket_id, 'ruta', name, 'bytes', b, 'fecha', created_at) order by b desc)
        from (select bucket_id, name, (metadata->>'size')::bigint b, created_at from storage.objects
               where metadata ? 'size' order by (metadata->>'size')::bigint desc limit 5) y
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.uso_espacio() from public, anon;
grant execute on function public.uso_espacio() to authenticated;

commit;
