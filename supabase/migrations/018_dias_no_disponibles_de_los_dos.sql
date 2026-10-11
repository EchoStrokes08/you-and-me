-- 018_dias_no_disponibles_de_los_dos.sql
-- Los dos pueden marcar los días que no pueden (antes solo el admin).
--   · Cada día bloqueado guarda quién lo marcó; cada uno agrega y quita solo los suyos.
--   · Un día bloqueado por cualquiera de los dos sigue sin poderse escoger al planear una cita.

begin;

alter table public.fechas_no_disponibles
  add column if not exists creado_por uuid references public.perfiles(id) on delete cascade default auth.uid();

-- Los días que ya estaban eran del admin
update public.fechas_no_disponibles
  set creado_por = (select id from public.perfiles where rol = 'admin' limit 1)
  where creado_por is null;

alter table public.fechas_no_disponibles alter column creado_por set not null;

-- El mismo día lo pueden bloquear los dos, cada uno por su lado
alter table public.fechas_no_disponibles drop constraint if exists fechas_no_disponibles_pkey;
alter table public.fechas_no_disponibles add primary key (fecha, creado_por);

drop policy if exists fechas_no_disponibles_insert on public.fechas_no_disponibles;
drop policy if exists fechas_no_disponibles_update on public.fechas_no_disponibles;
drop policy if exists fechas_no_disponibles_delete on public.fechas_no_disponibles;

create policy fechas_no_disponibles_insert on public.fechas_no_disponibles for insert to authenticated
  with check (creado_por = auth.uid());
create policy fechas_no_disponibles_delete on public.fechas_no_disponibles for delete to authenticated
  using (creado_por = auth.uid());

commit;
