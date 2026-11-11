-- 041_adivinanzas.sql — "¿Qué tan bien me conoces?"
-- Uno ve una pregunta del día que los dos ya respondieron (sin ver lo que dijo el otro), escribe lo
-- que cree que el otro respondió y al enviarlo se revela la respuesta de verdad. Después el dueño de
-- la respuesta califica: le atinó (2 puntos), casi (1) o nada que ver (0).
-- Solo entran preguntas que los dos respondieron hace más de 3 días: la regla de "responde antes
-- de ver" no se rompe y no se juega con algo que acaban de leer.

begin;

create table if not exists public.adivinanzas (
  id uuid primary key default gen_random_uuid(),
  respuesta_id uuid not null references public.respuestas(id) on delete cascade,
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  veredicto text check (veredicto in ('exacto', 'casi', 'no')),
  created_at timestamptz not null default now(),
  calificada_en timestamptz,
  unique (respuesta_id, de)
);
create index if not exists adivinanzas_de on public.adivinanzas (de, created_at desc);

-- Se escribe solo por las funciones de abajo; leer: quien adivinó y el dueño de la respuesta
alter table public.adivinanzas enable row level security;
drop policy if exists adivinanzas_select on public.adivinanzas;
create policy adivinanzas_select on public.adivinanzas for select to authenticated
  using (de = auth.uid() or exists (select 1 from public.respuestas r where r.id = respuesta_id and r.usuario_id = auth.uid()));
revoke insert, update, delete on public.adivinanzas from authenticated, anon;

-- Una respuesta del otro que se puede jugar: los dos respondieron esa pregunta hace más de 3 días
-- y yo todavía no la he adivinado
create or replace function public.adivinanza_jugable(p_respuesta uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from respuestas r
     where r.id = p_respuesta
       and r.usuario_id <> auth.uid()
       and r.created_at < now() - interval '3 days'
       and exists (select 1 from respuestas mia where mia.pregunta_id = r.pregunta_id and mia.usuario_id = auth.uid())
       and not exists (select 1 from adivinanzas a where a.respuesta_id = r.id and a.de = auth.uid()));
$$;
revoke execute on function public.adivinanza_jugable(uuid) from public, anon, authenticated;

-- La próxima pregunta para adivinar, al azar, sin la respuesta. p_saltar: las que ya saltó en esta ronda.
create or replace function public.siguiente_adivinanza(p_saltar uuid[] default '{}')
returns table (respuesta_id uuid, pregunta text, emoji text, categoria text, respondida date, quedan int)
language sql security definer set search_path = public volatile
as $$
  with jugables as (
    select r.id, r.pregunta_id, r.created_at from respuestas r
     where public.adivinanza_jugable(r.id) and not (r.id = any(coalesce(p_saltar, '{}')))
  )
  select j.id, p.texto, c.emoji, c.nombre, (j.created_at at time zone 'America/Bogota')::date,
         (select count(*)::int from jugables)
    from jugables j
    join preguntas p on p.id = j.pregunta_id
    left join categorias_preguntas c on c.slug = p.categoria_slug
   order by random()
   limit 1;
$$;
revoke execute on function public.siguiente_adivinanza(uuid[]) from public, anon;
grant execute on function public.siguiente_adivinanza(uuid[]) to authenticated;

-- Guarda la adivinanza y devuelve lo que el otro respondió de verdad (y lo que respondí yo, para comparar)
create or replace function public.adivinar(p_respuesta uuid, p_texto text)
returns table (adivinanza_id uuid, respuesta text, mi_respuesta text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_texto), '') is null then raise exception 'Escribe lo que crees que respondió'; end if;
  if not adivinanza_jugable(p_respuesta) then raise exception 'Esa pregunta no se puede adivinar'; end if;
  insert into adivinanzas (respuesta_id, de, texto) values (p_respuesta, auth.uid(), btrim(p_texto)) returning id into v_id;
  return query
    select v_id, r.texto, mia.texto
      from respuestas r
      join respuestas mia on mia.pregunta_id = r.pregunta_id and mia.usuario_id = auth.uid()
     where r.id = p_respuesta;
end;
$$;
revoke execute on function public.adivinar(uuid, text) from public, anon;
grant execute on function public.adivinar(uuid, text) to authenticated;

