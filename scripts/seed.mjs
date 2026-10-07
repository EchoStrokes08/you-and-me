// Genera supabase/seed.sql a partir de los datos de contenido.
import fs from 'node:fs';

const esc = (s) => (s == null ? 'null' : `'${String(s).replaceAll("'", "''")}'`);
const maps = (nombre, municipio) =>
  `'https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nombre + ' ' + municipio)}'`;

const out = [];
out.push('-- seed.sql — Datos iniciales');
out.push('begin;');

// ---- Categorías de cita ----
const cats = [
  ['romantico', 'Romántico', '💕', '#F2B8A0', 'Planes para enamorarse', 1],
  ['airelibre', 'Aire libre', '🌿', '#8FB39A', 'Naturaleza y ciudad', 2],
  ['cultural', 'Cultural', '🎭', '#7FB5B5', 'Arte, museos y teatro', 3],
  ['comida', 'Comida rica', '🍽️', '#D9A05B', 'Sabores para compartir', 4],
  ['rumba', 'Rumba', '💃', '#C9896B', 'Noche y alegría', 5],
  ['casero', 'Plan casero', '🛋️', '#A8D5BA', 'Calienticos en casa', 6],
  ['escapada', 'Escapada', '🚗', '#7A9E7E', 'Pueblitos cerca de Bogotá', 7],
];
for (const [slug, nombre, emoji, color, descripcion, orden] of cats) {
  out.push(`insert into public.categorias_cita (slug,nombre,emoji,color,descripcion,orden) values (${esc(slug)},${esc(nombre)},${esc(emoji)},${esc(color)},${esc(descripcion)},${orden}) on conflict (slug) do nothing;`);
}

