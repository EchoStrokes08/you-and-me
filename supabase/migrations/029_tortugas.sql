-- 029_tortugas.sql — Las tortugas entran como acompañante marino
alter table public.configuracion drop constraint if exists configuracion_componente_secundario_check;
alter table public.configuracion add constraint configuracion_componente_secundario_check
  check (componente_secundario in ('caballito_de_mar','medusa','pez_payaso','tortuga'));
