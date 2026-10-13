-- 026_por_conocer_favoritas_avisos.sql
-- 1) Una cita confirmada que ya pasó la puede marcar como vivida cualquiera de los dos
-- 2) Las notas de un recuerdo ("Lo mejor para mí") se pueden borrar
-- 3) Lugares por conocer: pines de "queremos ir" en el mapa
-- 4) Fotos favoritas
-- 5) Regalos con ocasión, y el aviso de "en 3 días es el cumpleaños" cuenta lo que hay en su lista
-- 6) Cada uno escoge qué avisos recibe (por grupos)
-- 7) El ánimo del otro llega en vivo al inicio

begin;

-- ============ 1) CITA VIVIDA ============
-- Hasta ahora solo el admin podía pasarla a 'vivida': a ella le fallaba al guardar el recuerdo
-- de una cita que había creado. Solo aplica a citas confirmadas cuyo día ya llegó.
drop policy if exists citas_vivida on public.citas;
create policy citas_vivida on public.citas for update to authenticated
  using (estado = 'confirmada' and fecha <= public.hoy_bogota())
  with check (estado = 'vivida' and fecha <= public.hoy_bogota());

-- ============ 2) NOTAS DE RECUERDO ============
drop policy if exists notas_delete on public.notas_recuerdo;
create policy notas_delete on public.notas_recuerdo for delete to authenticated using (usuario_id = auth.uid());

-- ============ 3) LUGARES POR CONOCER ============
-- Son de los dos: cualquiera agrega, corrige o quita. Cuando ya hay una cita o un recuerdo
-- en ese mismo punto, la app deja de mostrarlo como pendiente (no hace falta marcarlo).
create table if not exists public.lugares_por_conocer (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 80),
  direccion text not null default '',
  lat double precision not null,
  lng double precision not null,
  nota text not null default '' check (char_length(nota) <= 200),
  creado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.lugares_por_conocer enable row level security;
drop policy if exists por_conocer_select on public.lugares_por_conocer;
drop policy if exists por_conocer_insert on public.lugares_por_conocer;
drop policy if exists por_conocer_update on public.lugares_por_conocer;
drop policy if exists por_conocer_delete on public.lugares_por_conocer;
create policy por_conocer_select on public.lugares_por_conocer for select to authenticated using (true);
create policy por_conocer_insert on public.lugares_por_conocer for insert to authenticated with check (creado_por = auth.uid());
create policy por_conocer_update on public.lugares_por_conocer for update to authenticated using (true) with check (true);
create policy por_conocer_delete on public.lugares_por_conocer for delete to authenticated using (true);

-- Aviso al otro cuando se agrega un lugar por conocer
create or replace function public.notificar_por_conocer()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
begin
  if actor is null then return null; end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, 'lugar_por_conocer', (select nombre from perfiles where id = actor),
      jsonb_build_object('nombre', new.nombre, 'nota', new.nota));
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_por_conocer() from public, anon, authenticated;

drop trigger if exists notificar_por_conocer on public.lugares_por_conocer;
create trigger notificar_por_conocer after insert on public.lugares_por_conocer
  for each row execute function public.notificar_por_conocer();

-- ============ 4) FOTOS FAVORITAS ============
alter table public.fotos_recuerdo add column if not exists favorita boolean not null default false;

-- Con función y no con una política de update: así solo se puede tocar el corazón,
-- no la ruta ni el recuerdo al que pertenece la foto
create or replace function public.marcar_favorita(p_id uuid, p_favorita boolean)
returns void
language sql security definer set search_path = public
as $$
  update fotos_recuerdo set favorita = p_favorita where id = p_id;
$$;
revoke execute on function public.marcar_favorita(uuid, boolean) from public, anon;
grant execute on function public.marcar_favorita(uuid, boolean) to authenticated;

-- ============ 5) REGALOS CON OCASIÓN ============
alter table public.regalos add column if not exists ocasion text check (ocasion is null or char_length(ocasion) <= 40);

-- Igual que en 010, pero el aviso de "en 3 días es el cumpleaños" dice cuántos deseos
-- tiene en su lista que el otro aún no ha comprado, y cuál es el que más quiere
create or replace function public.avisar_fechas_especiales()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cfg record;
  hoy date := hoy_bogota();
  meses int;
  ultimo_dia int := extract(day from (date_trunc('month', hoy) + interval '1 month - 1 day'))::int;
  admin_id uuid;
  pareja_id uuid;
  cumple record;
  destino uuid;
  v_pendientes int;
  v_deseo text;
