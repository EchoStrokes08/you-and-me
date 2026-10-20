-- 034_ciclo.sql — Ciclo menstrual con cifrado de extremo a extremo
-- La base solo guarda sobres cifrados en el celular de quien registra: ni la base, ni el admin, ni las copias
-- de seguridad pueden leer fechas, síntomas o ánimos. Las reglas de acceso no tienen excepción para el admin.
--
-- ciclo_llaves        la llave pública de cada uno y su llavero cifrado con su clave del ciclo (o nada si es solo local)
-- ciclo_datos         sus registros, cada uno con un nombre opaco (no deja ver la fecha)
-- ciclo_compartido    el resumen que ella decidió compartir, cifrado para la llave de la pareja. Borrarlo = revocar
-- ciclo_avisos        avisos cifrados para la pareja (necesidades, día difícil, antes del periodo…). La pareja
--                     no ve los programados antes de su hora, y la notificación nunca dice de qué se trata
-- ciclo_consentimientos  prueba de la autorización para tratar datos sensibles (Ley 1581 de 2012)

begin;

create table if not exists public.ciclo_llaves (
  usuario_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  publica jsonb not null,
  llavero jsonb,
  llavero_recuperacion jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ciclo_datos (
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[0-9a-f]{32}$'),
  sobre jsonb not null check (octet_length(sobre::text) < 40000),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, id)
);

create table if not exists public.ciclo_compartido (
  duena uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  destino uuid not null references auth.users(id) on delete cascade,
  sobre jsonb not null check (octet_length(sobre::text) < 200000),
  updated_at timestamptz not null default now(),
  check (destino <> duena)
);

create table if not exists public.ciclo_avisos (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references auth.users(id) on delete cascade,
  para uuid not null references auth.users(id) on delete cascade,
  enviar_en timestamptz not null default now(),
  enviado_en timestamptz,
  sobre jsonb not null check (octet_length(sobre::text) < 8000),
  created_at timestamptz not null default now(),
  check (para <> de)
);
create index if not exists ciclo_avisos_pendientes on public.ciclo_avisos (enviar_en) where enviado_en is null;
create index if not exists ciclo_avisos_para on public.ciclo_avisos (para, enviar_en);

create table if not exists public.ciclo_consentimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version text not null,
  accion text not null check (accion in ('otorgado', 'revocado')),
  created_at timestamptz not null default now()
);

-- ============ REGLAS DE ACCESO ============
alter table public.ciclo_llaves enable row level security;
alter table public.ciclo_datos enable row level security;
alter table public.ciclo_compartido enable row level security;
alter table public.ciclo_avisos enable row level security;
alter table public.ciclo_consentimientos enable row level security;

drop policy if exists ciclo_llaves_propias on public.ciclo_llaves;
create policy ciclo_llaves_propias on public.ciclo_llaves for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists ciclo_datos_propios on public.ciclo_datos;
create policy ciclo_datos_propios on public.ciclo_datos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists ciclo_compartido_select on public.ciclo_compartido;
drop policy if exists ciclo_compartido_insert on public.ciclo_compartido;
drop policy if exists ciclo_compartido_update on public.ciclo_compartido;
drop policy if exists ciclo_compartido_delete on public.ciclo_compartido;
create policy ciclo_compartido_select on public.ciclo_compartido for select to authenticated using (duena = auth.uid() or destino = auth.uid());
create policy ciclo_compartido_insert on public.ciclo_compartido for insert to authenticated with check (duena = auth.uid());
create policy ciclo_compartido_update on public.ciclo_compartido for update to authenticated using (duena = auth.uid()) with check (duena = auth.uid());
create policy ciclo_compartido_delete on public.ciclo_compartido for delete to authenticated using (duena = auth.uid());

drop policy if exists ciclo_avisos_select on public.ciclo_avisos;
drop policy if exists ciclo_avisos_insert on public.ciclo_avisos;
drop policy if exists ciclo_avisos_delete on public.ciclo_avisos;
create policy ciclo_avisos_select on public.ciclo_avisos for select to authenticated
  using (de = auth.uid() or (para = auth.uid() and enviar_en <= now()));
create policy ciclo_avisos_insert on public.ciclo_avisos for insert to authenticated
  with check (de = auth.uid() and enviado_en is null and enviar_en <= now() + interval '60 days');
create policy ciclo_avisos_delete on public.ciclo_avisos for delete to authenticated
  using (de = auth.uid() or (para = auth.uid() and enviar_en <= now()));

drop policy if exists ciclo_consentimientos_propios on public.ciclo_consentimientos;
create policy ciclo_consentimientos_propios on public.ciclo_consentimientos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

