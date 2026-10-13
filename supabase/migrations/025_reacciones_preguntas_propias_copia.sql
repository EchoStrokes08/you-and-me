-- 025_reacciones_preguntas_propias_copia.sql
-- 1) Reaccionar (corazón) o contestarle a la respuesta del otro en la pregunta del día
-- 2) Preguntas escritas por nosotros: quedan guardadas en secreto y un día salen como pregunta del día
-- 3) Recordatorio al admin cuando lleva 30 días sin descargar la copia de seguridad

begin;

-- ============ 1) REACCIONES ============
-- Una fila por respuesta y por persona: el corazón y/o unas palabras
create table if not exists public.reacciones_respuesta (
  respuesta_id uuid not null references public.respuestas(id) on delete cascade,
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  corazon boolean not null default false,
  texto text check (texto is null or char_length(texto) <= 500),
  created_at timestamptz not null default now(),
  primary key (respuesta_id, de)
);

alter table public.reacciones_respuesta enable row level security;
drop policy if exists reacciones_select on public.reacciones_respuesta;
drop policy if exists reacciones_insert on public.reacciones_respuesta;
drop policy if exists reacciones_update on public.reacciones_respuesta;
drop policy if exists reacciones_delete on public.reacciones_respuesta;
-- Se ve la reacción de una respuesta que ya se puede ver (la regla de respuestas_select decide)
create policy reacciones_select on public.reacciones_respuesta for select to authenticated
  using (exists(select 1 from public.respuestas r where r.id = respuesta_id));
-- Solo se reacciona a la respuesta del otro, y solo cuando ya se puede ver
create policy reacciones_insert on public.reacciones_respuesta for insert to authenticated
  with check (de = auth.uid() and exists(select 1 from public.respuestas r where r.id = respuesta_id and r.usuario_id <> auth.uid()));
create policy reacciones_update on public.reacciones_respuesta for update to authenticated
  using (de = auth.uid()) with check (de = auth.uid());
create policy reacciones_delete on public.reacciones_respuesta for delete to authenticated
  using (de = auth.uid());

-- Aviso al otro: cuando llega el corazón o cuando se escribe (o cambia) la contestación
create or replace function public.notificar_reaccion()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  destino uuid;
  con_corazon boolean;
  con_texto boolean;
begin
  if actor is null then return null; end if;
  con_corazon := new.corazon and (tg_op = 'INSERT' or not old.corazon);
  con_texto := nullif(btrim(new.texto), '') is not null and (tg_op = 'INSERT' or new.texto is distinct from old.texto);
  if not con_corazon and not con_texto then return null; end if;

  select usuario_id into destino from respuestas where id = new.respuesta_id;
  if destino is null or destino = actor then return null; end if;
  perform enviar_push(destino, 'reaccion_respuesta', (select nombre from perfiles where id = actor),
    jsonb_build_object(
      'texto', case when con_texto then left(btrim(new.texto), 120) end,
      'pregunta', (select p.texto from preguntas p join respuestas r on r.pregunta_id = p.id where r.id = new.respuesta_id)
    ));
  return null;
end;
$$;
revoke execute on function public.notificar_reaccion() from public, anon, authenticated;

drop trigger if exists notificar_reacciones on public.reacciones_respuesta;
create trigger notificar_reacciones after insert or update on public.reacciones_respuesta
  for each row execute function public.notificar_reaccion();

-- Realtime: la reacción del otro aparece sin recargar
do $$ begin
  alter publication supabase_realtime add table public.reacciones_respuesta;
exception when others then null; end $$;

-- ============ 2) PREGUNTAS PROPIAS ============
-- Cada uno ve solo las que escribió. Cuando una sale como pregunta del día se copia a
-- `preguntas` (inactiva: no vuelve a salir ni aparece en el modo cartas) y aquí queda marcada.
create table if not exists public.preguntas_propias (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 5 and 300),
  created_at timestamptz not null default now(),
  usada_en date,
  pregunta_id uuid references public.preguntas(id) on delete set null
);

alter table public.preguntas_propias enable row level security;
drop policy if exists preguntas_propias_select on public.preguntas_propias;
drop policy if exists preguntas_propias_insert on public.preguntas_propias;
drop policy if exists preguntas_propias_update on public.preguntas_propias;
drop policy if exists preguntas_propias_delete on public.preguntas_propias;
create policy preguntas_propias_select on public.preguntas_propias for select to authenticated
  using (de = auth.uid());
