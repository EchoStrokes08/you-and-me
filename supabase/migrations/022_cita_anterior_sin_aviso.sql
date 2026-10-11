-- 022_cita_anterior_sin_aviso.sql
-- Desde Citas se puede agregar una cita que ya pasó: se guarda de una vez como 'vivida'.
--   · Esa cita no manda el aviso de "cita nueva" (no es una invitación, ya ocurrió).
--   · El resto de notificar_pareja() queda igual que estaba.

begin;

CREATE OR REPLACE FUNCTION public.notificar_pareja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Una cita anterior que se agrega ya vivida no avisa como si fuera una invitación nueva
      if new.estado <> 'vivida' then evento := 'cita_nueva'; end if;
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
  elsif tg_table_name = 'estados_animo' then
    -- Solo el primero del día o si cambia de ánimo
    if tg_op = 'INSERT' or new.emoji is distinct from old.emoji then
      evento := 'animo';
      datos := jsonb_build_object('emoji', new.emoji, 'etiqueta', new.etiqueta);
    end if;
  elsif tg_table_name = 'suenos' then
    if tg_op = 'INSERT' then
      evento := 'sueno_nuevo';
    elsif new.cumplido_en is not null and old.cumplido_en is null then
      evento := 'sueno_cumplido';
    end if;
    datos := jsonb_build_object('titulo', new.titulo, 'emoji', new.emoji);
  elsif tg_table_name = 'regalos' then
    evento := 'regalo_nuevo';
    datos := jsonb_build_object('nombre', new.nombre);
  end if;

  if evento is null then return null; end if;

  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, evento, (select nombre from perfiles where id = actor), datos);
  end loop;
  return null;
end;
$function$;

commit;
