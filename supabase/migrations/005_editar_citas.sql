-- 005_editar_citas.sql
-- Permite corregir una cita ya confirmada.
--   · Admin: puede editar cualquier cita (ya podía).
--   · Quien la creó: puede editar su cita pendiente o confirmada, pero al guardar
--     debe quedar 'pendiente' (vuelve a "Por confirmar") o 'cancelada'.

begin;

drop policy if exists citas_update on public.citas;
create policy citas_update on public.citas for update to authenticated
  using (public.es_admin() or (creada_por = auth.uid() and estado in ('pendiente', 'confirmada')))
  with check (public.es_admin() or (creada_por = auth.uid() and estado in ('pendiente', 'cancelada')));

-- Marca de "esta cita se modificó después de confirmarse"
alter table public.citas add column if not exists modificada boolean not null default false;

commit;
