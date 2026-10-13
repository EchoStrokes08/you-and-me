-- 031_panel_admin.sql — Para el panel
-- 1) Ver en qué celulares están activas las notificaciones de cada uno y mandar una de prueba
-- 2) Escoger la pregunta de un día (hoy o más adelante)

begin;

-- ============ 1) NOTIFICACIONES ============
-- Cada uno solo puede leer sus propias suscripciones; el admin ve el conteo de los dos por aquí
create or replace function public.estado_notificaciones()
returns table (usuario_id uuid, nombre text, celulares int, ultima timestamptz, silenciados text[])
language sql security definer set search_path = public stable
as $$
  select p.id, p.nombre, count(s.endpoint)::int, max(s.created_at), p.avisos_silenciados
    from perfiles p
    left join suscripciones_push s on s.usuario_id = p.id
   where es_admin()
   group by p.id
   order by p.rol;
$$;
revoke execute on function public.estado_notificaciones() from public, anon;
grant execute on function public.estado_notificaciones() to authenticated;

-- 'prueba' no tiene grupo en grupo_aviso(): llega aunque tenga avisos silenciados
create or replace function public.probar_notificacion(p_destino uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not es_admin() then raise exception 'Solo el admin puede probar las notificaciones'; end if;
  perform enviar_push(p_destino, 'prueba', (select nombre from perfiles where id = auth.uid()), '{}'::jsonb);
end;
$$;
revoke execute on function public.probar_notificacion(uuid) from public, anon;
grant execute on function public.probar_notificacion(uuid) to authenticated;

-- ============ 2) ESCOGER LA PREGUNTA DEL DÍA ============
-- obtener_pregunta_del_dia() respeta lo que ya haya en pregunta_del_dia para esa fecha.
-- La de hoy no se cambia si alguno ya la respondió (su respuesta quedaría en el aire).
create or replace function public.fijar_pregunta_del_dia(p_fecha date, p_pregunta uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  anterior uuid;
begin
  if not es_admin() then raise exception 'Solo el admin puede escoger la pregunta del día'; end if;
  if p_fecha < hoy_bogota() then raise exception 'Ese día ya pasó'; end if;
  if not exists (select 1 from preguntas where id = p_pregunta) then raise exception 'Esa pregunta no existe'; end if;

  select pregunta_id into anterior from pregunta_del_dia where fecha = p_fecha;
  if anterior = p_pregunta then return; end if;
  if anterior is not null and exists (
       select 1 from respuestas r
        where r.pregunta_id = anterior and (r.created_at at time zone 'America/Bogota')::date = p_fecha) then
    raise exception 'Ya respondieron la pregunta de hoy';
  end if;

  insert into pregunta_del_dia (fecha, pregunta_id) values (p_fecha, p_pregunta)
  on conflict (fecha) do update set pregunta_id = excluded.pregunta_id;

  -- Si la que se quitó era una pregunta propia que nadie alcanzó a responder, vuelve a la fila
  if anterior is not null
     and exists (select 1 from preguntas_propias where pregunta_id = anterior)
     and not exists (select 1 from pregunta_del_dia where pregunta_id = anterior)
     and not exists (select 1 from respuestas where pregunta_id = anterior) then
    update preguntas_propias set usada_en = null, pregunta_id = null where pregunta_id = anterior;
    delete from preguntas where id = anterior;
  end if;
end;
$$;
revoke execute on function public.fijar_pregunta_del_dia(date, uuid) from public, anon;
grant execute on function public.fijar_pregunta_del_dia(date, uuid) to authenticated;

commit;
