-- 002_respuestas_mapa_preguntas.sql
-- 1) Arregla la recursión infinita en la política de respuestas
-- 2) RPC para saber quién ya respondió sin revelar el contenido
-- 3) Citas con lugar elegido en el mapa
-- 4) Más preguntas y dos categorías nuevas

begin;

-- ============ 1) RESPUESTAS SIN RECURSIÓN ============
-- La política anterior consultaba public.respuestas dentro de su propia
-- política y Postgres respondía "infinite recursion detected in policy".
-- Una función security definer lee la tabla sin pasar por RLS.
create or replace function public.ya_respondi(p_pregunta_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.respuestas where pregunta_id = p_pregunta_id and usuario_id = auth.uid());
$$;

drop policy if exists respuestas_select on public.respuestas;
create policy respuestas_select on public.respuestas for select to authenticated
  using (usuario_id = auth.uid() or public.ya_respondi(pregunta_id));

-- ============ 2) ESTADO DE RESPUESTAS ============
-- Dice si yo y mi pareja ya respondimos, sin mostrar el texto.
create or replace function public.estado_respuestas(p_pregunta_id uuid)
returns table (yo boolean, pareja boolean)
language sql security definer set search_path = public stable
as $$
  select
    exists(select 1 from public.respuestas where pregunta_id = p_pregunta_id and usuario_id = auth.uid()),
    exists(select 1 from public.respuestas where pregunta_id = p_pregunta_id and usuario_id <> auth.uid());
$$;

grant execute on function public.ya_respondi(uuid) to authenticated;
grant execute on function public.estado_respuestas(uuid) to authenticated;

-- ============ 3) LUGAR DESDE EL MAPA ============
alter table public.citas add column if not exists lugar_personalizado text;
alter table public.citas add column if not exists lugar_direccion text;
alter table public.citas add column if not exists lugar_lat double precision;
alter table public.citas add column if not exists lugar_lng double precision;

-- ============ 4) MÁS PREGUNTAS ============
insert into public.categorias_preguntas (slug, nombre, emoji, color, orden) values
  ('nosotros', 'Nuestra relación', '💞', '#2F8F63', 7),
  ('queprefieres', '¿Qué prefieres?', '🤔', '#C3E08A', 8)
on conflict (slug) do nothing;

