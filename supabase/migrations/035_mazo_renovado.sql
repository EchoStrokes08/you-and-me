-- 035_mazo_renovado.sql
-- Las preguntas del mazo que ya hablaron salen de la base y entran nuevas en su lugar.
-- Las que ya tienen respuestas o salieron como pregunta del día no se borran (se perderían las respuestas
-- y el historial): solo se apagan, así ya no vuelven al mazo ni a la pregunta del día.
-- No repite ninguna de las que ya existen: solo inserta las que no están.

begin;

-- 1) Las ya habladas que se pueden borrar sin perder nada
delete from public.preguntas p
using public.preguntas_conversadas pc
where pc.pregunta_id = p.id
  and not exists (select 1 from public.respuestas r where r.pregunta_id = p.id)
  and not exists (select 1 from public.pregunta_del_dia d where d.pregunta_id = p.id);

-- 2) Las que quedan habladas tienen historia: se apagan y dejan de contar como habladas
update public.preguntas p set activo = false
from public.preguntas_conversadas pc
where pc.pregunta_id = p.id;
delete from public.preguntas_conversadas;

-- 3) Preguntas nuevas
insert into public.preguntas (categoria_slug, texto)
select v.categoria_slug, v.texto
from (values
  ('conocernos', '¿Qué es lo que más te gusta de tu forma de ser?'),
  ('conocernos', '¿Qué hábito tuyo te gustaría que se me pegara?'),
  ('conocernos', '¿A qué le tenías miedo de niño o niña que ahora te da risa?'),
  ('conocernos', '¿Qué cosa de tu rutina no cambiarías por nada?'),
  ('conocernos', '¿Cuál es el regalo más bonito que te han dado?'),
  ('conocernos', '¿Qué te gustaba coleccionar de pequeño o pequeña?'),
  ('conocernos', '¿Qué tienes en tu cuarto que me contaría mucho de ti?'),
  ('conocernos', '¿Qué es algo que te pone nervioso o nerviosa aunque parezca bobo?'),
  ('conocernos', '¿Qué domingo de tu vida repetirías tal cual?'),
  ('conocernos', '¿Qué te gustaría aprender si tuvieras tiempo de sobra?'),

  ('coquetas', '¿Qué hago que te da ganas de besarme en ese mismo instante?'),
  ('coquetas', '¿Qué foto mía es tu favorita y por qué?'),
  ('coquetas', '¿Qué fue lo que más te gustó de nuestra última cita?'),
  ('coquetas', '¿Qué parte de mi voz te gusta más?'),
  ('coquetas', '¿Cuál es el abrazo nuestro que más recuerdas?'),
  ('coquetas', '¿Qué nota de amor te gustaría encontrarte escondida?'),
  ('coquetas', '¿Qué cosa mía te parece tierna aunque a mí me dé pena?'),
  ('coquetas', '¿Cómo sería para ti una noche perfecta los dos solitos?'),
  ('coquetas', '¿Qué te pondrías para sorprenderme en una cita?'),
  ('coquetas', '¿Qué me dirías ahora mismo al oído?'),
  ('coquetas', '¿Qué es lo primero que te provoca hacer cuando nos vemos después de días?'),

  ('divertidas', 'Si pudieras inventar un día festivo, ¿qué se celebraría?'),
  ('divertidas', '¿Qué serías capaz de hacer por una arepa con queso a las 3 de la mañana?'),
  ('divertidas', 'Si fuéramos un dúo de cantantes, ¿cómo nos llamaríamos?'),
  ('divertidas', '¿Qué electrodoméstico serías y por qué?'),
  ('divertidas', 'Si te volvieras invisible una tarde en Bogotá, ¿qué harías?'),
  ('divertidas', 'Si nuestra pelea más boba fuera una película, ¿cómo se llamaría?'),
  ('divertidas', '¿Qué personaje de caricatura se parece más a mí?'),
  ('divertidas', 'Si pudieras meter un sabor nuevo a las empanadas, ¿cuál sería?'),
  ('divertidas', '¿Qué récord mundial podríamos romper juntos?'),
  ('divertidas', 'Si tu mascota pudiera hablar, ¿qué secreto tuyo contaría primero?'),
  ('divertidas', 'Si una ballena te invitara a viajar con ella un día, ¿a dónde le pedirías que te llevara?'),
  ('divertidas', '¿Qué haríamos si mañana amaneciéramos con 80 años?'),

  ('profundas', '¿Qué te ha enseñado nuestra relación de ti mismo o de ti misma?'),
  ('profundas', '¿Qué promesa te hiciste y todavía estás cumpliendo?'),
  ('profundas', '¿Qué te gustaría sanar este año?'),
  ('profundas', '¿Cuándo te has sentido más orgulloso u orgullosa de nosotros?'),
  ('profundas', '¿Qué cosa de tu infancia sigue influyendo en cómo amas?'),
  ('profundas', '¿Qué haces cuando sientes que no eres suficiente?'),
  ('profundas', '¿Qué necesitas para sentirte en paz contigo?'),
  ('profundas', '¿Qué conversación difícil te alegra haber tenido?'),
  ('profundas', '¿Qué te gustaría que nunca cambiara entre nosotros?'),
  ('profundas', '¿Qué sueño soltaste y cómo te sentiste al hacerlo?')
) as v(categoria_slug, texto)
where not exists (select 1 from public.preguntas p where p.texto = v.texto);

commit;
