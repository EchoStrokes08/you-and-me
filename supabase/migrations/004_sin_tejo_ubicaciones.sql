-- 004_sin_tejo_ubicaciones.sql
-- 1) No jugamos tejo: se ocultan el lugar y la actividad (se pueden reactivar desde Admin)
-- 2) Ubicaciones del catálogo verificadas con OpenStreetMap (Nominatim), reemplazan las aproximadas de 003

begin;

update public.lugares set activo = false where nombre = 'Cancha de tejo';
update public.actividades set activo = false where nombre = 'Jugar tejo con cerveza y mechas';

update public.lugares l set lat = v.lat, lng = v.lng
from (values
  ('Andrés Carne de Res', 4.85402, -74.06518),                        -- Calle 3 # 11A-56, Chía
  ('Choachí', 4.53268, -73.92348),                                    -- casco urbano
  ('Cinemateca de Bogotá', 4.60325, -74.06758),                       -- Av. Carrera 3
  ('Guatavita', 4.93440, -73.83530),                                  -- pueblo
  ('Jardín Botánico de Bogotá', 4.66790, -74.10009),
  ('La Candelaria y el Centro', 4.59817, -74.07600),                  -- Plaza de Bolívar
  ('Miradores de La Calera', 4.66217, -74.01023),                     -- Alto de Patios
  ('Monserrate', 4.60562, -74.05549),                                 -- Basílica
  ('Parque Simón Bolívar', 4.65875, -74.09413),
  ('Planetario de Bogotá', 4.61206, -74.06882),
  ('Plaza de mercado de Paloquemao', 4.61628, -74.08421),
  ('Quebrada La Vieja', 4.64295, -74.04089),                          -- sendero
  ('Suesca', 5.10334, -73.79901),
  ('Teatro Colón o Teatro Mayor', 4.59668, -74.07442),                -- Teatro Colón
  ('Usaquén', 4.69517, -74.03094),                                    -- Plaza de Usaquén
  ('Zipaquirá', 5.01871, -74.01033),                                  -- Catedral de Sal
  ('Zona G, Quinta Camacho y Chapinero Alto', 4.65150, -74.05566),
  ('Zona T y Zona Rosa', 4.66884, -74.05347)
) as v(nombre, lat, lng)
where l.nombre = v.nombre;

commit;