// ---- Actividades ----
// [nombre, descripcion, emoji, precio, dias_permitidos, nota, es_comodin]
const acts = {
  teleferico: ['Subir en teleférico y ver el atardecer', 'Vista increíble de la ciudad al caer el sol', '🚡', 2, null, null, false],
  sendero: ['Subir a pie por el sendero', 'Caminata con esfuerzo y recompensa visual', '🥾', 1, null, 'Temprano; verificar horario', false],
  comerVista: ['Comer con vista a la ciudad', 'Almuerzo o comida con panorama de Bogotá', '🍽️', 3, null, null, false],
  luces: ['Ver las luces de la ciudad', 'La noche bogotana desde las alturas', '🌃', 1, null, null, false],
  cenaVista: ['Cena con vista', 'Cena romántica mirando las luces', '🕯️', 4, null, null, false],
  pulgas: ['Mercado de pulgas', 'Tesoros, antigüedades y buen ambiente', '🧺', 1, [0], 'Domingos y festivos', false],
  cenaCentro: ['Cena en el centro histórico', 'Restaurante con historia en Usaquén', '🍝', 3, null, null, false],
  cafePostre: ['Café y postre', 'Una pausa dulce de media tarde', '🍰', 2, null, null, false],
  grafitis: ['Tour de grafitis', 'Arte callejero en La Candelaria', '🎨', 1, null, 'Verificar horarios del tour', false],
  museo: ['Museo del Oro o Museo Botero', 'Clásicos bogotanos para una mañana cultural', '🏛️', 2, null, 'Verificar días de apertura', false],
  chocolate: ['Chocolate santafereño con queso', 'Tradición caliente del centro', '☕', 1, null, null, false],
  cenaEspecial: ['Cena en un restaurante especial', 'Una fecha para recordar', '🍷', 4, null, null, false],
  brunch: ['Brunch', 'Desayuno-almuerzo sin afán', '🥐', 3, null, null, false],
  cafes: ['Ruta de cafés de especialidad', 'El mejor café de la ciudad, taza a taza', '☕', 2, null, null, false],
  flores: ['Mercado de flores', 'Color y olor a Bogotá a primera hora', '🌸', 1, null, 'Muy temprano en la mañana', false],
  frutas: ['Probar frutas exóticas', 'Pitahaya, lulo, uchuva y más', '🍓', 1, null, null, false],
  desayunoTipico: ['Desayuno típico', 'Caldo de costilla y arepa con queso', '🍲', 2, null, null, false],
  jardines: ['Caminar por los jardines y el tropicario', 'Un respiro verde en la ciudad', '🌿', 2, null, null, false],
  picnic: ['Picnic', 'Manta, snacks y risas al aire libre', '🧺', 1, null, null, false],
  lago: ['Caminar alrededor del lago', 'Paseo tranquilo con vista al agua', '🚶', 1, null, null, false],
  biblio: ['Visitar la Biblioteca Virgilio Barco', 'Un edificio hermoso para perderse', '📚', 1, null, null, false],
  bici: ['Montar bici juntos', 'La ciclovía más famosa del mundo', '🚴', 1, [0], 'Domingos y festivos en la mañana', false],
  quebrada: ['Caminata por el cerro', 'Naturaleza y trocha en La Vieja', '🥾', 1, null, 'Requiere registro previo; verificar días y horario', false],
  domo: ['Función bajo el domo', 'Planetario en pantalla gigante', '🔭', 2, null, null, false],
  obra: ['Obra, concierto u ópera', 'Noche elegante en el Colón o el Mayor', '🎭', 3, null, null, false],
  pelicula: ['Película de cine independiente', 'Cine con alma en la Cinemateca', '🎬', 2, null, null, false],
  andarés: ['Cenar y bailar hasta tarde', 'El clásico de la sabana', '🪩', 4, null, null, false],
  salsa: ['Bailar salsa', 'Pista y sabor en la Zona T', '💃', 3, null, null, false],
  karaoke: ['Karaoke', 'Cantar a pulmón abierto', '🎤', 3, null, null, false],
  cocteles: ['Cócteles', 'Brindis y buena conversación', '🍸', 3, null, null, false],
  tejo: ['Jugar tejo con cerveza y mechas', 'El deporte nacional, versión íntima', '🎯', 2, null, null, false],
  catedral: ['Catedral de Sal', 'Maravilla subterránea de Zipaquirá', '⛪', 2, null, null, false],
  almuerzoPueblo: ['Almorzar en el pueblo', 'Plato típico en la plaza de Zipaquirá', '🍲', 2, null, null, false],
  laguna: ['Caminata a la laguna sagrada', 'Camino empedrado hacia el agua', '🏞️', 2, null, 'Verificar horario', false],
  puebloGuatavita: ['Recorrer el pueblo', 'Calles empedradas y artesanías', '🏘️', 1, null, null, false],
  escalada: ['Escalada en roca con guía', 'Aventura con seguridad en Suesca', '🧗', 3, null, null, false],
  rocas: ['Caminata por las rocas', 'Paisaje de otro mundo', '🪨', 1, null, null, false],
  chorrera: ['Caminata a la cascada La Chorrera', 'La cascada más alta de Cundinamarca', '💦', 2, null, null, false],
  termales: ['Termales', 'Aguas calientes para relajarse', '♨️', 2, null, null, false],
  cocinar: ['Cocinar juntos', 'Receta nueva y postre obligatorio', '🍳', 1, null, null, false],
  pelis: ['Noche de pelis con crispetas', 'Maratón con manta y chocolate', '🍿', 1, null, null, false],
  juegos: ['Juegos de mesa', 'Competencia sana y risas', '🎲', 1, null, null, false],
  spa: ['Spa en casa', 'Mascarillas, velas y calma', '🧖', 1, null, null, false],
  karaokeCasa: ['Karaoke en casa', 'El concierto más cucho y bonito', '🎤', 1, null, null, false],
  fotosJuntos: ['Sesión de fotos juntos', 'Selfies o cámara, pero juntos', '📸', 1, null, null, true],
  cafeCharla: ['Café y charla larga', 'Sin afán, solo nosotros', '☕', 1, null, null, true],
  caminar: ['Caminar sin rumbo', 'La ciudad se descubre a pie', '🚶', 1, null, null, true],
  probar: ['Probar algo que nunca hayamos comido', 'Aventura comestible', '🌮', 2, null, null, true],
};

