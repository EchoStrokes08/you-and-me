-- 011_conocerse_planear.sql
-- Racha de la pregunta del día, estado de ánimo, cosas por hacer juntos y lista de regalos

begin;

-- ============ RACHA DE LA PREGUNTA DEL DÍA ============
-- Días seguidos en que los dos respondieron la pregunta ESE MISMO día (hora Bogotá).
-- Si hoy todavía falta alguno, la racha sigue viva desde ayer.
create or replace function public.racha_preguntas()
returns table (dias int, hoy_completo boolean)
language plpgsql security definer set search_path = public stable
as $$
declare
  d date := hoy_bogota();
  n int := 0;
  completo boolean;
  personas int := (select count(*) from perfiles);
begin
  hoy_completo := (
    select count(distinct r.usuario_id) = personas
      from pregunta_del_dia pd join respuestas r on r.pregunta_id = pd.pregunta_id
     where pd.fecha = d and (r.created_at at time zone 'America/Bogota')::date = d
  );
  if not hoy_completo then d := d - 1; end if;
  loop
    select count(distinct r.usuario_id) = personas into completo
      from pregunta_del_dia pd join respuestas r on r.pregunta_id = pd.pregunta_id
     where pd.fecha = d and (r.created_at at time zone 'America/Bogota')::date = d;
    exit when not completo or n > 3650;
    n := n + 1;
    d := d - 1;
  end loop;
  dias := n;
  return next;
end;
$$;

revoke execute on function public.racha_preguntas() from public, anon;
grant execute on function public.racha_preguntas() to authenticated;

-- 9 p. m.: a quien no ha respondido hoy, "no rompas la racha"
create or replace function public.recordar_racha()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  hoy date := hoy_bogota();
  v_pregunta uuid;
  v_racha int;
  p record;
begin
  select pregunta_id into v_pregunta from pregunta_del_dia where fecha = hoy;
  if v_pregunta is null then return; end if;
  select dias into v_racha from racha_preguntas();
  for p in
    select pe.id from perfiles pe
     where not exists (
       select 1 from respuestas r
        where r.pregunta_id = v_pregunta and r.usuario_id = pe.id
          and (r.created_at at time zone 'America/Bogota')::date = hoy)
  loop
    perform enviar_push(p.id, 'racha', '', jsonb_build_object('dias', v_racha));
  end loop;
end;
$$;

revoke execute on function public.recordar_racha() from public, anon, authenticated;

-- ============ ¿CÓMO TE SIENTES HOY? ============
create table if not exists public.estados_animo (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null default hoy_bogota(),
  emoji text not null,
  etiqueta text not null,
  created_at timestamptz not null default now(),
  primary key (usuario_id, fecha)
);

alter table public.estados_animo enable row level security;
drop policy if exists animo_select on public.estados_animo;
drop policy if exists animo_insert on public.estados_animo;
drop policy if exists animo_update on public.estados_animo;
create policy animo_select on public.estados_animo for select to authenticated using (true);
create policy animo_insert on public.estados_animo for insert to authenticated with check (usuario_id = auth.uid());
create policy animo_update on public.estados_animo for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ============ COSAS POR HACER JUNTOS ============
create table if not exists public.suenos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  emoji text not null default '✨',
  nota text not null default '',
  creado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cumplido_en date,
  recuerdo_id uuid references public.recuerdos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.suenos enable row level security;
drop policy if exists suenos_select on public.suenos;
drop policy if exists suenos_insert on public.suenos;
drop policy if exists suenos_update on public.suenos;
drop policy if exists suenos_delete on public.suenos;
-- Son de los dos: ambos ven, marcan como cumplido y editan; borra quien lo creó
create policy suenos_select on public.suenos for select to authenticated using (true);
create policy suenos_insert on public.suenos for insert to authenticated with check (creado_por = auth.uid());
create policy suenos_update on public.suenos for update to authenticated using (true) with check (true);
create policy suenos_delete on public.suenos for delete to authenticated using (creado_por = auth.uid() or public.es_admin());

-- ============ LISTA DE REGALOS ============
create table if not exists public.regalos (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  link text,
  nota text not null default '',
  me_encanta boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.regalos enable row level security;
drop policy if exists regalos_select on public.regalos;
drop policy if exists regalos_insert on public.regalos;
drop policy if exists regalos_update on public.regalos;
drop policy if exists regalos_delete on public.regalos;
create policy regalos_select on public.regalos for select to authenticated using (true);
create policy regalos_insert on public.regalos for insert to authenticated with check (de = auth.uid());
create policy regalos_update on public.regalos for update to authenticated using (de = auth.uid()) with check (de = auth.uid());
create policy regalos_delete on public.regalos for delete to authenticated using (de = auth.uid());

-- "Ya lo compré 🤫": tabla aparte para que quien pidió el regalo nunca lo vea.
-- Solo lo ve quien lo compró, y nadie puede marcar sus propios regalos.
create table if not exists public.regalos_comprados (
  regalo_id uuid primary key references public.regalos(id) on delete cascade,
  comprado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.regalos_comprados enable row level security;
drop policy if exists comprados_select on public.regalos_comprados;
drop policy if exists comprados_insert on public.regalos_comprados;
drop policy if exists comprados_delete on public.regalos_comprados;
create policy comprados_select on public.regalos_comprados for select to authenticated using (comprado_por = auth.uid());
create policy comprados_insert on public.regalos_comprados for insert to authenticated
  with check (comprado_por = auth.uid() and not exists (select 1 from public.regalos g where g.id = regalo_id and g.de = auth.uid()));
create policy comprados_delete on public.regalos_comprados for delete to authenticated using (comprado_por = auth.uid());

-- ============ AVISOS ============
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
$$;

drop trigger if exists notificar_animo on public.estados_animo;
create trigger notificar_animo after insert or update on public.estados_animo
  for each row execute function public.notificar_pareja();

drop trigger if exists notificar_suenos on public.suenos;
create trigger notificar_suenos after insert or update on public.suenos
  for each row execute function public.notificar_pareja();

drop trigger if exists notificar_regalos on public.regalos;
create trigger notificar_regalos after insert on public.regalos
  for each row execute function public.notificar_pareja();

-- 9:00 p. m. en Bogotá = 02:00 UTC
select cron.schedule('recordar-racha', '0 2 * * *', 'select public.recordar_racha()');

commit;
