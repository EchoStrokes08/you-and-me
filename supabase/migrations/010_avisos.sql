-- 010_avisos.sql — "Pienso en ti", recordatorios de cita y fechas especiales

begin;

-- ============ PIENSO EN TI ============
create table if not exists public.pensamientos (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pensamientos enable row level security;
drop policy if exists pensamientos_select on public.pensamientos;
drop policy if exists pensamientos_insert on public.pensamientos;
create policy pensamientos_select on public.pensamientos for select to authenticated using (true);
create policy pensamientos_insert on public.pensamientos for insert to authenticated with check (de = auth.uid());

-- Máximo uno cada 10 segundos (que un toque repetido no mande 20 notificaciones)
create or replace function public.limitar_pensamientos()
returns trigger
language plpgsql
as $$
begin
  if exists(select 1 from public.pensamientos where de = new.de and created_at > now() - interval '10 seconds') then
    raise exception 'Espera un momentico 💚';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_pensamientos on public.pensamientos;
create trigger trg_limitar_pensamientos before insert on public.pensamientos
  for each row execute function public.limitar_pensamientos();

-- ============ CUMPLEAÑOS ============
alter table public.configuracion add column if not exists cumple_ella date;
alter table public.configuracion add column if not exists cumple_el date;

-- ============ RECORDATORIOS DE CITA ============
alter table public.citas add column if not exists recordatorio_noche boolean not null default false;
alter table public.citas add column if not exists recordatorio_hoy boolean not null default false;

-- Si cambian el día o la hora, los recordatorios se vuelven a enviar
create or replace function public.reiniciar_recordatorios()
returns trigger
language plpgsql
as $$
begin
  if new.fecha is distinct from old.fecha or new.hora_confirmada is distinct from old.hora_confirmada then
    new.recordatorio_noche := false;
    new.recordatorio_hoy := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reiniciar_recordatorios on public.citas;
create trigger trg_reiniciar_recordatorios before update on public.citas
  for each row execute function public.reiniciar_recordatorios();

-- ============ DISPARADOR (se agrega "pienso en ti") ============
create or replace function public.notificar_pareja()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  evento text;
  datos jsonb := '{}';
  destino uuid;
begin
  -- Cambios hechos desde el SQL Editor, los scripts o pg_cron no notifican
  if actor is null then return null; end if;

  if tg_table_name = 'citas' then
    if tg_op = 'INSERT' then
      evento := 'cita_nueva';
    elsif new.estado is distinct from old.estado then
      evento := case new.estado
        when 'confirmada' then 'cita_confirmada'
        when 'cancelada' then 'cita_cancelada'
        when 'pendiente' then 'cita_editada'
      end;
    elsif new.modificada and not old.modificada then
      evento := 'cita_editada';
    end if;
    if evento is not null then
      datos := jsonb_build_object(
        'fecha', new.fecha,
        'hora', new.hora_confirmada,
        'sorpresa', new.es_cita_sorpresa,
        'lugar', coalesce((select nombre from lugares where id = new.lugar_id), new.lugar_personalizado)
      );
    end if;
  elsif tg_table_name = 'respuestas' then
    evento := 'respuesta';
    datos := jsonb_build_object(
      'ya_respondio', exists(select 1 from respuestas where pregunta_id = new.pregunta_id and usuario_id <> actor)
    );
  elsif tg_table_name = 'recuerdos' then
    evento := 'recuerdo';
    datos := jsonb_build_object('titulo', new.titulo);
  elsif tg_table_name = 'notas_recuerdo' then
    evento := 'nota';
    datos := jsonb_build_object('titulo', (select titulo from recuerdos where id = new.recuerdo_id));
  elsif tg_table_name = 'cartas' then
    if tg_op = 'INSERT' then
      evento := 'carta_nueva';
    elsif new.abierta_en is not null and old.abierta_en is null then
      evento := 'carta_abierta';
    end if;
    datos := jsonb_build_object(
      'titulo', new.titulo,
      'abrir_desde', new.abrir_desde,
      'momento', new.momento,
      'disponible', new.abrir_desde is null or new.abrir_desde <= hoy_bogota()
    );
  elsif tg_table_name = 'pensamientos' then
    evento := 'pienso_en_ti';
  end if;

  if evento is null then return null; end if;

  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, evento, (select nombre from perfiles where id = actor), datos);
  end loop;
  return null;
end;
$$;

drop trigger if exists notificar_pensamientos on public.pensamientos;
create trigger notificar_pensamientos after insert on public.pensamientos
  for each row execute function public.notificar_pareja();

-- ============ RECORDATORIOS (cada 15 min) ============
-- · La noche anterior desde las 8 p. m.
-- · El mismo día: 3 horas antes si hay hora confirmada; si no, desde las 9 a. m.
create or replace function public.recordar_citas()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ahora time := (now() at time zone 'America/Bogota')::time;
  c record;
  datos jsonb;
  destino uuid;
  cuando text;
begin
  for c in
    select ci.*,
           coalesce(l.nombre, ci.lugar_personalizado) as lugar,
           a.nombre as actividad,
           f.nombre as franja,
           v.nombre as vestimenta,
           (select coalesce(jsonb_agg(o.nombre), '[]'::jsonb)
              from cita_detalles cd join opciones_llevar o on o.id = cd.opcion_id
             where cd.cita_id = ci.id) as detalles
      from citas ci
      left join lugares l on l.id = ci.lugar_id
      left join actividades a on a.id = ci.actividad_id
      left join franjas f on f.id = ci.franja_id
      left join opciones_llevar v on v.id = ci.vestimenta_id
     where ci.estado = 'confirmada'
       and (
         (ci.fecha = hoy_bogota() + 1 and not ci.recordatorio_noche and ahora >= '20:00')
         or (ci.fecha = hoy_bogota() and not ci.recordatorio_hoy and (
               (ci.hora_confirmada is not null and ahora >= ci.hora_confirmada - interval '3 hours')
            or (ci.hora_confirmada is null and ahora >= '09:00')))
       )
  loop
    cuando := case when c.fecha = hoy_bogota() then 'hoy' else 'manana' end;
    datos := jsonb_build_object(
      'cuando', cuando,
      'hora', c.hora_confirmada,
      'franja', c.franja,
      -- /api/notificar oculta lugar y actividad a ella si es sorpresa
      'lugar', c.lugar,
      'actividad', c.actividad,
      'sorpresa', c.es_cita_sorpresa,
      'vestimenta', c.vestimenta,
      'detalles', c.detalles
    );
    for destino in select id from perfiles loop
      perform enviar_push(destino, 'recordatorio_cita', '', datos);
    end loop;
    if cuando = 'hoy' then
      update citas set recordatorio_hoy = true, recordatorio_noche = true where id = c.id;
    else
      update citas set recordatorio_noche = true where id = c.id;
    end if;
  end loop;
end;
$$;

-- ============ FECHAS ESPECIALES (8 a. m.) ============
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
      perform enviar_push(cumple.otro, 'cumple_pronto', cumple.nombre, '{}'::jsonb);
    end if;
  end loop;
end;
$$;

revoke execute on function public.recordar_citas() from public, anon, authenticated;
revoke execute on function public.avisar_fechas_especiales() from public, anon, authenticated;

select cron.schedule('recordar-citas', '*/15 * * * *', 'select public.recordar_citas()');
-- 8:00 a. m. en Bogotá = 13:00 UTC
select cron.schedule('fechas-especiales', '0 13 * * *', 'select public.avisar_fechas_especiales()');

commit;
