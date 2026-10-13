-- 028_citas_con_sentido.sql
-- Que el asistente de citas no arme combinaciones raras (Monserrate + ir a cine).
--   · Cada idea dice a qué tipos de plan pertenece y en qué momentos del día tiene sentido.
--   · "Comodín" pasa a significar "sirve en cualquier lugar de su tipo de plan", no "en cualquier lugar".
--     Las ideas que necesitan un sitio concreto (cine, bolos, museo…) dejan de ser comodín
--     y quedan anotadas en los lugares donde sí se pueden hacer.
--   · Nada se borra; todo se puede corregir desde el panel de admin.

begin;

alter table public.actividades
  add column if not exists categorias text[] not null default '{}',
  add column if not exists franjas_permitidas uuid[];

-- Ideas que necesitan un sitio concreto: ya no salen en cualquier lugar
update public.actividades set es_comodin = false
  where nombre in ('Ir a cine', 'Bolos, arcade o algo de jugar', 'Karaoke', 'Librería y papelería', 'Vitrinear y antojarnos',
                   'Tarde de museo', 'Feria, mercado o evento', 'Juegos de mesa', 'Comida callejera');

-- Tipo de plan de cada idea
update public.actividades a set categorias = v.categorias
from (values
  ('Caminar sin rumbo', '{airelibre}'::text[]),
  ('Ver el atardecer', '{romantico,airelibre}'),
  ('Picnic', '{airelibre}'),
  ('Sesión de fotos juntos', '{romantico,airelibre}'),
  ('Plan de lluvia', '{casero}'),
  ('Juegos de mesa', '{casero}'),
  ('Almuerzo en un sitio nuevo', '{comida}'),
  ('Desayunar o almorzar afuera', '{comida}'),
  ('Café y postre', '{comida}'),
  ('Helado o postre', '{comida}'),
  ('Probar algo que nunca hayamos comido', '{comida}'),
  ('Comida callejera', '{comida}'),
  ('Vitrinear y antojarnos', '{comida}'),
  ('Cena en un restaurante especial', '{romantico,comida}'),
  ('Ir a cine', '{cultural}'),
  ('Tarde de museo', '{cultural}'),
  ('Librería y papelería', '{cultural}'),
  ('Feria, mercado o evento', '{cultural}'),
  ('Cena en el centro histórico', '{romantico,comida}'),
  ('Cena con vista', '{romantico,comida}'),
  ('Comer con vista a la ciudad', '{romantico,comida}'),
  ('Ver las luces de la ciudad', '{romantico}'),
  ('Ruta de cafés de especialidad', '{comida}'),
  ('Desayuno típico', '{comida}'),
  ('Probar frutas exóticas', '{comida}'),
  ('Mercado de flores', '{cultural}')
) as v(nombre, categorias)
where a.nombre = v.nombre;

-- Momentos del día en que cada idea tiene sentido (las que no están aquí sirven a cualquier hora)
update public.actividades a set franjas_permitidas = (
  select array_agg(f.id) from public.franjas f where f.nombre = any(v.franjas)
)
from (values
  ('Subir en teleférico y ver el atardecer', '{Atardecer}'::text[]),
  ('Ver el atardecer', '{Atardecer}'),
  ('Ver las luces de la ciudad', '{Noche}'),
  ('Cena con vista', '{Noche}'),
  ('Cena en el centro histórico', '{Noche}'),
  ('Cena en un restaurante especial', '{Noche}'),
  ('Obra, concierto u ópera', '{Noche}'),
  ('Noche de pelis con crispetas', '{Noche}'),
  ('Karaoke', '{Noche}'),
  ('Comer con vista a la ciudad', '{Tarde,Noche}'),
  ('Mercado de flores', '{Mañana}'),
  ('Desayuno típico', '{Mañana}'),
  ('Montar bici juntos', '{Mañana}'),
  ('Caminata por el cerro', '{Mañana}'),
  ('Probar frutas exóticas', '{Mañana,Tarde}'),
  ('Caminar alrededor del lago', '{Mañana,Tarde}'),
  ('Visitar la Biblioteca Virgilio Barco', '{Mañana,Tarde}'),
  ('Caminar por los jardines y el tropicario', '{Mañana,Tarde}'),
  ('Tour de grafitis', '{Mañana,Tarde}'),
  ('Ruta de cafés de especialidad', '{Mañana,Tarde}'),
  ('Desayunar o almorzar afuera', '{Mañana,Tarde}'),
  ('Picnic', '{Mañana,Tarde}'),
  ('Feria, mercado o evento', '{Mañana,Tarde}'),
  ('Tarde de museo', '{Mañana,Tarde}'),
  ('Almuerzo en un sitio nuevo', '{Tarde}'),
  ('Función bajo el domo', '{Tarde}'),
  ('Librería y papelería', '{Tarde}'),
  ('Chocolate santafereño con queso', '{Tarde,Atardecer}'),
  ('Café y postre', '{Tarde,Atardecer}'),
  ('Helado o postre', '{Tarde,Atardecer}'),
  ('Vitrinear y antojarnos', '{Tarde,Atardecer}'),
  ('Caminar sin rumbo', '{Mañana,Tarde,Atardecer}'),
  ('Sesión de fotos juntos', '{Mañana,Tarde,Atardecer}'),
  ('Comida callejera', '{Tarde,Atardecer,Noche}'),
  ('Ir a cine', '{Tarde,Atardecer,Noche}'),
  ('Bolos, arcade o algo de jugar', '{Tarde,Noche}'),
  ('Probar algo que nunca hayamos comido', '{Tarde,Noche}')
) as v(nombre, franjas)
where a.nombre = v.nombre;

