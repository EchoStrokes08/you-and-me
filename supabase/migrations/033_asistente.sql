-- 033_asistente.sql — La conversación de cada uno con el asistente (Ballena IA)
-- Cada quien ve solo la suya. Las respuestas del asistente las guarda api/asistente.ts con la sesión de quien pregunta.

begin;

create table if not exists public.asistente_mensajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null check (char_length(contenido) between 1 and 12000),
  -- Lo que el asistente propone hacer (planear una cita, agregar un plan o una peli…); la app lo muestra como botones
  acciones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists asistente_mensajes_usuario on public.asistente_mensajes (usuario_id, created_at);

alter table public.asistente_mensajes enable row level security;
drop policy if exists asistente_select on public.asistente_mensajes;
drop policy if exists asistente_insert on public.asistente_mensajes;
drop policy if exists asistente_delete on public.asistente_mensajes;
create policy asistente_select on public.asistente_mensajes for select to authenticated using (usuario_id = auth.uid());
create policy asistente_insert on public.asistente_mensajes for insert to authenticated with check (usuario_id = auth.uid());
create policy asistente_delete on public.asistente_mensajes for delete to authenticated using (usuario_id = auth.uid());

-- Cuántas preguntas lleva hoy (para el tope diario del costo)
create or replace function public.preguntas_al_asistente_hoy()
returns int
language sql security definer set search_path = public stable
as $$
  select count(*)::int from asistente_mensajes
   where usuario_id = auth.uid() and rol = 'user'
     and (created_at at time zone 'America/Bogota')::date = hoy_bogota();
$$;
revoke execute on function public.preguntas_al_asistente_hoy() from public, anon;
grant execute on function public.preguntas_al_asistente_hoy() to authenticated;

commit;