revoke all on public.ciclo_llaves, public.ciclo_datos, public.ciclo_compartido, public.ciclo_avisos, public.ciclo_consentimientos from anon;
grant select, insert, update, delete on public.ciclo_llaves, public.ciclo_datos, public.ciclo_compartido, public.ciclo_consentimientos to authenticated;
-- Los avisos no se editan desde la app (enviado_en lo pone solo la base)
grant select, insert, delete on public.ciclo_avisos to authenticated;
revoke update on public.ciclo_avisos from authenticated;

-- updated_at al día en cada cambio
create or replace function public.ciclo_tocar()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists ciclo_datos_tocar on public.ciclo_datos;
create trigger ciclo_datos_tocar before update on public.ciclo_datos for each row execute function public.ciclo_tocar();
drop trigger if exists ciclo_compartido_tocar on public.ciclo_compartido;
create trigger ciclo_compartido_tocar before update on public.ciclo_compartido for each row execute function public.ciclo_tocar();
drop trigger if exists ciclo_llaves_tocar on public.ciclo_llaves;
create trigger ciclo_llaves_tocar before update on public.ciclo_llaves for each row execute function public.ciclo_tocar();

-- La llave pública de la pareja (solo la pública: el llavero cifrado nunca sale de su dueño)
create or replace function public.ciclo_llave_pareja()
returns table (usuario_id uuid, publica jsonb)
language sql security definer set search_path = public stable
as $$
  select l.usuario_id, l.publica from ciclo_llaves l
   where l.usuario_id <> auth.uid() and l.usuario_id in (select id from perfiles)
   limit 1;
$$;
revoke execute on function public.ciclo_llave_pareja() from public, anon;
grant execute on function public.ciclo_llave_pareja() to authenticated;

-- A quién se le comparte: la otra persona de la app
create or replace function public.ciclo_id_pareja()
returns uuid
language sql security definer set search_path = public stable
as $$
  select id from perfiles where id <> auth.uid() limit 1;
$$;
revoke execute on function public.ciclo_id_pareja() from public, anon;
grant execute on function public.ciclo_id_pareja() to authenticated;

-- ============ NOTIFICACIONES ============
-- Mismos grupos que en 032, más 'ciclo' para poder silenciarlos
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
    when p_evento = 'ciclo' then 'ciclo'
  end;
$$;

-- Manda los avisos que ya llegaron a su hora. Los programados (antes del periodo, compras…) solo salen si
-- ella sigue compartiendo: al revocar la app los borra, y esto cubre el caso de que no alcanzara.
-- La notificación no lleva datos: solo el nombre de quien la manda.
create or replace function public.enviar_avisos_ciclo()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a record;
begin
  for a in
    select av.id, av.de, av.para, av.enviar_en > av.created_at + interval '1 hour' as programado from ciclo_avisos av
     where av.enviado_en is null and av.enviar_en <= now() + interval '1 minute'
     order by av.enviar_en
     for update skip locked
  loop
    update ciclo_avisos set enviado_en = now() where id = a.id;
    -- Los muy viejos (el celular estuvo sin internet, la tarea no corrió) se marcan pero no se mandan
    if exists (select 1 from ciclo_avisos where id = a.id and enviar_en > now() - interval '1 day')
       and (not a.programado or exists (select 1 from ciclo_compartido where duena = a.de and destino = a.para)) then
      perform enviar_push(a.para, 'ciclo', coalesce((select nombre from perfiles where id = a.de), ''), '{}'::jsonb);
    end if;
  end loop;
  delete from ciclo_avisos where enviar_en < now() - interval '14 days';
end;
$$;
revoke execute on function public.enviar_avisos_ciclo() from public, anon, authenticated;

-- Los avisos del momento (una necesidad, un día difícil) salen enseguida
create or replace function public.ciclo_aviso_nuevo()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.enviar_en <= now() + interval '1 minute' then perform enviar_avisos_ciclo(); end if;
  return null;
end;
$$;
drop trigger if exists ciclo_aviso_nuevo on public.ciclo_avisos;
create trigger ciclo_aviso_nuevo after insert on public.ciclo_avisos for each row execute function public.ciclo_aviso_nuevo();

do $$ begin perform cron.unschedule('avisos-ciclo'); exception when others then null; end $$;
select cron.schedule('avisos-ciclo', '*/10 * * * *', 'select public.enviar_avisos_ciclo()');

-- Con la app abierta, la pareja ve al instante cuando ella comparte, actualiza o revoca
do $$ begin alter publication supabase_realtime add table public.ciclo_compartido; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ciclo_avisos; exception when others then null; end $$;

commit;
