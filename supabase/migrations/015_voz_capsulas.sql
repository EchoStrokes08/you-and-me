-- 015_voz_capsulas.sql
-- 1) Notas de voz en "Pienso en ti" y en las cartas
-- 2) Cápsulas del tiempo: los dos guardan textos, fotos y audios que nadie
--    (ni el otro ni uno mismo, salvo lo propio) puede ver hasta la fecha de apertura
-- Los archivos van en el bucket privado "adjuntos":
--   pensamientos/<usuario>/…   cartas/<carta>/…   capsulas/<cápsula>/…

begin;

-- ============ BUCKET ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 15728640) -- 15 MB
on conflict (id) do nothing;

-- ============ NOTAS DE VOZ ============
alter table public.pensamientos add column if not exists audio text;
alter table public.pensamientos add column if not exists duracion int;
alter table public.cartas add column if not exists audio text;

-- cartas_recibidas ahora también devuelve el audio, pero solo de las cartas ya abiertas
drop function if exists public.cartas_recibidas();
create function public.cartas_recibidas()
returns table (
  id uuid, de uuid, titulo text, emoji text, abrir_desde date, momento text,
  abierta_en timestamptz, created_at timestamptz, disponible boolean, contenido text, audio text
)
language sql security definer set search_path = public stable
as $$
  select c.id, c.de, c.titulo, c.emoji, c.abrir_desde, c.momento, c.abierta_en, c.created_at,
         (c.abrir_desde is null or c.abrir_desde <= hoy_bogota()),
         case when c.abierta_en is not null then c.contenido end,
         case when c.abierta_en is not null then c.audio end
    from cartas c
   where c.para = auth.uid()
   order by c.abierta_en is not null, coalesce(c.abrir_desde, c.created_at::date);
$$;
revoke execute on function public.cartas_recibidas() from public, anon;
grant execute on function public.cartas_recibidas() to authenticated;

-- ============ CÁPSULAS DEL TIEMPO ============
create table if not exists public.capsulas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  emoji text not null default '⏳',
  abrir_en date not null,
  creada_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  aviso_enviado boolean not null default false
);

create table if not exists public.capsula_items (
  id uuid primary key default gen_random_uuid(),
  capsula_id uuid not null references public.capsulas(id) on delete cascade,
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('texto', 'foto', 'audio')),
  texto text,
  ruta text,
  created_at timestamptz not null default now(),
  check ((tipo = 'texto' and texto is not null) or (tipo <> 'texto' and ruta is not null))
);

-- Funciones security definer: las políticas no deben depender del RLS de otras tablas
create or replace function public.capsula_abierta(p_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from capsulas where id = p_id and abrir_en <= hoy_bogota());
$$;

create or replace function public.capsula_sellada(p_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from capsulas where id = p_id and abrir_en > hoy_bogota());
$$;

alter table public.capsulas enable row level security;
alter table public.capsula_items enable row level security;

drop policy if exists capsulas_select on public.capsulas;
drop policy if exists capsulas_insert on public.capsulas;
drop policy if exists capsulas_update on public.capsulas;
drop policy if exists capsulas_delete on public.capsulas;
create policy capsulas_select on public.capsulas for select to authenticated using (true);
create policy capsulas_insert on public.capsulas for insert to authenticated
  with check (creada_por = auth.uid() and abrir_en > hoy_bogota());
-- Quien la creó puede cambiar el nombre o la fecha mientras siga sellada (sin adelantarla a hoy)
create policy capsulas_update on public.capsulas for update to authenticated
  using (creada_por = auth.uid() and abrir_en > hoy_bogota())
  with check (creada_por = auth.uid() and abrir_en > hoy_bogota());
-- Y borrarla solo si el otro todavía no ha guardado nada
create or replace function public.capsula_tiene_ajenos(p_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from capsula_items where capsula_id = p_id and de <> auth.uid());
$$;
create policy capsulas_delete on public.capsulas for delete to authenticated
  using (creada_por = auth.uid() and abrir_en > hoy_bogota() and not public.capsula_tiene_ajenos(capsulas.id));

drop policy if exists capsula_items_select on public.capsula_items;
drop policy if exists capsula_items_insert on public.capsula_items;
drop policy if exists capsula_items_delete on public.capsula_items;
create policy capsula_items_select on public.capsula_items for select to authenticated
  using (de = auth.uid() or public.capsula_abierta(capsula_id));
create policy capsula_items_insert on public.capsula_items for insert to authenticated
  with check (de = auth.uid() and public.capsula_sellada(capsula_id));