-- El dueño de la respuesta dice qué tanto le atinó (se puede cambiar después)
create or replace function public.calificar_adivinanza(p_id uuid, p_veredicto text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_veredicto not in ('exacto', 'casi', 'no') then raise exception 'Veredicto inválido'; end if;
  update adivinanzas a set veredicto = p_veredicto, calificada_en = now()
    from respuestas r
   where a.id = p_id and r.id = a.respuesta_id and r.usuario_id = auth.uid();
  if not found then raise exception 'Solo quien respondió puede calificarla'; end if;
end;
$$;
revoke execute on function public.calificar_adivinanza(uuid, text) from public, anon;
grant execute on function public.calificar_adivinanza(uuid, text) to authenticated;

-- Las que el otro adivinó sobre mis respuestas y todavía no califico
create or replace function public.adivinanzas_por_calificar()
returns table (id uuid, pregunta text, adivinanza text, mi_respuesta text, created_at timestamptz)
language sql security definer set search_path = public stable
as $$
  select a.id, p.texto, a.texto, r.texto, a.created_at
    from adivinanzas a
    join respuestas r on r.id = a.respuesta_id
    join preguntas p on p.id = r.pregunta_id
   where r.usuario_id = auth.uid() and a.veredicto is null
   order by a.created_at;
$$;
revoke execute on function public.adivinanzas_por_calificar() from public, anon;
grant execute on function public.adivinanzas_por_calificar() to authenticated;

-- Mis últimas adivinanzas, con lo que respondió el otro y cómo me calificó
create or replace function public.mis_adivinanzas(p_limite int default 20)
returns table (id uuid, pregunta text, adivinanza text, respuesta text, veredicto text, created_at timestamptz)
language sql security definer set search_path = public stable
as $$
  select a.id, p.texto, a.texto, r.texto, a.veredicto, a.created_at
    from adivinanzas a
    join respuestas r on r.id = a.respuesta_id
    join preguntas p on p.id = r.pregunta_id
   where a.de = auth.uid()
   order by a.created_at desc
   limit least(greatest(p_limite, 1), 100);
$$;
revoke execute on function public.mis_adivinanzas(int) from public, anon;
grant execute on function public.mis_adivinanzas(int) to authenticated;

-- El marcador de los dos: quién conoce más a quién
create or replace function public.marcador_adivinanzas()
returns table (usuario_id uuid, jugadas int, calificadas int, puntos int, exactas int)
language sql security definer set search_path = public stable
as $$
  select p.id,
         count(a.id)::int,
         count(a.veredicto)::int,
         coalesce(sum(case a.veredicto when 'exacto' then 2 when 'casi' then 1 else 0 end), 0)::int,
         count(*) filter (where a.veredicto = 'exacto')::int
    from perfiles p
    left join adivinanzas a on a.de = p.id
   where auth.uid() is not null
   group by p.id;
$$;
revoke execute on function public.marcador_adivinanzas() from public, anon;
grant execute on function public.marcador_adivinanzas() to authenticated;

-- ============ AVISOS ============
-- Para no llenar el celular cuando uno juega varias seguidas:
--  - al dueño le llega un aviso solo con la primera adivinanza que queda pendiente de calificar;
--  - a quien adivinó le llega uno cuando el otro termina de calificar todas, con los puntos.
create or replace function public.notificar_adivinanza()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  duenio uuid;
  pendientes int;
  pts int;
  cuantas int;
begin
  select usuario_id into duenio from respuestas where id = new.respuesta_id;
  if duenio is null then return null; end if;

  if tg_op = 'INSERT' then
    select count(*) into pendientes from adivinanzas a join respuestas r on r.id = a.respuesta_id
     where r.usuario_id = duenio and a.veredicto is null and a.id <> new.id;
    if pendientes = 0 then
      perform enviar_push(duenio, 'adivinanza', (select nombre from perfiles where id = new.de),
        jsonb_build_object('pregunta', (select p.texto from preguntas p join respuestas r on r.pregunta_id = p.id where r.id = new.respuesta_id)));
    end if;
  elsif old.veredicto is null and new.veredicto is not null then
    select count(*) into pendientes from adivinanzas a join respuestas r on r.id = a.respuesta_id
     where r.usuario_id = duenio and a.de = new.de and a.veredicto is null;
    if pendientes = 0 then
      -- Lo calificado en esta tanda: desde la última vez que avisamos (o la última hora)
      select count(*), coalesce(sum(case veredicto when 'exacto' then 2 when 'casi' then 1 else 0 end), 0)
        into cuantas, pts
        from adivinanzas a join respuestas r on r.id = a.respuesta_id
       where r.usuario_id = duenio and a.de = new.de and a.calificada_en > now() - interval '1 hour';
      perform enviar_push(new.de, 'adivinanza_calificada', (select nombre from perfiles where id = duenio),
        jsonb_build_object('cuantas', cuantas, 'puntos', pts));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.notificar_adivinanza() from public, anon, authenticated;

drop trigger if exists notificar_adivinanzas on public.adivinanzas;
create trigger notificar_adivinanzas after insert or update of veredicto on public.adivinanzas
  for each row execute function public.notificar_adivinanza();

-- Mismos grupos que en 034; las adivinanzas se silencian junto con la pregunta del día
create or replace function public.grupo_aviso(p_evento text)
returns text
language sql immutable
as $$
  select case
    when p_evento in ('respuesta', 'reaccion_respuesta', 'racha', 'adivinanza', 'adivinanza_calificada') then 'pregunta'
    when p_evento in ('pienso_en_ti', 'gratitud') then 'pienso'
    when p_evento = 'animo' then 'animo'
    when p_evento in ('recuerdo', 'nota', 'un_dia_como_hoy', 'cancion_nueva') then 'recuerdos'
    when p_evento in ('sueno_nuevo', 'sueno_cumplido', 'regalo_nuevo', 'lugar_por_conocer',
                      'vale_nuevo', 'vale_redimido', 'vale_cumplido', 'peli_nueva', 'reto_cumplido') then 'juntos'
    when p_evento in ('carta_nueva', 'carta_disponible', 'carta_abierta', 'capsula_nueva', 'capsula_item', 'capsula_abierta') then 'cartas'
    when p_evento in ('mesiversario', 'cumple_tuyo', 'cumple_pareja', 'cumple_pronto', 'dia_importante') then 'fechas'
    when p_evento = 'ciclo' then 'ciclo'
  end;
$$;

do $$ begin
  alter publication supabase_realtime add table public.adivinanzas;
exception when others then null; end $$;

commit;
