-- 007_proteger_rol.sql
-- Cada uno puede editar su perfil (nombre), pero solo el admin puede cambiar un rol.
-- Desde el SQL Editor / scripts (sin sesión de usuario) se sigue pudiendo.

begin;

create or replace function public.proteger_rol()
returns trigger
language plpgsql
as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo el admin puede cambiar roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_rol on public.perfiles;
create trigger trg_proteger_rol
  before update on public.perfiles
  for each row execute function public.proteger_rol();

commit;
