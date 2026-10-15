-- 032_vales_pelis_retos_dias.sql
-- 1) Vales: uno le regala al otro "un masaje", "yo escojo la peli"… y el otro lo redime cuando quiera
-- 2) Pelis y series por ver juntos, con la calificación de cada uno
-- 3) El reto del mes: una misión de pareja que, cumplida, se guarda como recuerdo
-- 4) Lo que me gustó de hoy: una frase que el otro lee al día siguiente
-- 5) Días importantes de cada uno (un examen, un día duro en el trabajo) y el aviso de ese día al otro
-- 6) Los conteos de los logros
-- 7) Los grupos de avisos con los eventos nuevos

begin;

-- ============ 1) VALES ============
create table if not exists public.vales (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 60),
  detalle text not null default '' check (char_length(detalle) <= 200),
  emoji text not null default '🎟️',
  redimido_en timestamptz,
  cumplido_en timestamptz,
  created_at timestamptz not null default now(),
  check (de <> para)
);

alter table public.vales enable row level security;
drop policy if exists vales_select on public.vales;
drop policy if exists vales_insert on public.vales;
drop policy if exists vales_delete on public.vales;
create policy vales_select on public.vales for select to authenticated using (de = auth.uid() or para = auth.uid());
create policy vales_insert on public.vales for insert to authenticated
  with check (de = auth.uid() and redimido_en is null and cumplido_en is null);
-- Quien lo regaló lo puede retirar mientras no lo hayan redimido
create policy vales_delete on public.vales for delete to authenticated using (de = auth.uid() and redimido_en is null);

-- Sin política de update: redimir solo lo hace quien lo recibió y cumplirlo solo quien lo regaló
create or replace function public.redimir_vale(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update vales set redimido_en = now() where id = p_id and para = auth.uid() and redimido_en is null;
  if not found then raise exception 'Ese vale no se puede redimir'; end if;
end;
$$;
revoke execute on function public.redimir_vale(uuid) from public, anon;
grant execute on function public.redimir_vale(uuid) to authenticated;

create or replace function public.cumplir_vale(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update vales set cumplido_en = now() where id = p_id and de = auth.uid() and redimido_en is not null and cumplido_en is null;
  if not found then raise exception 'Ese vale no se puede marcar como cumplido'; end if;
end;
$$;
revoke execute on function public.cumplir_vale(uuid) from public, anon;
grant execute on function public.cumplir_vale(uuid) to authenticated;

create or replace function public.notificar_vale()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  datos jsonb := jsonb_build_object('titulo', new.titulo, 'emoji', new.emoji);
begin
  if actor is null then return null; end if;
  if tg_op = 'INSERT' then
    perform enviar_push(new.para, 'vale_nuevo', (select nombre from perfiles where id = actor), datos);
  elsif new.redimido_en is not null and old.redimido_en is null then
    perform enviar_push(new.de, 'vale_redimido', (select nombre from perfiles where id = actor), datos);
  elsif new.cumplido_en is not null and old.cumplido_en is null then
    perform enviar_push(new.para, 'vale_cumplido', (select nombre from perfiles where id = actor), datos);
  end if;
  return null;
end;
$$;
revoke execute on function public.notificar_vale() from public, anon, authenticated;

drop trigger if exists notificar_vale on public.vales;
create trigger notificar_vale after insert or update on public.vales
  for each row execute function public.notificar_vale();

-- ============ 2) PELIS Y SERIES ============
create table if not exists public.pelis (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 100),
  tipo text not null default 'peli' check (tipo in ('peli', 'serie')),
  donde text not null default '' check (char_length(donde) <= 40),
  agregada_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vista_en date,
  created_at timestamptz not null default now()
);

alter table public.pelis enable row level security;
drop policy if exists pelis_select on public.pelis;
drop policy if exists pelis_insert on public.pelis;
drop policy if exists pelis_update on public.pelis;
drop policy if exists pelis_delete on public.pelis;
create policy pelis_select on public.pelis for select to authenticated using (true);
create policy pelis_insert on public.pelis for insert to authenticated with check (agregada_por = auth.uid());
create policy pelis_update on public.pelis for update to authenticated using (true) with check (true);
create policy pelis_delete on public.pelis for delete to authenticated using (agregada_por = auth.uid() or public.es_admin());

