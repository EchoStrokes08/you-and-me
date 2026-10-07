-- 009_cartas.sql — Cartas para abrir después
-- Una carta se abre desde una fecha ("el 30 de marzo") o en un momento
-- ("cuando estés triste"). Quien la recibe no puede leer el contenido antes
-- de tiempo: solo lo obtiene con abrir_carta(), que verifica la fecha.

begin;

create extension if not exists pg_cron;

create or replace function public.hoy_bogota()
returns date
language sql stable
as $$ select (now() at time zone 'America/Bogota')::date $$;

-- ============ TABLA ============
create table if not exists public.cartas (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  contenido text not null,
  emoji text not null default '💌',
  abrir_desde date,
  momento text,
  abierta_en timestamptz,
  aviso_enviado boolean not null default false,
  created_at timestamptz not null default now(),
  check (abrir_desde is not null or momento is not null),
  check (de <> para)
);

alter table public.cartas enable row level security;

-- Quien la escribe la ve, la cambia o la borra mientras no se haya abierto.
-- Quien la recibe NO lee la tabla: usa cartas_recibidas() y abrir_carta().
drop policy if exists cartas_select on public.cartas;
drop policy if exists cartas_insert on public.cartas;
drop policy if exists cartas_update on public.cartas;
drop policy if exists cartas_delete on public.cartas;
create policy cartas_select on public.cartas for select to authenticated using (de = auth.uid());
create policy cartas_insert on public.cartas for insert to authenticated with check (de = auth.uid() and abierta_en is null);
create policy cartas_update on public.cartas for update to authenticated
  using (de = auth.uid() and abierta_en is null) with check (de = auth.uid() and abierta_en is null);
create policy cartas_delete on public.cartas for delete to authenticated using (de = auth.uid() and abierta_en is null);

-- ============ PARA QUIEN LA RECIBE ============
-- Lista sin contenido, salvo las que ya abrió
create or replace function public.cartas_recibidas()
returns table (
  id uuid, de uuid, titulo text, emoji text, abrir_desde date, momento text,
  abierta_en timestamptz, created_at timestamptz, disponible boolean, contenido text
)
language sql security definer set search_path = public stable
as $$
  select c.id, c.de, c.titulo, c.emoji, c.abrir_desde, c.momento, c.abierta_en, c.created_at,
         (c.abrir_desde is null or c.abrir_desde <= hoy_bogota()),
         case when c.abierta_en is not null then c.contenido end
    from cartas c
   where c.para = auth.uid()
   order by c.abierta_en is not null, coalesce(c.abrir_desde, c.created_at::date);
$$;

-- Abre la carta (si ya se puede) y devuelve el contenido
create or replace function public.abrir_carta(p_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_contenido text;
begin
  update cartas
     set abierta_en = coalesce(abierta_en, now())
   where id = p_id
     and para = auth.uid()
     and (abrir_desde is null or abrir_desde <= hoy_bogota())
  returning contenido into v_contenido;

  if v_contenido is null then
    raise exception 'Esta carta todavía no se puede abrir';
  end if;
  return v_contenido;
end;
$$;

revoke execute on function public.cartas_recibidas() from public, anon;
revoke execute on function public.abrir_carta(uuid) from public, anon;
grant execute on function public.cartas_recibidas() to authenticated;
grant execute on function public.abrir_carta(uuid) to authenticated;

-- ============ NOTIFICACIONES ============
-- Envía un aviso a todos los celulares de una persona
create or replace function public.enviar_push(p_destino uuid, p_evento text, p_nombre text, p_datos jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  subs jsonb;
  v_url text;
  v_secreto text;
begin
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

-- Mismo disparador de 008, ahora con cartas y usando enviar_push()
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
  -- Cambios hechos desde el SQL Editor o los scripts no notifican
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
  end if;

  if evento is null then return null; end if;

  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, evento, (select nombre from perfiles where id = actor), datos);
  end loop;
  return null;
end;
$$;

drop trigger if exists notificar_cartas on public.cartas;
create trigger notificar_cartas after insert or update on public.cartas
  for each row execute function public.notificar_pareja();

-- Cada mañana: "ya puedes abrir la carta" para las que se desbloquean
-- (las que ya se podían abrir al escribirlas avisaron al crearse)
create or replace function public.avisar_cartas_disponibles()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c record;
begin
  for c in
    select ca.*, p.nombre as autor
      from cartas ca join perfiles p on p.id = ca.de
     where ca.abrir_desde is not null
       and ca.abrir_desde <= hoy_bogota()
       and ca.abrir_desde > (ca.created_at at time zone 'America/Bogota')::date
       and ca.abierta_en is null
       and not ca.aviso_enviado
  loop
    perform enviar_push(c.para, 'carta_disponible', c.autor, jsonb_build_object('titulo', c.titulo));
    update cartas set aviso_enviado = true where id = c.id;
  end loop;
end;
$$;

revoke execute on function public.avisar_cartas_disponibles() from public, anon, authenticated;

-- 8:00 a. m. en Bogotá = 13:00 UTC
select cron.schedule('avisar-cartas', '0 13 * * *', 'select public.avisar_cartas_disponibles()');

commit;
