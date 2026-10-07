-- 013_un_dia_como_hoy_canciones.sql
-- "Un día como hoy" (recuerdos de hace 1 mes, 6 meses o N años) y "Nuestras canciones"

begin;

-- ============ UN DÍA COMO HOY ============
-- El recuerdo más significativo de un día como hoy: primero los de años atrás
-- (el más antiguo), luego hace 6 meses y luego hace 1 mes.
-- Restar meses con interval ajusta al final del mes (31 de marzo − 1 mes = 28 de febrero).
create or replace function public.recuerdo_de_hoy()
returns table (id uuid, titulo text, fecha date, hace text)
language sql security definer set search_path = public stable
as $$
  with hoy as (select hoy_bogota() as d)
  select r.id, r.titulo, r.fecha,
         case
           when to_char(r.fecha, 'MM-DD') = to_char(h.d, 'MM-DD') then
             (extract(year from h.d) - extract(year from r.fecha))::int ||
             case when extract(year from h.d) - extract(year from r.fecha) = 1 then ' año' else ' años' end
           when r.fecha = (h.d - interval '6 months')::date then '6 meses'
           else '1 mes'
         end as hace
    from recuerdos r, hoy h
   where r.fecha < h.d
     and (to_char(r.fecha, 'MM-DD') = to_char(h.d, 'MM-DD')
          or r.fecha = (h.d - interval '6 months')::date
          or r.fecha = (h.d - interval '1 month')::date)
   order by case
              when to_char(r.fecha, 'MM-DD') = to_char(h.d, 'MM-DD') then 0
              when r.fecha = (h.d - interval '6 months')::date then 1
              else 2
            end,
            r.fecha
   limit 1;
$$;

revoke execute on function public.recuerdo_de_hoy() from public, anon;
grant execute on function public.recuerdo_de_hoy() to authenticated;

create or replace function public.avisar_un_dia_como_hoy()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  destino uuid;
begin
  select * into r from recuerdo_de_hoy();
  if r.id is null then return; end if;
  for destino in select id from perfiles loop
    perform enviar_push(destino, 'un_dia_como_hoy', '', jsonb_build_object('titulo', r.titulo, 'hace', r.hace));
  end loop;
end;
$$;

revoke execute on function public.avisar_un_dia_como_hoy() from public, anon, authenticated;

-- 9:00 a. m. en Bogotá = 14:00 UTC (una hora después de las fechas especiales)
select cron.schedule('un-dia-como-hoy', '0 14 * * *', 'select public.avisar_un_dia_como_hoy()');

-- ============ NUESTRAS CANCIONES ============
create table if not exists public.canciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  artista text not null default '',
  url text,
  nota text not null default '',
  recuerdo_id uuid references public.recuerdos(id) on delete set null,
  agregada_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.canciones enable row level security;
drop policy if exists canciones_select on public.canciones;
drop policy if exists canciones_insert on public.canciones;
drop policy if exists canciones_update on public.canciones;
drop policy if exists canciones_delete on public.canciones;
create policy canciones_select on public.canciones for select to authenticated using (true);
create policy canciones_insert on public.canciones for insert to authenticated with check (agregada_por = auth.uid());
create policy canciones_update on public.canciones for update to authenticated
  using (agregada_por = auth.uid() or public.es_admin()) with check (agregada_por = auth.uid() or public.es_admin());
create policy canciones_delete on public.canciones for delete to authenticated using (agregada_por = auth.uid() or public.es_admin());

-- Aviso al otro cuando se agrega una canción
create or replace function public.notificar_cancion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
begin
  if actor is null then return null; end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, 'cancion_nueva', (select nombre from perfiles where id = actor),
      jsonb_build_object('titulo', new.titulo, 'artista', new.artista,
                         'recuerdo', (select titulo from recuerdos where id = new.recuerdo_id)));
  end loop;
  return null;
end;
$$;

revoke execute on function public.notificar_cancion() from public, anon, authenticated;

drop trigger if exists notificar_canciones on public.canciones;
create trigger notificar_canciones after insert on public.canciones
  for each row execute function public.notificar_cancion();

commit;