-- Cada uno califica por su lado, de 1 a 5
create table if not exists public.pelis_calificacion (
  peli_id uuid not null references public.pelis(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  estrellas int not null check (estrellas between 1 and 5),
  primary key (peli_id, usuario_id)
);

alter table public.pelis_calificacion enable row level security;
drop policy if exists pelis_cal_select on public.pelis_calificacion;
drop policy if exists pelis_cal_insert on public.pelis_calificacion;
drop policy if exists pelis_cal_update on public.pelis_calificacion;
drop policy if exists pelis_cal_delete on public.pelis_calificacion;
create policy pelis_cal_select on public.pelis_calificacion for select to authenticated using (true);
create policy pelis_cal_insert on public.pelis_calificacion for insert to authenticated with check (usuario_id = auth.uid());
create policy pelis_cal_update on public.pelis_calificacion for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy pelis_cal_delete on public.pelis_calificacion for delete to authenticated using (usuario_id = auth.uid());

create or replace function public.notificar_peli()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
begin
  if actor is null then return null; end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, 'peli_nueva', (select nombre from perfiles where id = actor),
      jsonb_build_object('titulo', new.titulo, 'tipo', new.tipo));
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_peli() from public, anon, authenticated;

drop trigger if exists notificar_peli on public.pelis;
create trigger notificar_peli after insert on public.pelis
  for each row execute function public.notificar_peli();

-- ============ 3) EL RETO DEL MES ============
create table if not exists public.retos (
  id uuid primary key default gen_random_uuid(),
  texto text not null unique check (char_length(texto) between 1 and 120),
  emoji text not null default '✨',
  activo boolean not null default true
);

-- Uno por mes (el día 1 de ese mes)
create table if not exists public.retos_mes (
  mes date primary key check (extract(day from mes) = 1),
  reto_id uuid not null references public.retos(id),
  cumplido_en date,
  recuerdo_id uuid references public.recuerdos(id) on delete set null
);

alter table public.retos enable row level security;
alter table public.retos_mes enable row level security;
drop policy if exists retos_select on public.retos;
drop policy if exists retos_admin on public.retos;
drop policy if exists retos_mes_select on public.retos_mes;
drop policy if exists retos_mes_update on public.retos_mes;
create policy retos_select on public.retos for select to authenticated using (true);
create policy retos_admin on public.retos for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy retos_mes_select on public.retos_mes for select to authenticated using (true);
-- Cumplirlo, deshacerlo o enlazarle el recuerdo; el reto en sí no se cambia por aquí
create policy retos_mes_update on public.retos_mes for update to authenticated using (true) with check (true);
revoke update on public.retos_mes from authenticated;
grant update (cumplido_en, recuerdo_id) on public.retos_mes to authenticated;

insert into public.retos (texto, emoji) values
  ('Cocinar juntos algo que ninguno de los dos haya hecho nunca', '🍳'),
  ('Ir a un museo de Bogotá que no conozcan', '🖼️'),
  ('Hacer un picnic en un parque nuevo', '🧺'),
  ('Ver el atardecer desde un mirador', '🌅'),
  ('Tomarse una foto en el mismo lugar de su primera cita', '📸'),
  ('Escribirse una carta a mano y leerla en voz alta', '💌'),
  ('Una tarde sin celulares: solo ustedes dos', '📵'),
  ('Probar un postre de una panadería que no conozcan', '🧁'),
  ('Armar juntos un rompecabezas', '🧩'),
  ('Salir a montar bici en la ciclovía un domingo', '🚲'),
  ('Ir a una librería y regalarse un libro escogido para el otro', '📚'),
  ('Hacer una playlist juntos con una canción por cada mes que llevan', '🎶'),
  ('Ir a ver una obra de teatro o un concierto', '🎭'),
  ('Visitar el Jardín Botánico y buscar su planta favorita', '🌿'),
  ('Desayunar juntos en un sitio nuevo', '🥐'),
  ('Ver un documental de ballenas abrazados', '🐋'),
  ('Aprender juntos algo nuevo en un tutorial: un baile, un dibujo, un truco', '💃'),
  ('Recorrer un barrio de Bogotá que no conozcan, a pie', '🚶'),
  ('Hacer una noche de juegos de mesa', '🎲'),
  ('Pintar o dibujar un retrato del otro', '🎨'),
  ('Ir a un mercado y comprar una fruta que nunca hayan probado', '🥭'),
  ('Recrear su primera cita', '💚'),
  ('Hacer galletas y regalarle unas a alguien', '🍪'),
  ('Planear juntos el viaje de sus sueños, con presupuesto y todo', '🗺️')
on conflict (texto) do nothing;