create policy capsula_items_delete on public.capsula_items for delete to authenticated
  using (de = auth.uid() and public.capsula_sellada(capsula_id));

-- Cuántas cosas guardó cada uno, sin mostrar cuáles
create or replace function public.capsulas_conteo()
returns table (capsula_id uuid, de uuid, cantidad int)
language sql security definer set search_path = public stable
as $$
  select capsula_id, de, count(*)::int from capsula_items group by capsula_id, de;
$$;
revoke execute on function public.capsulas_conteo() from public, anon;
grant execute on function public.capsulas_conteo() to authenticated;

-- ============ STORAGE "adjuntos" ============
create or replace function public.puede_ver_adjunto(p_ruta text)
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  partes text[] := string_to_array(p_ruta, '/');
begin
  if partes[1] = 'pensamientos' then
    return true;
  elsif partes[1] = 'cartas' then
    return exists(select 1 from cartas c where c.id::text = partes[2]
                  and (c.de = auth.uid() or (c.para = auth.uid() and c.abierta_en is not null)));
  elsif partes[1] = 'capsulas' then
    return exists(select 1 from capsulas k where k.id::text = partes[2] and k.abrir_en <= hoy_bogota());
  end if;
  return false;
end;
$$;
grant execute on function public.puede_ver_adjunto(text) to authenticated;

drop policy if exists adjuntos_read on storage.objects;
drop policy if exists adjuntos_write on storage.objects;
drop policy if exists adjuntos_delete on storage.objects;
create policy adjuntos_read on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (owner_id = auth.uid()::text or public.puede_ver_adjunto(name)));
create policy adjuntos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and (storage.foldername(name))[1] in ('pensamientos', 'cartas', 'capsulas'));
create policy adjuntos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and owner_id = auth.uid()::text);

-- ============ AVISOS ============
-- Pienso en ti: ahora dice si trae nota de voz
create or replace function public.notificar_pensamiento()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
begin
  if actor is null then return null; end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, 'pienso_en_ti', (select nombre from perfiles where id = actor),
      jsonb_build_object('audio', new.audio is not null));
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_pensamiento() from public, anon, authenticated;

drop trigger if exists notificar_pensamientos on public.pensamientos;
create trigger notificar_pensamientos after insert on public.pensamientos
  for each row execute function public.notificar_pensamiento();

-- Cápsulas: nueva cápsula, y la primera cosa que alguien guarda en el día
create or replace function public.notificar_capsula()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
  evento text;
  datos jsonb;
begin
  if actor is null then return null; end if;
  if tg_table_name = 'capsulas' then
    evento := 'capsula_nueva';
    datos := jsonb_build_object('titulo', new.titulo, 'emoji', new.emoji, 'fecha', new.abrir_en);
  else
    if exists(select 1 from capsula_items where capsula_id = new.capsula_id and de = actor and id <> new.id
              and (created_at at time zone 'America/Bogota')::date = hoy_bogota()) then
      return null;
    end if;
    evento := 'capsula_item';
    select jsonb_build_object('titulo', k.titulo, 'emoji', k.emoji, 'fecha', k.abrir_en) into datos
      from capsulas k where k.id = new.capsula_id;
  end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, evento, (select nombre from perfiles where id = actor), datos);
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_capsula() from public, anon, authenticated;

drop trigger if exists notificar_capsulas on public.capsulas;
create trigger notificar_capsulas after insert on public.capsulas
  for each row execute function public.notificar_capsula();
drop trigger if exists notificar_capsula_items on public.capsula_items;
create trigger notificar_capsula_items after insert on public.capsula_items
  for each row execute function public.notificar_capsula();

-- Cada mañana: "hoy se abre la cápsula" a los dos
create or replace function public.avisar_capsulas_abiertas()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  k record;
  destino uuid;
begin
  for k in select * from capsulas where abrir_en <= hoy_bogota() and not aviso_enviado loop
    for destino in select id from perfiles loop
      perform enviar_push(destino, 'capsula_abierta', '', jsonb_build_object('titulo', k.titulo, 'emoji', k.emoji, 'creada', k.created_at::date));
    end loop;
    update capsulas set aviso_enviado = true where id = k.id;
  end loop;
end;
$$;
revoke execute on function public.avisar_capsulas_abiertas() from public, anon, authenticated;

-- 8:00 a. m. en Bogotá = 13:00 UTC
select cron.schedule('avisar-capsulas', '0 13 * * *', 'select public.avisar_capsulas_abiertas()');

-- Realtime para que el contador de la cápsula se actualice solo
do $$ begin
  alter publication supabase_realtime add table public.capsulas;
exception when others then null; end $$;

commit;
