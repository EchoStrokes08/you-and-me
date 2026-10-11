-- 024_pensamientos_cada_segundo_y_medio.sql — "Pienso en ti": el límite baja de 10 segundos a 1,5
create or replace function public.limitar_pensamientos()
returns trigger
language plpgsql
as $$
begin
  if exists(select 1 from public.pensamientos where de = new.de and created_at > now() - interval '1.5 seconds') then
    raise exception 'Espera un momentico 💚';
  end if;
  return new;
end;
$$;