insert into public.preguntas (categoria_slug, texto)
select v.cat, v.txt
from (values
  -- conocernos
  ('conocernos', '¿Cuál es tu desayuno perfecto un domingo?'),
  ('conocernos', '¿Qué te pone de mal genio más rápido de lo que te gustaría?'),
  ('conocernos', '¿Qué es algo que te encantaba de niño o niña y ya no haces?'),
  ('conocernos', '¿Cuál es el mejor consejo que te han dado?'),
  ('conocernos', '¿Qué te gusta hacer cuando estás solo o sola?'),
  ('conocernos', '¿Qué palabra usas demasiado?'),
  ('conocernos', '¿Cuál es tu manía más rara?'),
  ('conocernos', '¿Qué te da paz al final de un día pesado?'),
  ('conocernos', '¿Qué persona te inspira y por qué?'),
  ('conocernos', '¿Qué es lo que más te gusta de tu trabajo o estudio?'),
  ('conocernos', '¿Cómo es tu forma favorita de recibir cariño?'),
  ('conocernos', '¿Qué cosa pequeña te hace sentir muy querido o querida?'),
  ('conocernos', '¿Qué estación o clima te pone de mejor humor?'),
  ('conocernos', '¿Qué te gustaría que la gente supiera de ti sin tener que decirlo?'),
  -- recuerdos
  ('recuerdos', '¿Qué recuerdas de nuestra primera conversación?'),
  ('recuerdos', '¿Qué fue lo que más te sorprendió de mí al conocerme mejor?'),
  ('recuerdos', '¿Cuál ha sido el momento en que más te has reído conmigo?'),
  ('recuerdos', '¿Qué mensaje mío guardarías para siempre?'),
  ('recuerdos', '¿Qué día nuestro te gustaría repetir con otro final?'),
  ('recuerdos', '¿Qué canción sonaba en un momento importante de los dos?'),
  ('recuerdos', '¿Cuándo sentiste que ya éramos un equipo?'),
  ('recuerdos', '¿Qué te dio nervios la primera vez que salimos?'),
  ('recuerdos', '¿Cuál ha sido nuestra pelea más tonta?'),
  ('recuerdos', '¿Qué detalle mío te sacó una sonrisa sin que yo lo supiera?'),
  -- sueños
  ('suenos', '¿Cómo te imaginas nuestra casa ideal?'),
  ('suenos', '¿Qué ciudad de Colombia quieres conocer conmigo?'),
  ('suenos', '¿Qué hábito te gustaría que tuviéramos juntos?'),
  ('suenos', '¿Qué quisieras celebrar conmigo dentro de un año?'),
  ('suenos', '¿Qué te gustaría aprender juntos?'),
  ('suenos', '¿Cómo sería nuestro viaje soñado sin límite de plata?'),
  ('suenos', '¿Qué cosa quieres que nunca cambie entre nosotros?'),
  ('suenos', '¿Qué proyecto loco te gustaría intentar conmigo?'),
  ('suenos', '¿Cómo te ves a los 60?'),
  ('suenos', '¿Qué parte de tu vida quieres que yo conozca más?'),
  -- divertidas
  ('divertidas', 'Si fuéramos personajes de una telenovela, ¿cómo se llamaría?'),
  ('divertidas', '¿Qué haríamos si nos quedáramos encerrados en un centro comercial toda la noche?'),
  ('divertidas', 'Si pudieras ser experto en algo de la noche a la mañana, ¿qué sería?'),
  ('divertidas', '¿Qué emoji nos representa como pareja?'),
  ('divertidas', 'Si tuvieras un programa de televisión, ¿de qué sería?'),
  ('divertidas', 'Si fueras una ballena, ¿cómo se llamaría tu canción?'),
  ('divertidas', '¿Cuál sería tu nombre de luchador o luchadora?'),
  ('divertidas', 'Si pudiéramos vivir en cualquier época, ¿cuál escogerías?'),
  ('divertidas', '¿Qué objeto de tu casa tendría más cosas que contar si hablara?'),
  ('divertidas', 'Si fuéramos un postre, ¿cuál seríamos?'),
  -- profundas
  ('profundas', '¿Qué te hace sentir que estás creciendo como persona?'),
  ('profundas', '¿Cuándo fue la última vez que lloraste y por qué?'),
  ('profundas', '¿Qué parte de ti te costó más querer?'),
  ('profundas', '¿Qué necesitas de mí cuando estás triste?'),
  ('profundas', '¿Qué creencia tuya ha cambiado en los últimos años?'),
  ('profundas', '¿Qué significa para ti sentirte en casa?'),
  ('profundas', '¿Qué conversación pendiente tienes contigo?'),
  ('profundas', '¿Qué te gustaría que recordaran de ti?'),
  ('profundas', '¿Cómo sabes que estás siendo tú de verdad?'),
  ('profundas', '¿Qué miedo tuyo crees que yo no conozco?'),
  -- coquetas
  ('coquetas', '¿Qué ropa mía te encanta?'),
  ('coquetas', '¿Cuál es tu recuerdo favorito de un beso nuestro?'),
  ('coquetas', '¿Qué cita romántica te gustaría que te sorprendiera?'),
  ('coquetas', '¿Qué parte del día prefieres para estar conmigo?'),
  ('coquetas', '¿Qué te gustaría que te dijera más seguido?'),
  ('coquetas', '¿Qué canción te pone en modo romántico conmigo?'),
  ('coquetas', '¿Qué es lo primero que piensas cuando me ves?'),
  ('coquetas', '¿Qué apodo nuevo me pondrías?'),
  -- nosotros (nuevo)
  ('nosotros', '¿Qué estamos haciendo muy bien como pareja?'),
  ('nosotros', '¿Qué podríamos mejorar sin que sea un drama?'),
  ('nosotros', '¿Cómo te gusta que arreglemos las cosas después de una discusión?'),
  ('nosotros', '¿Qué necesitas más de mí este mes?'),
  ('nosotros', '¿Qué te hizo sentir más amado o amada esta semana?'),
  ('nosotros', '¿Qué ritual nuestro no quieres que se pierda nunca?'),
  ('nosotros', '¿En qué momento te sientes más cerca de mí?'),
  ('nosotros', '¿Cómo podemos cuidarnos mejor cuando estamos estresados?'),
  ('nosotros', '¿Qué te gustaría que hiciéramos más seguido?'),
  ('nosotros', '¿Qué cosa mía te da tranquilidad?'),
  ('nosotros', '¿Cómo te gustaría que celebráramos los logros del otro?'),
  ('nosotros', '¿Qué aprendiste de ti estando conmigo?'),
  ('nosotros', '¿Qué promesa pequeña te gustaría que nos hiciéramos?'),
  ('nosotros', '¿Qué es lo que más admiras de cómo somos juntos?'),
  ('nosotros', '¿Qué límite tuyo quieres que siempre respete?'),
  ('nosotros', '¿Cómo te gusta que te pida perdón?'),
  -- ¿qué prefieres? (nuevo)
  ('queprefieres', '¿Playa o montaña para nuestro próximo viaje?'),
  ('queprefieres', '¿Cena elegante o pizza en pijama?'),
  ('queprefieres', '¿Madrugar para ver el amanecer o trasnochar viendo estrellas?'),
  ('queprefieres', '¿Viajar a muchos lugares rápido o pocos con calma?'),
  ('queprefieres', '¿Una carta escrita a mano o una canción dedicada?'),
  ('queprefieres', '¿Cocinar juntos o pedir domicilio y ver una película?'),
  ('queprefieres', '¿Lluvia en casa o sol en un parque?'),
  ('queprefieres', '¿Sorpresas o planes bien organizados?'),
  ('queprefieres', '¿Perro o gato?'),
  ('queprefieres', '¿Ver ballenas en el Pacífico o auroras boreales?'),
  ('queprefieres', '¿Ajiaco o bandeja paisa?'),
  ('queprefieres', '¿Bailar salsa toda la noche o karaoke hasta perder la voz?'),
  ('queprefieres', '¿Vivir en el campo o en la ciudad?'),
  ('queprefieres', '¿Saber el futuro o poder cambiar el pasado?'),
  ('queprefieres', '¿Un viaje en carretera sin rumbo o un plan perfecto en avión?'),
  ('queprefieres', '¿Museo de día o concierto de noche?')
) as v(cat, txt)
where not exists (select 1 from public.preguntas p where p.texto = v.txt);

commit;
