-- 008_notificaciones.sql — Notificaciones push
-- Cuando uno hace algo (propone/confirma/cambia una cita, responde la pregunta,
-- guarda un recuerdo o deja una nota) la base de datos avisa a /api/notificar
-- en Vercel, que le manda la notificación al celular del otro.
--
-- La URL y el secreto de /api/notificar se guardan con: npm run db:notificaciones

begin;

create extension if not exists pg_net;

-- ============ SUSCRIPCIONES ============
-- Un registro por celular/navegador donde se activaron las notificaciones.
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.suscripciones_push enable row level security;

drop policy if exists suscripciones_select on public.suscripciones_push;
drop policy if exists suscripciones_insert on public.suscripciones_push;
drop policy if exists suscripciones_update on public.suscripciones_push;
drop policy if exists suscripciones_delete on public.suscripciones_push;
create policy suscripciones_select on public.suscripciones_push for select to authenticated using (usuario_id = auth.uid());
create policy suscripciones_insert on public.suscripciones_push for insert to authenticated with check (usuario_id = auth.uid());
create policy suscripciones_update on public.suscripciones_push for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy suscripciones_delete on public.suscripciones_push for delete to authenticated using (usuario_id = auth.uid());

-- ============ AJUSTES PRIVADOS ============
-- Esquema fuera de la API: ni la app ni la anon key lo pueden leer.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.ajustes (
  clave text primary key,
  valor text not null
);

-- ============ DISPARADOR ============
create or replace function public.notificar_pareja()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  evento text;
  datos jsonb := '{}';
  subs jsonb;
  v_url text;
  v_secreto text;
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
  end if;

  if evento is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint,
           'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth),
           'rol', p.rol)), '[]'::jsonb)
    into subs
    from suscripciones_push s
    left join perfiles p on p.id = s.usuario_id
   where s.usuario_id <> actor;

  if jsonb_array_length(subs) = 0 then return null; end if;

  select valor into v_url from privado.ajustes where clave = 'notif_url';
  select valor into v_secreto from privado.ajustes where clave = 'notif_secreto';
  if v_url is null or v_secreto is null then return null; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'evento', evento,
      'nombre', (select nombre from perfiles where id = actor),
      'datos', datos,
      'subs', subs
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-secreto', v_secreto)
  );
  return null;
end;
$$;

revoke execute on function public.notificar_pareja() from public, anon, authenticated;

drop trigger if exists notificar_citas on public.citas;
create trigger notificar_citas after insert or update on public.citas
  for each row execute function public.notificar_pareja();

drop trigger if exists notificar_respuestas on public.respuestas;
create trigger notificar_respuestas after insert on public.respuestas
  for each row execute function public.notificar_pareja();

drop trigger if exists notificar_recuerdos on public.recuerdos;
create trigger notificar_recuerdos after insert on public.recuerdos
  for each row execute function public.notificar_pareja();

drop trigger if exists notificar_notas on public.notas_recuerdo;
create trigger notificar_notas after insert on public.notas_recuerdo
  for each row execute function public.notificar_pareja();

-- ============ LIMPIEZA ============
-- /api/notificar borra los celulares que ya no aceptan notificaciones
-- (app desinstalada, permiso quitado). Exige el mismo secreto.
create or replace function public.borrar_suscripciones_vencidas(p_endpoints text[], p_secreto text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_secreto is distinct from (select valor from privado.ajustes where clave = 'notif_secreto') then
    raise exception 'No autorizado';
  end if;
  delete from suscripciones_push where endpoint = any(p_endpoints);
end;
$$;

revoke execute on function public.borrar_suscripciones_vencidas(text[], text) from public;
grant execute on function public.borrar_suscripciones_vencidas(text[], text) to anon, authenticated;

commit;
