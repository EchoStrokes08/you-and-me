-- 023_personalizacion_mascotas.sql — Personalización de componentes marinos (Primarios y Secundarios)
alter table public.configuracion
  add column if not exists componente_primario text not null default 'ballena',
  add column if not exists componente_secundario text not null default 'medusa';

-- Permitir actualización de configuracion a usuarios autenticados para que ambos puedan cambiar la personalización si lo desean
drop policy if exists config_update on public.configuracion;
create policy config_update on public.configuracion for update to authenticated using (true) with check (true);