for (const [nombre, descripcion, emoji, precio, dias, nota, comodin] of Object.values(acts)) {
  const comodinSql = comodin ? 'true' : 'false';
  const diasSql = dias ? `'{${dias.join(',')}}'` : 'null';
  out.push(`insert into public.actividades (nombre,descripcion,emoji,precio,dias_permitidos,nota,es_comodin) values (${esc(nombre)},${esc(descripcion)},${esc(emoji)},${precio},${diasSql},${esc(nota)},${comodinSql}) on conflict do nothing;`);
}

// ---- Lugares ----
// [nombre, zona, categorias[], descripcion, emoji, precio, duracion, municipio, actividades[], es_escapada]
const places = [
  ['Monserrate', 'Cerros orientales', ['romantico','airelibre'], 'El cerro más famoso de Bogotá', '⛰️', 2, 'Medio día', 'Bogotá', ['teleferico','sendero','comerVista'], false],
  ['Miradores de La Calera', 'Vía a La Calera (≈30 min)', ['romantico','comida'], 'Vistas espectaculares sobre la ciudad', '🌄', 3, 'Noche', 'La Calera', ['luces','cenaVista'], false],
  ['Usaquén', 'Norte', ['romantico','comida','cultural'], 'Barrio colonial con mucho encanto', '🏘️', 2, 'Medio día', 'Bogotá', ['pulgas','cenaCentro','cafePostre'], false],
  ['La Candelaria y el Centro', 'Centro histórico', ['cultural'], 'Colonias, iglesias y arte', '🏛️', 1, 'Medio día', 'Bogotá', ['grafitis','museo','chocolate'], false],
  ['Zona G, Quinta Camacho y Chapinero Alto', 'Chapinero', ['comida','romantico'], 'Restaurantes y cafés de otro nivel', '🍴', 4, 'Noche', 'Bogotá', ['cenaEspecial','brunch','cafes'], false],
  ['Plaza de mercado de Paloquemao', 'Centro', ['comida','cultural'], 'El mercado más sabroso de la ciudad', '🛒', 1, 'Mañana', 'Bogotá', ['flores','frutas','desayunoTipico'], false],
  ['Jardín Botánico de Bogotá', 'Occidente (Calle 63 con Av. 68)', ['airelibre','romantico'], 'Más de 20 hectáreas de naturaleza', '🌺', 2, 'Medio día', 'Bogotá', ['jardines'], false],
  ['Parque Simón Bolívar', 'Teusaquillo', ['airelibre'], 'El pulmón verde de Bogotá', '🌳', 1, 'Medio día', 'Bogotá', ['picnic','lago','biblio'], false],
  ['Ciclovía', 'Varias vías', ['airelibre'], 'Bogotá se llena de bici y risas', '🚴', 1, 'Mañana', 'Bogotá', ['bici'], false],
  ['Quebrada La Vieja', 'Cerros orientales (Chapinero)', ['airelibre'], 'Senderismo cerca a casa', '🥾', 1, 'Mañana', 'Bogotá', ['quebrada'], false],
  ['Planetario de Bogotá', 'Centro', ['cultural','romantico'], 'El universo en pantalla gigante', '🔭', 2, 'Un par de horas', 'Bogotá', ['domo'], false],
  ['Teatro Colón o Teatro Mayor', 'Centro o Suba', ['cultural','romantico'], 'Noches de gala y buen arte', '🎭', 3, 'Noche', 'Bogotá', ['obra'], false],
  ['Cinemateca de Bogotá', 'Centro', ['cultural'], 'Cine de culto y conversación', '🎬', 2, 'Un par de horas', 'Bogotá', ['pelicula'], false],
  ['Andrés Carne de Res', 'Chía (≈45 min)', ['rumba','comida'], 'El plan de rumba por excelencia', '🥩', 4, 'Noche larga', 'Chía', ['andarés'], false],
  ['Zona T y Zona Rosa', 'Norte', ['rumba'], 'Bares y buena energía', '🎉', 3, 'Noche', 'Bogotá', ['salsa','karaoke','cocteles'], false],
  ['Cancha de tejo', 'Varias zonas', ['rumba'], 'Tradición y puntería', '🎯', 2, 'Un par de horas', 'Bogotá', ['tejo'], false],
  ['Zipaquirá', 'A ≈1 h de Bogotá', ['escapada','cultural'], 'La ciudad blanca', '⛪', 3, 'Día completo', 'Zipaquirá', ['catedral','almuerzoPueblo'], true],
  ['Guatavita', 'A ≈1 h 30 de Bogotá', ['escapada','airelibre'], 'Laguna sagrada y pueblo colonial', '🏞️', 3, 'Día completo', 'Guatavita', ['laguna','puebloGuatavita'], true],
  ['Suesca', 'A ≈1 h 30 de Bogotá', ['escapada','airelibre'], 'Rocas y aventura', '🧗', 3, 'Día completo', 'Suesca', ['escalada','rocas'], true],
  ['Choachí', 'A ≈1 h de Bogotá', ['escapada','airelibre'], 'Cascada y termales', '💦', 3, 'Día completo', 'Choachí', ['chorrera','termales'], true],
  ['En casa', 'Casa', ['casero'], 'El mejor plan: nosotros dos', '🏠', 1, 'Noche', 'Bogotá', ['cocinar','pelis','juegos','spa','karaokeCasa'], false],
];

