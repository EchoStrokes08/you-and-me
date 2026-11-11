-- 040_limpiar_habladas.sql
-- Botón del panel para sacar del mazo las preguntas que ya hablaron, sin esperar una migración.
-- Igual que en la 035 y la 039: las que ya tienen respuestas o salieron como pregunta del día no se
-- borran (se perderían las respuestas y el historial del daily): solo se apagan, así ya no vuelven
-- al mazo ni a la pregunta del día. Las demás se borran de la base.

begin;

create or replace function public.limpiar_preguntas_habladas()
returns table (borradas int, apagadas int)
language plpgsql security definer set search_path = public
as $$
declare
  n_borradas int;
  n_apagadas int;
begin
  if not es_admin() then raise exception 'Solo el admin puede limpiar el mazo'; end if;

  -- 1) Las que se pueden borrar sin perder nada (preguntas_conversadas se va con ellas en cascada)
  delete from preguntas p
   using preguntas_conversadas pc
   where pc.pregunta_id = p.id
     and not exists (select 1 from respuestas r where r.pregunta_id = p.id)
     and not exists (select 1 from pregunta_del_dia d where d.pregunta_id = p.id);
  get diagnostics n_borradas = row_count;

  -- 2) Las que tienen historia: se apagan y dejan de contar como habladas
  update preguntas p set activo = false
    from preguntas_conversadas pc
   where pc.pregunta_id = p.id and p.activo;
  get diagnostics n_apagadas = row_count;
  delete from preguntas_conversadas where true;

  return query select n_borradas, n_apagadas;
end;
$$;
revoke execute on function public.limpiar_preguntas_habladas() from public, anon;
grant execute on function public.limpiar_preguntas_habladas() to authenticated;

commit;