begin
  select * into cfg from configuracion where id = 1;
  select id into admin_id from perfiles where rol = 'admin' limit 1;
  select id into pareja_id from perfiles where rol = 'pareja' limit 1;

  -- Mesiversario: mismo día del mes que la fecha de inicio
  -- (si el mes es más corto, el último día del mes)
  if cfg.fecha_inicio is not null and hoy > cfg.fecha_inicio
     and extract(day from hoy)::int = least(extract(day from cfg.fecha_inicio)::int, ultimo_dia) then
    meses := (extract(year from age(hoy, cfg.fecha_inicio)) * 12 + extract(month from age(hoy, cfg.fecha_inicio)))::int;
    -- age() da un mes menos cuando el día se ajustó al final del mes
    if extract(day from age(hoy, cfg.fecha_inicio)) > 0 then meses := meses + 1; end if;
    for destino in select id from perfiles loop
      perform enviar_push(destino, 'mesiversario', '', jsonb_build_object('meses', meses));
    end loop;
  end if;

  -- Cumpleaños: hoy y 3 días antes (este último solo al otro, para el regalo)
  for cumple in
    select cfg.cumple_ella as fecha, cfg.nombre_ella as nombre, pareja_id as dueno, admin_id as otro
    union all
    select cfg.cumple_el, cfg.nombre_el, admin_id, pareja_id
  loop
    continue when cumple.fecha is null or cumple.dueno is null;
    if to_char(hoy, 'MM-DD') = to_char(cumple.fecha, 'MM-DD') then
      perform enviar_push(cumple.dueno, 'cumple_tuyo', cumple.nombre, '{}'::jsonb);
      perform enviar_push(cumple.otro, 'cumple_pareja', cumple.nombre, '{}'::jsonb);
    elsif to_char(hoy + 3, 'MM-DD') = to_char(cumple.fecha, 'MM-DD') then
      -- Lo que pidió y nadie ha marcado como comprado; primero lo de cumpleaños y lo que más quiere
      select count(*) into v_pendientes
        from regalos g
       where g.de = cumple.dueno and not exists (select 1 from regalos_comprados c where c.regalo_id = g.id);
      select g.nombre into v_deseo
        from regalos g
       where g.de = cumple.dueno and not exists (select 1 from regalos_comprados c where c.regalo_id = g.id)
       order by (g.ocasion = 'cumpleaños') desc nulls last, g.me_encanta desc, g.created_at desc
       limit 1;
      perform enviar_push(cumple.otro, 'cumple_pronto', cumple.nombre,
        jsonb_build_object('pendientes', v_pendientes, 'deseo', v_deseo));
    end if;
  end loop;
end;
$$;
revoke execute on function public.avisar_fechas_especiales() from public, anon, authenticated;

-- ============ 6) ESCOGER QUÉ AVISOS RECIBIR ============
-- Grupos silenciados por cada persona (vale para todos sus celulares)
alter table public.perfiles add column if not exists avisos_silenciados text[] not null default '{}';

-- A qué grupo pertenece cada aviso. Los de citas y el de la copia no tienen grupo: siempre llegan.
-- Los mismos grupos que en src/components/AjustesAvisos.tsx
create or replace function public.grupo_aviso(p_evento text)
returns text
language sql immutable
as $$
  select case
    when p_evento in ('respuesta', 'reaccion_respuesta', 'racha') then 'pregunta'
    when p_evento = 'pienso_en_ti' then 'pienso'
    when p_evento = 'animo' then 'animo'
    when p_evento in ('recuerdo', 'nota', 'un_dia_como_hoy', 'cancion_nueva') then 'recuerdos'
    when p_evento in ('sueno_nuevo', 'sueno_cumplido', 'regalo_nuevo', 'lugar_por_conocer') then 'juntos'
    when p_evento in ('carta_nueva', 'carta_disponible', 'carta_abierta', 'capsula_nueva', 'capsula_item', 'capsula_abierta') then 'cartas'
    when p_evento in ('mesiversario', 'cumple_tuyo', 'cumple_pareja', 'cumple_pronto') then 'fechas'
  end;
$$;

-- Igual que en 009, pero no envía lo que esa persona silenció
create or replace function public.enviar_push(p_destino uuid, p_evento text, p_nombre text, p_datos jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  subs jsonb;
  v_url text;
  v_secreto text;
begin
  if exists (select 1 from perfiles where id = p_destino and grupo_aviso(p_evento) = any(avisos_silenciados)) then return; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint,
           'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth),
           'rol', p.rol)), '[]'::jsonb)
    into subs
    from suscripciones_push s
    left join perfiles p on p.id = s.usuario_id
   where s.usuario_id = p_destino;

  if jsonb_array_length(subs) = 0 then return; end if;

  select valor into v_url from privado.ajustes where clave = 'notif_url';
  select valor into v_secreto from privado.ajustes where clave = 'notif_secreto';
  if v_url is null or v_secreto is null then return; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('evento', p_evento, 'nombre', p_nombre, 'datos', p_datos, 'subs', subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-secreto', v_secreto)
  );
end;
$$;
revoke execute on function public.enviar_push(uuid, text, text, jsonb) from public, anon, authenticated;

-- ============ 7) ÁNIMO EN VIVO ============
do $$ begin
  alter publication supabase_realtime add table public.estados_animo;
exception when others then null; end $$;

commit;