for (const [nombre, zona, cats2, descripcion, emoji, precio, duracion, municipio, acts2, escapada] of places) {
  const catsArr = `'{${cats2.join(',')}}'`;
  out.push(`insert into public.lugares (nombre,zona,categorias,descripcion,emoji,precio,duracion,link_maps,es_escapada) values (${esc(nombre)},${esc(zona)},${catsArr},${esc(descripcion)},${esc(emoji)},${precio},${esc(duracion)},${maps(nombre, municipio)},${escapada}) on conflict do nothing;`);
  // vincular actividades por nombre
  for (const k of acts2) {
    const [an] = acts[k];
    out.push(`insert into public.lugar_actividad (lugar_id, actividad_id) select l.id, a.id from public.lugares l, public.actividades a where l.nombre = ${esc(nombre)} and a.nombre = ${esc(an)} on conflict do nothing;`);
  }
}

// Sorpresas
out.push(`insert into public.lugares (nombre,zona,descripcion,emoji,precio,duracion,link_maps,es_sorpresa) values ('Sorpréndeme','Donde sea','Yo escojo el lugar perfecto para los dos','🎁',2,'Por definir',null,true) on conflict do nothing;`);
out.push(`insert into public.actividades (nombre,descripcion,emoji,es_sorpresa) values ('Sorpréndeme','Yo arreglo la actividad','🎁',true) on conflict do nothing;`);

// ---- Franjas ----
const franjas = [
  ['Mañana', '☀️', '8 a. m. a 12 m.', 1],
  ['Tarde', '🌤️', '12 m. a 5 p. m.', 2],
  ['Atardecer', '🌇', '5 a 7 p. m.', 3],
  ['Noche', '🌙', 'Desde las 7 p. m.', 4],
  ['Día completo', '🗓️', 'Todo el día', 5],
];
for (const [nombre, emoji, horario, orden] of franjas) {
  out.push(`insert into public.franjas (nombre,emoji,horario,orden) values (${esc(nombre)},${esc(emoji)},${esc(horario)},${orden}) on conflict do nothing;`);
}

