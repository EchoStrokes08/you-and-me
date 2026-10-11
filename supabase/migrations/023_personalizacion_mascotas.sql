-- 023_personalizacion_mascotas.sql — Personalización de componentes marinos (Primarios y Secundarios)
alter table public.configuracion
  add column if not exists componente_primario text not null default 'ballena',
  add column if not exists componente_secundario text not null default 'medusa';

alter table public.configuracion drop constraint if exists configuracion_componente_primario_check;
alter table public.configuracion add constraint configuracion_componente_primario_check
  check (componente_primario in ('ballena','tiburon_ballena','cachalote','orca'));
alter table public.configuracion drop constraint if exists configuracion_componente_secundario_check;
alter table public.configuracion add constraint configuracion_componente_secundario_check
  check (componente_secundario in ('caballito_de_mar','medusa','pez_payaso'));

-- Los dos pueden cambiar las mascotas, pero el resto de configuracion sigue siendo solo del admin:
-- por eso va por función y no abriendo la política config_update.
create or replace function public.guardar_mascotas(p_primario text default null, p_secundario text default null)
returns void
language sql security definer set search_path = public
as $$
  update public.configuracion
     set componente_primario = coalesce(p_primario, componente_primario),
         componente_secundario = coalesce(p_secundario, componente_secundario)
   where id = 1 and auth.uid() is not null;
$$;

revoke all on function public.guardar_mascotas(text, text) from public, anon;
grant execute on function public.guardar_mascotas(text, text) to authenticated;
