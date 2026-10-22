-- 038_archivos_externos.sql — Fotos, videos y audios en otro almacenamiento (compatible con S3: R2, Firebase/GCS…)
-- Los archivos se mueven fuera de Supabase, pero quién puede ver, subir o borrar cada uno se sigue decidiendo
-- aquí, con las mismas reglas que tenían en storage.objects. api/archivos.ts solo firma enlaces de lo que
-- estas reglas dejan ver a quien pregunta.
--
-- archivos_externos       un archivo que ya está en el almacenamiento externo (verificado al copiarlo)
-- configuracion.archivos_en  dónde se suben los nuevos: 'supabase' (antes de migrar) o 'externo'
-- El catálogo (bucket público "catalogo") se queda en Supabase: son pocas imágenes del admin y sus enlaces
-- públicos están guardados en las tablas.

begin;

create table if not exists public.archivos_externos (
  bucket text not null check (bucket in ('recuerdos', 'adjuntos')),
  ruta text not null check (char_length(ruta) between 3 and 512),
  owner uuid default auth.uid() references auth.users(id) on delete set null,
  bytes bigint,
  tipo text,
  created_at timestamptz not null default now(),
  primary key (bucket, ruta)
);

alter table public.archivos_externos enable row level security;
drop policy if exists archivos_ext_select on public.archivos_externos;
drop policy if exists archivos_ext_insert on public.archivos_externos;
drop policy if exists archivos_ext_delete on public.archivos_externos;

-- Las mismas de storage.objects (001, 012, 014 y 015)
create policy archivos_ext_select on public.archivos_externos for select to authenticated using (
  bucket = 'recuerdos'
  or (bucket = 'adjuntos' and (owner = auth.uid() or public.puede_ver_adjunto(ruta)))
);
create policy archivos_ext_insert on public.archivos_externos for insert to authenticated with check (
  owner = auth.uid() and (
    bucket = 'recuerdos'
    or (bucket = 'adjuntos' and split_part(ruta, '/', 1) in ('pensamientos', 'cartas', 'capsulas'))
  )
);
create policy archivos_ext_delete on public.archivos_externos for delete to authenticated using (
  (bucket = 'recuerdos' and (
    owner = auth.uid() or public.es_admin()
    or exists (select 1 from public.recuerdos r where r.id::text = split_part(ruta, '/', 1) and r.creado_por = auth.uid())
  ))
  or (bucket = 'adjuntos' and owner = auth.uid())
);

alter table public.configuracion add column if not exists archivos_en text not null default 'supabase'
  check (archivos_en in ('supabase', 'externo'));

-- Para la migración (solo el servidor, con la llave de servicio): lo que falta copiar y lo que ya se puede borrar de Supabase
create or replace function public.archivos_por_mover(p_limite int default 20)
returns table (bucket text, ruta text, owner uuid, bytes bigint, tipo text)
language sql security definer set search_path = public, storage stable
as $$
  select o.bucket_id, o.name, case when o.owner_id ~ '^[0-9a-f-]{36}$' then o.owner_id::uuid end,
         (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    from storage.objects o
   where o.bucket_id in ('recuerdos', 'adjuntos')
     and not exists (select 1 from archivos_externos e where e.bucket = o.bucket_id and e.ruta = o.name)
   order by o.created_at
   limit p_limite;
$$;

create or replace function public.archivos_por_liberar(p_limite int default 100)
returns table (bucket text, ruta text)
language sql security definer set search_path = public, storage stable
as $$
  select o.bucket_id, o.name from storage.objects o
    join archivos_externos e on e.bucket = o.bucket_id and e.ruta = o.name
   where o.bucket_id in ('recuerdos', 'adjuntos')
   limit p_limite;
$$;

create or replace function public.estado_migracion()
returns jsonb
language sql security definer set search_path = public, storage stable
as $$
  select jsonb_build_object(
    'por_mover', (select count(*) from storage.objects o where o.bucket_id in ('recuerdos', 'adjuntos')
                   and not exists (select 1 from archivos_externos e where e.bucket = o.bucket_id and e.ruta = o.name)),
    'por_mover_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o where o.bucket_id in ('recuerdos', 'adjuntos')
                   and not exists (select 1 from archivos_externos e where e.bucket = o.bucket_id and e.ruta = o.name)),
    'movidos', (select count(*) from archivos_externos),
    'movidos_bytes', (select coalesce(sum(bytes), 0) from archivos_externos),
    'por_liberar', (select count(*) from storage.objects o join archivos_externos e on e.bucket = o.bucket_id and e.ruta = o.name),
    'archivos_en', (select archivos_en from configuracion where id = 1)
  );
$$;

revoke execute on function public.archivos_por_mover(int) from public, anon, authenticated;
revoke execute on function public.archivos_por_liberar(int) from public, anon, authenticated;
revoke execute on function public.estado_migracion() from public, anon, authenticated;
grant execute on function public.archivos_por_mover(int) to service_role;
grant execute on function public.archivos_por_liberar(int) to service_role;
grant execute on function public.estado_migracion() to service_role;

-- El panel de espacio también cuenta lo que ya está afuera
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
    ), '[]'::jsonb),
    'externo', jsonb_build_object(
      'archivos', (select count(*) from archivos_externos),
      'bytes', (select coalesce(sum(bytes), 0) from archivos_externos)
    ),
    'archivos_en', (select archivos_en from configuracion where id = 1)
  );
end;
$$;

commit;