// ---- Qué llevar ----
const detalles = [
  ['Flores', 'Mi clásico para ti', '💐'],
  ['Chocolates', 'Dulce para una persona dulce', '🍫'],
  ['Una carta escrita a mano', 'Para leer despacio', '💌'],
  ['Mi postre favorito', 'El que siempre pido', '🍰'],
  ['Una playlist hecha para mí', 'Nuestra lista de canciones', '🎧'],
  ['Vino para brindar', 'Por nosotros', '🍷'],
  ['Una chaqueta extra por si hace frío', 'Porque en Bogotá el clima cambia', '🧥'],
  ['Paraguas, porque es Bogotá', 'Por si llueve', '☔'],
  ['Cámara instantánea', 'Para guardar el momento', '📷'],
  ['Manta para picnic', 'Por si nos provoca sentarnos', '🧺'],
  ['Nada, solo tú', 'Eso es suficiente', '😌'],
];
for (const [nombre, descripcion, emoji] of detalles) {
  out.push(`insert into public.opciones_llevar (tipo,nombre,descripcion,emoji) values ('detalle',${esc(nombre)},${esc(descripcion)},${esc(emoji)}) on conflict do nothing;`);
}
out.push(`insert into public.opciones_llevar (tipo,nombre,descripcion,emoji,es_sorpresa) values ('detalle','Sorpréndeme','Yo te llevo una sorpresita','🎁',true) on conflict do nothing;`);

const vestimenta = [
  ['Casual y cómodos', 'Sudadera y tenis', '👟'],
  ['Elegantes', 'Nos emperifollamos', '✨'],
  ['Deportivos', 'Listos para moverse', '🏃'],
  ['Combinados del mismo color', 'Parejita coordinada', '👫'],
  ['Abrigados, con ruana y bufanda', 'Para el frío bogotano', '🧣'],
];
for (const [nombre, descripcion, emoji] of vestimenta) {
  out.push(`insert into public.opciones_llevar (tipo,nombre,descripcion,emoji) values ('vestimenta',${esc(nombre)},${esc(descripcion)},${esc(emoji)}) on conflict do nothing;`);
}

// ---- Categorías de preguntas ----
const pcats = [
  ['conocernos', 'Para conocernos más', '🔍', '#8FB39A', 1],
  ['recuerdos', 'Nuestros recuerdos', '📸', '#F2B8A0', 2],
  ['suenos', 'Sueños y futuro', '🌱', '#7FB5B5', 3],
  ['divertidas', 'Divertidas e hipotéticas', '🎲', '#A3B18A', 4],
  ['profundas', 'Profundas', '🌊', '#7A9E7E', 5],
  ['coquetas', 'Coquetas', '😏', '#D9A05B', 6],
];
for (const [slug, nombre, emoji, color, orden] of pcats) {
  out.push(`insert into public.categorias_preguntas (slug,nombre,emoji,color,orden) values (${esc(slug)},${esc(nombre)},${esc(emoji)},${esc(color)},${orden}) on conflict (slug) do nothing;`);
}

