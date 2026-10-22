-- 036_asistente_conversaciones.sql — Varias conversaciones con Payakan, con su historial
-- Cada quien ve solo las suyas. Las de la sección Ciclo NO viven aquí: se guardan cifradas con la llave
-- del ciclo (ciclo_datos), así que ni la base ni el asistente pueden leerlas después.

begin;

create table if not exists public.asistente_conversaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists asistente_conversaciones_usuario on public.asistente_conversaciones (usuario_id, updated_at desc);

alter table public.asistente_conversaciones enable row level security;
drop policy if exists asistente_conv_select on public.asistente_conversaciones;
drop policy if exists asistente_conv_insert on public.asistente_conversaciones;
drop policy if exists asistente_conv_update on public.asistente_conversaciones;
drop policy if exists asistente_conv_delete on public.asistente_conversaciones;
create policy asistente_conv_select on public.asistente_conversaciones for select to authenticated using (usuario_id = auth.uid());
create policy asistente_conv_insert on public.asistente_conversaciones for insert to authenticated with check (usuario_id = auth.uid());
create policy asistente_conv_update on public.asistente_conversaciones for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy asistente_conv_delete on public.asistente_conversaciones for delete to authenticated using (usuario_id = auth.uid());

alter table public.asistente_mensajes add column if not exists conversacion_id uuid references public.asistente_conversaciones(id) on delete cascade;

-- Lo que ya hablaron queda como su primera conversación, con su primera pregunta como título
insert into public.asistente_conversaciones (usuario_id, titulo, created_at, updated_at)
select m.usuario_id,
       coalesce(left(regexp_replace((select contenido from public.asistente_mensajes p
                                      where p.usuario_id = m.usuario_id and p.rol = 'user'
                                      order by p.created_at limit 1), '\s+', ' ', 'g'), 60), 'Conversación'),
       min(m.created_at), max(m.created_at)
  from public.asistente_mensajes m
 where m.conversacion_id is null
 group by m.usuario_id;

update public.asistente_mensajes m
   set conversacion_id = c.id
  from public.asistente_conversaciones c
 where m.conversacion_id is null and c.usuario_id = m.usuario_id;

alter table public.asistente_mensajes alter column conversacion_id set not null;
create index if not exists asistente_mensajes_conversacion on public.asistente_mensajes (conversacion_id, created_at);

-- Un mensaje solo puede ir en una conversación propia
drop policy if exists asistente_insert on public.asistente_mensajes;
create policy asistente_insert on public.asistente_mensajes for insert to authenticated
  with check (usuario_id = auth.uid() and exists (select 1 from public.asistente_conversaciones c where c.id = conversacion_id and c.usuario_id = auth.uid()));

commit;