create policy preguntas_propias_insert on public.preguntas_propias for insert to authenticated
  with check (de = auth.uid() and usada_en is null and pregunta_id is null);
-- Mientras no haya salido se puede corregir o borrar
create policy preguntas_propias_update on public.preguntas_propias for update to authenticated
  using (de = auth.uid() and usada_en is null) with check (de = auth.uid() and usada_en is null and pregunta_id is null);
create policy preguntas_propias_delete on public.preguntas_propias for delete to authenticated
  using (de = auth.uid() and usada_en is null);

alter table public.preguntas add column if not exists propuesta_por uuid references auth.users(id) on delete set null;

-- Categoría inactiva: no se ofrece en el modo cartas
insert into public.categorias_preguntas (slug, nombre, emoji, color, activo, orden)
values ('nuestras', 'Escritas por nosotros', '✍️', '#2F8F63', false, 99)
on conflict (slug) do nothing;

-- La pregunta del día: si hay preguntas propias esperando, más o menos una de cada tres
-- veces sale una de esas (alternando entre los dos); si no, una del catálogo como siempre.
create or replace function public.obtener_pregunta_del_dia()
returns public.preguntas
language plpgsql security definer set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  pid uuid;
  preg public.preguntas;
  propia public.preguntas_propias;
  nueva uuid;
  puesta int;
begin
  select pregunta_id into pid from public.pregunta_del_dia where fecha = hoy;

  if pid is null then
    if random() < 0.34 then
      select pp.* into propia
        from public.preguntas_propias pp
       where pp.usada_en is null
       order by (select max(x.usada_en) from public.preguntas_propias x where x.de = pp.de) nulls first, pp.created_at
       limit 1
       for update skip locked;
    end if;

    if propia.id is not null then
      insert into public.preguntas (categoria_slug, texto, activo, propuesta_por)
      values ('nuestras', btrim(propia.texto), false, propia.de)
      returning id into nueva;

      insert into public.pregunta_del_dia (fecha, pregunta_id) values (hoy, nueva) on conflict (fecha) do nothing;
      get diagnostics puesta = row_count;
      if puesta = 1 then
        update public.preguntas_propias set usada_en = hoy, pregunta_id = nueva where id = propia.id;
      else
        -- El otro abrió la app en el mismo instante y ya quedó otra pregunta para hoy
        delete from public.preguntas where id = nueva;
      end if;
    else
      select p.id into pid
      from public.preguntas p
      where p.activo
      order by (select max(fecha) from public.pregunta_del_dia where pregunta_id = p.id) nulls first, random()
      limit 1;

      insert into public.pregunta_del_dia (fecha, pregunta_id)
      values (hoy, pid)
      on conflict (fecha) do nothing;
    end if;

    select pregunta_id into pid from public.pregunta_del_dia where fecha = hoy;
  end if;

  select * into preg from public.preguntas where id = pid;
  return preg;
end;
$$;

-- ============ 3) RECORDATORIO DE LA COPIA DE SEGURIDAD ============
-- Solo el admin: la app anota cuándo descargó la última copia; si pasan 30 días (o nunca
-- ha descargado una), le llega un aviso y se repite cada semana hasta que la descargue.
alter table public.configuracion add column if not exists ultima_copia timestamptz;
alter table public.configuracion add column if not exists copia_avisada_en date;

create or replace function public.avisar_copia_pendiente()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  destino uuid;
begin
  select ultima_copia, copia_avisada_en into c from configuracion where id = 1;
  if c.ultima_copia is not null and c.ultima_copia > now() - interval '30 days' then return; end if;
  if c.copia_avisada_en is not null and c.copia_avisada_en > hoy_bogota() - 7 then return; end if;

  for destino in select id from perfiles where rol = 'admin' loop
    perform enviar_push(destino, 'copia_pendiente', '', jsonb_build_object(
      'dias', case when c.ultima_copia is null then null else hoy_bogota() - (c.ultima_copia at time zone 'America/Bogota')::date end));
  end loop;
  update configuracion set copia_avisada_en = hoy_bogota() where id = 1;
end;
$$;
revoke execute on function public.avisar_copia_pendiente() from public, anon, authenticated;

-- 10:00 a. m. en Bogotá = 15:00 UTC
select cron.schedule('avisar-copia', '0 15 * * *', 'select public.avisar_copia_pendiente()');

commit;