const preguntas = {
  conocernos: [
    '¿Qué canción te devuelve a tu infancia en dos segundos?',
    '¿Cuál es un pequeño placer que te arregla el día?',
    '¿Qué es algo que sabes hacer y casi nadie sabe?',
    '¿Cuál fue tu materia favorita en el colegio y por qué?',
    '¿Qué olor te transporta a tu niñez?',
    '¿Qué serie te podrías ver mil veces sin cansarte?',
    '¿Qué es lo que más te gusta de vivir en Colombia?',
    '¿Cuál es tu comida favorita de diciembre?',
    '¿Qué te hace reír sin falta?',
    '¿Cuál era tu sueño cuando eras niño o niña?',
    '¿Qué habilidad te gustaría tener que no tienes?',
    '¿Qué es lo primero que notas en una persona?',
    '¿Qué libro o película te marcó la vida?',
    '¿Cuál es tu lugar favorito de Bogotá?',
    '¿Qué te emociona aprender últimamente?',
    '¿Cuál es tu recuerdo más feliz de este año?',
    '¿Qué tipo de música te acompaña cuando estás triste?',
    '¿Qué es algo que siempre quisiste probar y no has hecho?',
    '¿Cómo te describirías con tres palabras?',
    '¿Qué es lo que más valoras de una amistad?',
  ],
  recuerdos: [
    '¿Qué fue lo primero que pensaste de mí?',
    '¿Qué momento nuestro volverías a vivir tal cual?',
    '¿Cuál fue la cita que más te gustó hasta ahora?',
    '¿Qué te hizo saber que yo era diferente?',
    '¿Cuál es el apodo que más te gusta que te diga?',
    '¿Qué detalle mío te enamoró?',
    '¿Cuál fue la primera vez que me viste de verdad?',
    '¿Qué viaje o salida juntos recuerdas con más cariño?',
    '¿Cuál fue el primer regalo que me diste?',
    '¿Qué canción te recuerda a nosotros?',
    '¿Cuál es la foto nuestra que más te gusta?',
    '¿Qué fue lo más chistoso que nos ha pasado?',
    '¿Cuándo supiste que querías que esto fuera en serio?',
    '¿Qué consejo te di que todavía aplicas?',
    '¿Cuál fue el mejor día que hemos tenido?',
    '¿Qué es algo que hacíamos al principio y extrañas?',
    '¿Qué te dije que no se te ha olvidado?',
    '¿Cuál fue la comida más rica que hemos compartido?',
    '¿Qué lugar de Bogotá te recuerda a mí?',
    '¿Cuál ha sido nuestro mayor logro como pareja?',
  ],
  suenos: [
    'Si pudiéramos vivir un año en otro país, ¿cuál escogerías?',
    '¿Cómo sería un domingo perfecto dentro de diez años?',
    '¿Qué meta quieres cumplir este año?',
    'Si tuviéramos una casa de campo, ¿cómo sería?',
    '¿Qué te gustaría que hiciéramos juntos el próximo año?',
    '¿Cómo te imaginas nuestra vida en cinco años?',
    '¿Qué aventura te gustaría vivir conmigo primero?',
    'Si pudiéramos tener una mascota juntos, ¿cuál sería?',
    '¿Qué tradición te gustaría crear conmigo?',
    '¿Qué es algo que quieres aprender antes de los 40?',
    '¿Dónde te gustaría ver el atardecer conmigo?',
    'Si abriéramos un negocio, ¿de qué sería?',
    '¿Qué viaje sueñas hacer conmigo algún día?',
    '¿Cómo te gustaría celebrar nuestro primer aniversario?',
    '¿Qué es lo que más te ilusiona del futuro?',
    'Si pudiéramos cambiar una cosa del mundo, ¿cuál sería?',
    '¿Qué tipo de familia te gustaría formar?',
    '¿Qué es algo que quieres perdonarte?',
    '¿Qué te gustaría lograr con nuestra relación?',
    '¿Cómo sería tu retiro ideal conmigo?',
  ],
  divertidas: [
    'Si fueras un plato colombiano, ¿cuál serías y por qué?',
    'Si fuéramos un dúo de superhéroes, ¿qué poder tendría cada uno?',
    'Si tuvieras que comer lo mismo una semana, ¿qué sería?',
    '¿Qué personaje de película te representaría mejor?',
    'Si pudiéramos cambiarnos de cuerpo un día, ¿qué haríamos?',
    '¿Qué superpoder inútil te encantaría tener?',
    'Si nuestra relación fuera una canción, ¿cuál sería?',
    '¿Qué animal serías si no fueras humano?',
    'Si pudieras volver atrás y decirle algo a tu yo de 10 años, ¿qué sería?',
    '¿Qué harías si ganaras la lotería mañana?',
    'Si tuviera que elegir entre café y chocolate, ¿cuál ganarías?',
    '¿Qué superpoder tendría yo en nuestra historia?',
    'Si nuestro amor fuera un destino de viaje, ¿cuál sería?',
    '¿Qué harías si pudieras hablar con los animales un día?',
    'Si fuéramos famosos, ¿por qué seriamos?',
    '¿Qué harías si no tuvieras que trabajar un mes?',
    'Si pudieras cenar con alguien, vivo o no, ¿con quién sería?',
    '¿Qué superpoder tendría nuestra mascota ideal?',
    'Si te tocara vivir en una película, ¿cuál sería?',
    '¿Qué harías si pudieras teletransportarte por un día?',
  ],
  profundas: [
    '¿Qué es algo que te cuesta pedir, aunque lo necesites?',
    '¿Qué te enseñó la etapa más difícil de tu vida?',
    '¿Qué es algo de lo que te arrepientes?',
    '¿Qué significa para ti estar enamorado?',
    '¿Qué te da miedo del futuro?',
    '¿Qué es lo que más valoras en una persona?',
    '¿Qué es algo que todavía no me has contado?',
    '¿Qué te hace sentir seguro o segura?',
    '¿Qué es algo que te gustaría cambiar de ti?',
    '¿Qué aprendiste de tu familia?',
    '¿Qué es algo que necesitas escuchar más seguido?',
    '¿Cuál ha sido tu mayor lección de amor?',
    '¿Qué te hace sentir acompañado o acompañada?',
    '¿Qué es algo que te gustaría perdonar?',
    '¿Qué es lo que más te cuesta aceptar?',
    '¿Qué te hace sentir vivo o viva?',
    '¿Qué es algo que te gustaría lograr antes de morir?',
    '¿Qué te enseñó tu última relación?',
    '¿Qué es algo que te hace sentir orgulloso o orgullosa de ti?',
    '¿Qué es lo que más te cuesta soltar?',
  ],
  coquetas: [
    '¿Qué es lo que más te gusta que haga sin que me lo pidas?',
    '¿En qué momento supiste que te gustaba?',
    '¿Qué es lo que más te atrae de mí?',
    '¿Qué gesto mío te pone de buenas instantáneamente?',
    '¿Cuál es tu parte favorita de mí?',
    '¿Qué es lo que más te gusta de cómo te miro?',
    '¿Qué es lo que más te gusta de nuestros besos?',
    '¿Qué es lo que más te gusta de cómo te trato?',
    '¿Qué es lo que más te gusta de nuestra conexión?',
    '¿Qué es lo que más te gusta de estar conmigo?',
    '¿Qué es lo que más te gusta de cómo te escucho?',
    '¿Qué es lo que más te gusta de cómo te abrazo?',
    '¿Qué es lo que más te gusta de nuestras risas?',
    '¿Qué es lo que más te gusta de cómo te cuido?',
    '¿Qué es lo que más te gusta de cómo te hago sentir?',
    '¿Qué es lo que más te gusta de cómo te sorprendo?',
    '¿Qué es lo que más te gusta de cómo te apoyo?',
    '¿Qué es lo que más te gusta de cómo te elijo?',
    '¿Qué es lo que más te gusta de cómo te quiero?',
    '¿Qué es lo que más te gusta de nosotros?',
  ],
};

for (const [slug, qs] of Object.entries(preguntas)) {
  for (const q of qs) {
    out.push(`insert into public.preguntas (categoria_slug, texto) values (${esc(slug)}, ${esc(q)}) on conflict do nothing;`);
  }
}

out.push('commit;');
fs.writeFileSync('supabase/seed.sql', out.join('\n'));
console.log('seed.sql generado con', out.length, 'líneas');
