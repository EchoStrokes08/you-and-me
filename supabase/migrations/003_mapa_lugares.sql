-- 003_mapa_lugares.sql
-- Coordenadas para la sección "Nuestros lugares"

begin;

alter table public.lugares add column if not exists lat double precision;
alter table public.lugares add column if not exists lng double precision;
alter table public.recuerdos add column if not exists lat double precision;
alter table public.recuerdos add column if not exists lng double precision;

-- Ubicaciones aproximadas de los lugares del catálogo (se ajustan desde Admin → Catálogos).
-- Los que no tienen un punto fijo (Ciclovía, Cancha de tejo, En casa, Sorpréndeme) quedan sin coordenadas.
update public.lugares l set lat = v.lat, lng = v.lng
from (values
  ('Andrés Carne de Res', 4.8618, -74.0329),
  ('Choachí', 4.5283, -73.9236),
  ('Cinemateca de Bogotá', 4.6066, -74.0697),
  ('Guatavita', 4.9364, -73.8331),
  ('Jardín Botánico de Bogotá', 4.6687, -74.0995),
  ('La Candelaria y el Centro', 4.5964, -74.0733),
  ('Miradores de La Calera', 4.6948, -74.0012),
  ('Monserrate', 4.6057, -74.0557),
  ('Parque Simón Bolívar', 4.6580, -74.0939),
  ('Planetario de Bogotá', 4.6121, -74.0687),
  ('Plaza de mercado de Paloquemao', 4.6158, -74.0845),
  ('Quebrada La Vieja', 4.6553, -74.0512),
  ('Suesca', 5.1031, -73.7989),
  ('Teatro Colón o Teatro Mayor', 4.5975, -74.0745),
  ('Usaquén', 4.6950, -74.0306),
  ('Zipaquirá', 5.0189, -74.0104),
  ('Zona G, Quinta Camacho y Chapinero Alto', 4.6530, -74.0570),
  ('Zona T y Zona Rosa', 4.6670, -74.0530)
) as v(nombre, lat, lng)
where l.nombre = v.nombre and l.lat is null;

commit;