-- El reto de este mes: si todavía no hay, se escoge uno que no hayan tenido (o el que menos)
create or replace function public.reto_del_mes()
returns table (mes date, reto_id uuid, texto text, emoji text, cumplido_en date, recuerdo_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_mes date := date_trunc('month', hoy_bogota())::date;
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from retos_mes rm where rm.mes = v_mes) then
    insert into retos_mes (mes, reto_id)
    select v_mes, r.id
      from retos r
     where r.activo
     order by (select count(*) from retos_mes x where x.reto_id = r.id), random()
     limit 1
    on conflict do nothing;
  end if;
  return query
    select rm.mes, r.id, r.texto, r.emoji, rm.cumplido_en, rm.recuerdo_id
      from retos_mes rm join retos r on r.id = rm.reto_id
     where rm.mes = v_mes;
end;
$$;
revoke execute on function public.reto_del_mes() from public, anon;
grant execute on function public.reto_del_mes() to authenticated;

-- Si el de este mes no les llama, otro (solo mientras no esté cumplido)
create or replace function public.cambiar_reto_del_mes()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_mes date := date_trunc('month', hoy_bogota())::date;
  actual uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select rm.reto_id into actual from retos_mes rm where rm.mes = v_mes and rm.cumplido_en is null;
  if actual is null then raise exception 'El reto de este mes ya está cumplido'; end if;
  update retos_mes set reto_id = (
    select r.id from retos r
     where r.activo and r.id <> actual
     order by (select count(*) from retos_mes x where x.reto_id = r.id), random()
     limit 1)
   where mes = v_mes;
end;
$$;
revoke execute on function public.cambiar_reto_del_mes() from public, anon;
grant execute on function public.cambiar_reto_del_mes() to authenticated;

create or replace function public.notificar_reto()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
begin
  if actor is null or new.cumplido_en is null or old.cumplido_en is not null then return null; end if;
  for destino in select id from perfiles where id <> actor loop
    perform enviar_push(destino, 'reto_cumplido', (select nombre from perfiles where id = actor),
      (select jsonb_build_object('texto', r.texto, 'emoji', r.emoji) from retos r where r.id = new.reto_id));
  end loop;
  return null;
end;
$$;
revoke execute on function public.notificar_reto() from public, anon, authenticated;

drop trigger if exists notificar_reto on public.retos_mes;
create trigger notificar_reto after update on public.retos_mes
  for each row execute function public.notificar_reto();

-- ============ 4) LO QUE ME GUSTÓ DE HOY ============
-- Uno por persona y por día. El del otro se ve desde el día siguiente.
create table if not exists public.gratitudes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null default public.hoy_bogota(),
  texto text not null check (char_length(texto) between 1 and 280),
  created_at timestamptz not null default now(),
  unique (usuario_id, fecha)
);

alter table public.gratitudes enable row level security;
drop policy if exists gratitudes_select on public.gratitudes;
drop policy if exists gratitudes_insert on public.gratitudes;
drop policy if exists gratitudes_update on public.gratitudes;
drop policy if exists gratitudes_delete on public.gratitudes;
create policy gratitudes_select on public.gratitudes for select to authenticated
  using (usuario_id = auth.uid() or fecha < public.hoy_bogota());
create policy gratitudes_insert on public.gratitudes for insert to authenticated
  with check (usuario_id = auth.uid() and fecha = public.hoy_bogota());
create policy gratitudes_update on public.gratitudes for update to authenticated
  using (usuario_id = auth.uid() and fecha = public.hoy_bogota())
  with check (usuario_id = auth.uid() and fecha = public.hoy_bogota());
create policy gratitudes_delete on public.gratitudes for delete to authenticated
  using (usuario_id = auth.uid() and fecha = public.hoy_bogota());

-- ============ 5) DÍAS IMPORTANTES ============
-- De quien los anota: "mi examen", "mi primer día en el trabajo nuevo". Los dos los ven.
create table if not exists public.dias_importantes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  titulo text not null check (char_length(titulo) between 1 and 60),
  avisado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dias_importantes enable row level security;
drop policy if exists dias_imp_select on public.dias_importantes;
drop policy if exists dias_imp_insert on public.dias_importantes;
drop policy if exists dias_imp_update on public.dias_importantes;
drop policy if exists dias_imp_delete on public.dias_importantes;
create policy dias_imp_select on public.dias_importantes for select to authenticated using (true);
create policy dias_imp_insert on public.dias_importantes for insert to authenticated
  with check (usuario_id = auth.uid() and fecha >= public.hoy_bogota() and not avisado);