-- Los parques que estaban sin tipo de plan (por eso no salían al escoger uno)
update public.lugares set categorias = '{airelibre}'
  where categorias = '{}' and not es_sorpresa and (nombre ilike 'Parque%' or nombre ilike 'Bosque%');

-- Un lugar para las ideas que se hacen bajo techo y no tenían dónde
insert into public.lugares (nombre, zona, descripcion, emoji, categorias, precio, duracion)
select 'Centro comercial', 'El que nos quede cerca', 'Cine, juegos, vitrinas y algo rico, todo bajo techo', '🛍️', '{cultural,comida}', 2, 'Medio día'
where not exists (select 1 from public.lugares where nombre = 'Centro comercial');

-- Una idea que le sirve a cualquier lugar por conocer
insert into public.actividades (nombre, descripcion, emoji, precio, es_comodin, categorias, creada_por)
select 'Conocer un sitio nuevo', 'Ir por fin a ese lugar que tenemos pendiente', '🧭', 2, true, '{romantico,airelibre,cultural,comida}', null
where not exists (select 1 from public.actividades where nombre = 'Conocer un sitio nuevo');

-- Cada idea, en los lugares donde sí se puede hacer
insert into public.lugar_actividad (lugar_id, actividad_id)
select l.id, a.id
from (values
  ('Centro comercial', 'Ir a cine'),
  ('Centro comercial', 'Bolos, arcade o algo de jugar'),
  ('Centro comercial', 'Vitrinear y antojarnos'),
  ('Centro comercial', 'Helado o postre'),
  ('Centro comercial', 'Librería y papelería'),
  ('Monserrate', 'Sesión de fotos juntos'),
  ('Miradores de La Calera', 'Ver el atardecer'),
  ('Parque Simón Bolívar', 'Ver el atardecer'),
  ('Parque Simón Bolívar', 'Sesión de fotos juntos'),
  ('Parque - El Tunal', 'Picnic'),
  ('Parque - El Tunal', 'Sesión de fotos juntos'),
  ('Parque - El Tunal', 'Ver el atardecer'),
  ('Bosque San Carlos', 'Picnic'),
  ('Bosque San Carlos', 'Sesión de fotos juntos'),
  ('Bosque San Carlos', 'Caminar sin rumbo'),
  ('Jardín Botánico de Bogotá', 'Sesión de fotos juntos'),
  ('Usaquén', 'Helado o postre'),
  ('Usaquén', 'Feria, mercado o evento'),
  ('Usaquén', 'Vitrinear y antojarnos'),
  ('Usaquén', 'Almuerzo en un sitio nuevo'),
  ('Usaquén', 'Caminar sin rumbo'),
  ('Zona G, Quinta Camacho y Chapinero Alto', 'Café y postre'),
  ('Zona G, Quinta Camacho y Chapinero Alto', 'Almuerzo en un sitio nuevo'),
  ('Zona G, Quinta Camacho y Chapinero Alto', 'Probar algo que nunca hayamos comido'),
  ('La Candelaria y el Centro', 'Caminar sin rumbo'),
  ('La Candelaria y el Centro', 'Comida callejera'),
  ('La Candelaria y el Centro', 'Librería y papelería'),
  ('La Candelaria y el Centro', 'Almuerzo en un sitio nuevo'),
  ('Plaza de mercado de Paloquemao', 'Probar algo que nunca hayamos comido'),
  ('En casa', 'Plan de lluvia')
) as v(lugar, actividad)
join public.lugares l on trim(l.nombre) = v.lugar
join public.actividades a on a.nombre = v.actividad
on conflict do nothing;

commit;
