-- 019_ideas_de_cita.sql
-- Ideas de cita más generales y de Bogotá, y la opción de que cualquiera de los dos proponga una.
--   · Nada se borra: lo que ya no aplica (pueblos, rumba, tragos) queda oculto (activo = false)
--     y se puede volver a mostrar desde el panel de admin.
--   · Las ideas generales son "comodín": sirven para cualquier lugar, incluido uno marcado en el mapa.
--   · Cualquiera de los dos puede agregar una idea propia desde el asistente de citas (queda como comodín).

begin;

-- Quién propuso la idea (las del catálogo original quedan sin autor)
alter table public.actividades
  add column if not exists creada_por uuid references public.perfiles(id) on delete set null default auth.uid();

drop policy if exists actividades_insert on public.actividades;
create policy actividades_insert on public.actividades for insert to authenticated
  with check (
    public.es_admin()
    or (creada_por = auth.uid() and es_comodin and not es_sorpresa and activo)
  );

-- Lugares fuera de Bogotá y de rumba: ocultos
update public.lugares set activo = false
  where nombre in ('Choachí', 'Guatavita', 'Suesca', 'Zipaquirá', 'Zona T y Zona Rosa', 'Andrés Carne de Res');

-- Actividades que dependían de esos lugares, o de tomar: ocultas
update public.actividades set activo = false
  where nombre in ('Cócteles', 'Caminata a la cascada La Chorrera', 'Caminata por las rocas',
                   'Escalada en roca con guía', 'Catedral de Sal', 'Termales', 'Recorrer el pueblo');

-- Ideas que estaban atadas a un solo sitio: ahora generales
update public.actividades set nombre = 'Tarde de museo', descripcion = 'El del Oro, el Botero, el MAMBO o la exposición que haya', es_comodin = true
  where nombre = 'Museo del Oro o Museo Botero';
update public.actividades set nombre = 'Ir a cine', descripcion = 'La que queramos ver, en la Cinemateca o en cualquier sala', es_comodin = true
  where nombre = 'Película de cine independiente';
update public.actividades set nombre = 'Desayunar o almorzar afuera', descripcion = 'Sin afán y en un sitio que no conozcamos', precio = 2, es_comodin = true
  where nombre = 'Brunch';
update public.actividades set descripcion = 'En casa o en un café de juegos: competencia sana y risas', es_comodin = true
  where nombre = 'Juegos de mesa';
update public.actividades set es_comodin = true
  where nombre in ('Café y postre', 'Picnic', 'Karaoke', 'Cena en un restaurante especial');

-- Ideas nuevas, para parchar en Bogotá
insert into public.actividades (nombre, descripcion, emoji, precio, es_comodin, orden, creada_por)
select v.nombre, v.descripcion, v.emoji, v.precio, true, 0, null
from (values
  ('Helado o postre', 'Antojo dulce y caminar un rato', '🍦', 1),
  ('Almuerzo en un sitio nuevo', 'Uno que tengamos pendiente o que se nos atraviese', '🍜', 2),
  ('Comida callejera', 'Empanadas, obleas, mazorca: lo que haya en el camino', '🌽', 1),
  ('Vitrinear y antojarnos', 'Centro comercial sin afán: mirar, probarnos cosas y comer algo', '🛍️', 2),
  ('Bolos, arcade o algo de jugar', 'El que pierda invita el postre', '🎳', 2),
  ('Feria, mercado o evento', 'Lo que haya ese fin de semana: Corferias, mercado de pulgas, un festival', '🎪', 2),
  ('Librería y papelería', 'Escogerle un libro o un detalle al otro', '📚', 2),
  ('Ver el atardecer', 'Buscar un buen punto y quedarnos hasta que oscurezca', '🌇', 1),
  ('Plan de lluvia', 'Si llueve: chocolate caliente y algo bajo techo', '☔', 1)
) as v(nombre, descripcion, emoji, precio)
where not exists (select 1 from public.actividades a where a.nombre = v.nombre);

commit;
