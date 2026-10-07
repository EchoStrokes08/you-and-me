-- 006_bloquear_registros.sql
-- La app es solo para nosotros dos: nadie más puede crear cuenta.
-- Segunda capa además de apagar "Allow new users to sign up" en el panel de Supabase.
--
-- Para agregar un usuario a propósito en el futuro (ej. desde Authentication → Add user):
--   alter table auth.users disable trigger bloquear_registros;
--   -- crear el usuario --
--   alter table auth.users enable trigger bloquear_registros;

begin;

create or replace function public.bloquear_registros()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Registros cerrados';
end;
$$;

drop trigger if exists bloquear_registros on auth.users;
create trigger bloquear_registros
  before insert on auth.users
  for each row execute function public.bloquear_registros();

commit;