create policy dias_imp_update on public.dias_importantes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy dias_imp_delete on public.dias_importantes for delete to authenticated using (usuario_id = auth.uid());

-- 7:00 a. m. en Bogotá: al otro le llega el aviso de lo de hoy, y a cada uno lo que el otro le dejó ayer
create or replace function public.avisar_dias_importantes()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  d record;
  g record;
  destino uuid;
begin
  for d in select di.*, p.nombre from dias_importantes di join perfiles p on p.id = di.usuario_id
            where di.fecha = hoy_bogota() and not di.avisado loop
    for destino in select id from perfiles where id <> d.usuario_id loop
      perform enviar_push(destino, 'dia_importante', d.nombre, jsonb_build_object('titulo', d.titulo));
    end loop;
    update dias_importantes set avisado = true where id = d.id;
  end loop;

  for g in select gr.usuario_id, p.nombre from gratitudes gr join perfiles p on p.id = gr.usuario_id
            where gr.fecha = hoy_bogota() - 1 loop
    for destino in select id from perfiles where id <> g.usuario_id loop
      perform enviar_push(destino, 'gratitud', g.nombre, '{}'::jsonb);
    end loop;
  end loop;
end;
$$;
revoke execute on function public.avisar_dias_importantes() from public, anon, authenticated;

do $$ begin perform cron.unschedule('dias-importantes'); exception when others then null; end $$;
select cron.schedule('dias-importantes', '0 12 * * *', 'select public.avisar_dias_importantes()');

-- ============ 6) LOGROS ============
-- Solo números: nada de contenido. Con security definer cuenta también lo que RLS esconde
-- (por ejemplo, la respuesta del otro antes de responder).
create or replace function public.contar_logros()
returns jsonb
language sql security definer set search_path = public stable
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'preguntas', (select count(distinct pregunta_id) from respuestas r
                   where (select count(*) from respuestas r2 where r2.pregunta_id = r.pregunta_id) >= 2),
    'recuerdos', (select count(*) from recuerdos),
    'fotos', (select count(*) from fotos_recuerdo),
    'citas', (select count(*) from citas where estado = 'vivida'),
    'lugares', (select count(distinct coalesce(lugar_id::text, lugar_personalizado)) from citas
                 where estado = 'vivida' and coalesce(lugar_id::text, lugar_personalizado) is not null),
    'cartas', (select count(*) from cartas where abierta_en is not null),
    'capsulas', (select count(*) from capsulas where abrir_en <= hoy_bogota()),
    'planes', (select count(*) from suenos where cumplido_en is not null),
    'pensamientos', (select count(*) from pensamientos),
    'canciones', (select count(*) from canciones),
    'vales', (select count(*) from vales where cumplido_en is not null),
    'pelis', (select count(*) from pelis where vista_en is not null),
    'retos', (select count(*) from retos_mes where cumplido_en is not null),
    'gratitudes', (select count(*) from gratitudes)
  ) end;
$$;
revoke execute on function public.contar_logros() from public, anon;
grant execute on function public.contar_logros() to authenticated;

-- ============ 7) GRUPOS DE AVISOS ============
-- Igual que en 026, con los eventos nuevos
create or replace function public.grupo_aviso(p_evento text)
returns text
language sql immutable
as $$
  select case
    when p_evento in ('respuesta', 'reaccion_respuesta', 'racha') then 'pregunta'
    when p_evento in ('pienso_en_ti', 'gratitud') then 'pienso'
    when p_evento = 'animo' then 'animo'
    when p_evento in ('recuerdo', 'nota', 'un_dia_como_hoy', 'cancion_nueva') then 'recuerdos'
    when p_evento in ('sueno_nuevo', 'sueno_cumplido', 'regalo_nuevo', 'lugar_por_conocer',
                      'vale_nuevo', 'vale_redimido', 'vale_cumplido', 'peli_nueva', 'reto_cumplido') then 'juntos'
    when p_evento in ('carta_nueva', 'carta_disponible', 'carta_abierta', 'capsula_nueva', 'capsula_item', 'capsula_abierta') then 'cartas'
    when p_evento in ('mesiversario', 'cumple_tuyo', 'cumple_pareja', 'cumple_pronto', 'dia_importante') then 'fechas'
  end;
$$;

do $$ begin
  alter publication supabase_realtime add table public.vales;
exception when others then null; end $$;

commit;
