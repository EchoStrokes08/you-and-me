-- 017_aceptar_invitacion.sql
-- Cuando él crea la cita, ella es quien la acepta (o dice que no puede).
--   · Quien NO creó una cita pendiente puede pasarla a 'confirmada' o 'cancelada'.

begin;

drop policy if exists citas_aceptar on public.citas;
create policy citas_aceptar on public.citas for update to authenticated
  using (creada_por <> auth.uid() and estado = 'pendiente')
  with check (creada_por <> auth.uid() and estado in ('confirmada', 'cancelada'));

commit;
