-- Mete las tablas de la app en la publicación supabase_realtime (citas, respuestas y el contador de "Pienso en ti").
-- Se aplica con # npm run db:sql -- scripts/realtime.sql; cambia la configuración de la base real.
alter publication supabase_realtime add table public.citas;
alter publication supabase_realtime add table public.respuestas;

-- Realtime para el contador de "Pienso en ti" (010)
alter publication supabase_realtime add table public.pensamientos;
