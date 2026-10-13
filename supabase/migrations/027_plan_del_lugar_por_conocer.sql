-- 027_plan_del_lugar_por_conocer.sql
-- Cada lugar por conocer puede decir qué tipo de plan es (comer, café, parque…).
-- "Ármame una cita" solo usa los que lo tienen: así no arma combinaciones raras.

begin;

alter table public.lugares_por_conocer
  add column if not exists categoria_slug text references public.categorias_cita(slug) on delete set null;

commit;
