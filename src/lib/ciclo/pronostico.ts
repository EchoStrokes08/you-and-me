// El pronóstico del ciclo como tablero: un anillo con los días del ciclo actual, una tira de días con la
// energía que suele tener, y los próximos cambios. Sirve igual para ella (con su predicción) y para la
// pareja (con la vista compartida): solo usa lo que entra, así que nunca muestra más de lo permitido.
import type { Fase, Tramo } from './tipos';
import { entre, faseEn, sumar } from './prediccion';
import { NOMBRE_FASE } from './catalogo';

export type EntradaPronostico = {
  hoy: string;
  tramos: Tramo[];
  inicioCiclo?: string;
  proximo?: { probable: string; desde: string; hasta: string };
  retraso: number;
  enPeriodo?: boolean;
  // Solo si se puede mostrar (ella busca o evita embarazo, o lo compartió)
  fertil?: { desde: string; hasta: string };
};

export type DiaPronostico = { fecha: string; fase?: Fase; estimado: boolean; hoy: boolean; pasado: boolean; fertil: boolean };

const MIN_ANILLO = 24;
const MAX_ANILLO = 40;

// Antes del ciclo actual no hay tramos: esos días fueron el final del ciclo anterior, así que se cuentan
// hacia atrás desde el inicio. Si las fases no traen la mitad del ciclo (no se compartió), tampoco se inventa
function faseAntes(e: EntradaPronostico, fecha: string): Fase | undefined {
  const primero = e.tramos[0];
  if (!primero) return undefined;
  if (e.tramos.some((t) => t.fase === 'hormonal')) return 'hormonal';
  const atras = entre(fecha, primero.desde);
  const conMitad = e.tramos.some((t) => t.fase === 'ovulatoria');
  if (atras <= 5) return 'premenstrual';
  if (atras <= 12) return 'lutea';
  if (atras <= 15) return conMitad ? 'ovulatoria' : 'lutea';
  return 'folicular';
}

const diaDe = (e: EntradaPronostico, fecha: string): DiaPronostico => {
  const t = faseEn(e.tramos, fecha);
  return {
    fecha, fase: t?.fase ?? (e.tramos.length && fecha < e.tramos[0].desde ? faseAntes(e, fecha) : undefined),
    estimado: t?.estimado ?? true, hoy: fecha === e.hoy, pasado: fecha < e.hoy,
    fertil: !!e.fertil && fecha >= e.fertil.desde && fecha <= e.fertil.hasta,
  };
};

// Dónde empieza y termina el ciclo actual: del inicio hasta el día antes del próximo periodo
export function cicloActual(e: EntradaPronostico): { inicio: string; fin: string } | null {
  if (!e.tramos.length) return null;
  const inicio = e.inicioCiclo ?? e.tramos[0].desde;
  const siguiente = e.tramos.find((t) => t.fase === 'menstrual' && t.desde > inicio);
  let fin = siguiente ? sumar(siguiente.desde, -1) : e.tramos[e.tramos.length - 1].hasta;
  if (fin < e.hoy) fin = e.hoy;
  return { inicio, fin };
}

// El anillo es una vuelta de días alrededor de hoy, como un ciclo: un poco menos de la mitad ya pasó
// (a la izquierda) y el resto viene (a la derecha), así siempre se ve lo que se acerca.
// Cada fecha tiene siempre el mismo lugar en la vuelta (hoy abajo); si el día elegido en la tira queda
// fuera, la vuelta avanza y los días que vienen ocupan el lugar de los más viejos
export function anillo(e: EntradaPronostico, foco?: string): { dias: DiaPronostico[]; diaCiclo: number; largo: number } | null {
  const c = cicloActual(e);
  if (!c) return null;
  const largo = entre(c.inicio, c.fin) + 1;
  const vuelta = Math.max(MIN_ANILLO, Math.min(MAX_ANILLO, largo));
  let desde = sumar(e.hoy, -Math.floor(vuelta * 0.45));
  if (foco && foco < desde) desde = foco;
  else if (foco && entre(desde, foco) >= vuelta) desde = sumar(foco, 1 - vuelta);
  const dias: DiaPronostico[] = [];
  for (let k = 0; k < vuelta; k++) dias.push(diaDe(e, sumar(desde, k)));
  return { dias, diaCiclo: entre(c.inicio, e.hoy) + 1, largo };
}

// Una semana atrás y tres adelante, desde donde haya fases
export function tira(e: EntradaPronostico, antes = 7, despues = 21): DiaPronostico[] {
  if (!e.tramos.length) return [];
  const ultimo = e.tramos[e.tramos.length - 1].hasta;
  const desde = sumar(e.hoy, -antes);
  let hasta = sumar(e.hoy, despues);
  if (hasta > ultimo) hasta = ultimo;
  const dias: DiaPronostico[] = [];
  for (let f = desde; f <= hasta; f = sumar(f, 1)) dias.push(diaDe(e, f));
  return dias;
}

// Tramos seguidos de una misma fase dentro de la tira, para las pastillas de abajo
export function bandas(dias: DiaPronostico[]): { fase: Fase; desde: number; largo: number }[] {
  const salida: { fase: Fase; desde: number; largo: number }[] = [];
  dias.forEach((d, i) => {
    if (!d.fase) return;
    const u = salida[salida.length - 1];
    if (u && u.fase === d.fase && u.desde + u.largo === i) u.largo++;
    else salida.push({ fase: d.fase, desde: i, largo: 1 });
  });
  return salida;
}

// Cómo suele moverse la energía y la sensibilidad en cada fase (0 a 1), al principio y al final de la fase.
// Es una guía general, no una medición: cada cuerpo es distinto
const CURVAS: Record<Fase, { energia: [number, number]; sensibilidad: [number, number] }> = {
  menstrual: { energia: [0.22, 0.38], sensibilidad: [0.62, 0.38] },
  folicular: { energia: [0.42, 0.8], sensibilidad: [0.3, 0.22] },
  ovulatoria: { energia: [0.88, 0.9], sensibilidad: [0.24, 0.3] },
  lutea: { energia: [0.72, 0.52], sensibilidad: [0.34, 0.52] },
  premenstrual: { energia: [0.46, 0.28], sensibilidad: [0.6, 0.78] },
  hormonal: { energia: [0.56, 0.56], sensibilidad: [0.4, 0.4] },
};

export function curvas(e: EntradaPronostico, dias: DiaPronostico[]): { energia: (number | null)[]; sensibilidad: (number | null)[] } {
  const energia: (number | null)[] = [];
  const sensibilidad: (number | null)[] = [];
  for (const d of dias) {
    const t = faseEn(e.tramos, d.fecha);
    if (!d.fase) { energia.push(null); sensibilidad.push(null); continue; }
    const largo = t ? entre(t.desde, t.hasta) : 0;
    const pos = t && largo > 0 ? entre(t.desde, d.fecha) / largo : 0.5;
    const c = CURVAS[d.fase];
    energia.push(c.energia[0] + (c.energia[1] - c.energia[0]) * pos);
    sensibilidad.push(c.sensibilidad[0] + (c.sensibilidad[1] - c.sensibilidad[0]) * pos);
  }
  // Suaviza los saltos entre fases para que se lea como una ola y no como escalones
  const suavizar = (xs: (number | null)[]) => xs.map((x, i) => {
    if (x == null) return null;
    const vecinos = [xs[i - 2], xs[i - 1], x, xs[i + 1], xs[i + 2]].filter((v): v is number => v != null);
    return vecinos.reduce((a, b) => a + b, 0) / vecinos.length;
  });
  return { energia: suavizar(energia), sensibilidad: suavizar(sensibilidad) };
}

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

// Lo que va en el centro del anillo
export function centro(e: EntradaPronostico, paraPareja: boolean): { rotulo: string; grande: string; detalle?: string } {
  const a = anillo(e);
  const t = faseEn(e.tramos, e.hoy);
  const detalle = a ? `Día ${a.diaCiclo} del ciclo${t && !e.enPeriodo ? ` · ${NOMBRE_FASE[t.fase].toLowerCase()}` : ''}` : undefined;
  if (e.enPeriodo || t?.fase === 'menstrual') return { rotulo: 'Con el periodo', grande: a ? `Día ${a.diaCiclo}` : 'Hoy', detalle: 'Fase menstrual' };
  if (e.proximo) {
    const falta = entre(e.hoy, e.proximo.probable);
    if (e.retraso > 0) return paraPareja ? { rotulo: 'El periodo', grande: 'se demora', detalle } : { rotulo: 'El periodo va', grande: `${dias(e.retraso)} tarde`, detalle };
    if (falta <= 0) return { rotulo: 'El periodo', grande: 'podría llegar hoy', detalle };
    return { rotulo: 'Periodo en', grande: dias(falta), detalle };
  }
  return { rotulo: t ? NOMBRE_FASE[t.fase] : 'Ciclo', grande: a ? `Día ${a.diaCiclo}` : 'Hoy' };
}

// El centro del anillo cuando se mira otro día en la tira: qué día es, en qué fase está y cuánto falta
export function centroDe(e: EntradaPronostico, fecha: string): { rotulo: string; grande: string; detalle?: string; fase?: Fase } {
  const f = new Date(fecha + 'T00:00:00');
  const rotulo = f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  const n = entre(e.hoy, fecha);
  const cuando = n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : n > 0 ? `En ${dias(n)}` : `Hace ${dias(-n)}`;
  const d = diaDe(e, fecha);
  const c = cicloActual(e);
  const enCiclo = c && fecha >= c.inicio && fecha <= c.fin ? ` · día ${entre(c.inicio, fecha) + 1} del ciclo` : '';
  const fertil = d.fertil ? ' · ventana fértil' : '';
  return { rotulo, grande: d.fase ? NOMBRE_FASE[d.fase] : cuando, detalle: d.fase ? `${cuando}${enCiclo}${fertil}` : undefined, fase: d.fase };
}

// El próximo cambio, para la pastilla bajo el anillo: lo que llegue primero
export function proximoHito(e: EntradaPronostico): string | null {
  const opciones: { dias: number; texto: string }[] = [];
  if (e.fertil) {
    if (e.hoy >= e.fertil.desde && e.hoy <= e.fertil.hasta) {
      const n = entre(e.hoy, e.fertil.hasta);
      opciones.push({ dias: -1, texto: n === 0 ? 'Último día de la ventana fértil' : `Ventana fértil: quedan ${dias(n + 1)}` });
    }
    else if (e.fertil.desde > e.hoy) {
      const n = entre(e.hoy, e.fertil.desde);
      opciones.push({ dias: n, texto: n === 1 ? 'Mañana empieza la ventana fértil' : `${dias(n)} para la ventana fértil` });
    }
  }
  const siguiente = e.tramos.find((t) => t.desde > e.hoy && t.fase !== faseEn(e.tramos, e.hoy)?.fase);
  if (siguiente && siguiente.fase !== 'hormonal') {
    const n = entre(e.hoy, siguiente.desde);
    const nombre = ({ menstrual: 'el periodo', folicular: 'la fase folicular', ovulatoria: 'la mitad del ciclo', lutea: 'la fase lútea', premenstrual: 'la fase premenstrual', hormonal: '' } as const)[siguiente.fase];
    // El periodo ya lo dice el centro del anillo
    if (siguiente.fase !== 'menstrual' || !e.proximo) opciones.push({ dias: n, texto: n === 1 ? `Mañana empieza ${nombre}` : `${dias(n)} para ${nombre}` });
  }
  opciones.sort((a, b) => a.dias - b.dias);
  return opciones[0]?.texto ?? null;
}

// La fase en palabras: una "estación" para recordarla fácil y qué suele pasar
export const INFO_FASE: Record<Fase, { estacion: string; propia: string; pareja: (n: string) => string }> = {
  menstrual: {
    estacion: 'Invierno interior',
    propia: 'El cuerpo está renovándose y es normal tener menos energía. Date permiso de ir más despacio, abrigarte y descansar sin culpa.',
    pareja: (n) => `El cuerpo de ${n} está renovándose y es normal que tenga menos energía. Es momento de cuidarla bonito y bajar el ritmo juntos.`,
  },
  folicular: {
    estacion: 'Primavera interior',
    propia: 'Los estrógenos van subiendo y con ellos suelen volver la energía, las ganas de hacer cosas y la cabeza más despejada.',
    pareja: (n) => `A ${n} le suele volver la energía y las ganas de hacer cosas. Buen momento para proponer planes y cosas nuevas.`,
  },
  ovulatoria: {
    estacion: 'Verano interior',
    propia: 'Es la mitad del ciclo: muchas sienten más energía, más ganas de ver gente y más seguridad en sí mismas.',
    pareja: (n) => `${n} suele sentirse con más energía y más sociable. Días buenos para una cita o para compartir con amigos.`,
  },
  lutea: {
    estacion: 'Otoño interior',
    propia: 'Después de la ovulación sube la progesterona: la energía va bajando poco a poco y el cuerpo pide más calma.',
    pareja: (n) => `La energía de ${n} va bajando poco a poco. Planes más tranquilos y un poco de paciencia extra caen muy bien.`,
  },
  premenstrual: {
    estacion: 'Fin del otoño',
    propia: 'Las hormonas bajan antes del periodo: puede haber cansancio, hinchazón o estar más sensible. Es normal y pasa.',
    pareja: (n) => `${n} puede estar más cansada o sensible antes del periodo. No es personal: más cariño y menos pendientes.`,
  },
  hormonal: {
    estacion: 'Marea tranquila',
    propia: 'Con un método hormonal el cuerpo no sigue las fases de siempre: las hormonas se mantienen más parejas.',
    pareja: (n) => `Con su método, el cuerpo de ${n} no sigue las fases de siempre. Lo que más sirve es preguntarle cómo está.`,
  },
};

export type Consejo = { id: 'cuerpo' | 'animo' | 'comida' | 'juntos'; titulo: string; texto: string };

// Ideas cortas del día según la fase, dichas para ella o para la pareja
export function consejos(fase: Fase, paraPareja: boolean, n: string): Consejo[] {
  const t: Record<Fase, Record<Consejo['id'], [string, string]>> = {
    menstrual: {
      cuerpo: ['Calor en el vientre, agua y estiramientos suaves alivian los cólicos.', `Una bolsa de agua caliente o un masaje suave en la espalda baja le puede aliviar.`],
      animo: ['Puede que quieras más tiempo para ti. Está bien decir que no a planes.', `Puede que quiera más tiempo a solas o más mimos: pregúntale qué prefiere.`],
      comida: ['Comida calientita, con hierro (lentejas, espinaca, carne) y mucha agua.', `Llévale algo calientito: una aromática, un caldo o su antojo favorito.`],
      juntos: ['Peli, cobija y algo rico: un plan en casa es perfecto.', `Plan en casa: peli, cobija y tú encargándote de todo.`],
    },
    folicular: {
      cuerpo: ['Buen momento para moverte más: caminar, bailar o hacer ejercicio.', `${n} puede tener ganas de moverse: propón una caminata o algo activo.`],
      animo: ['La cabeza suele estar más despejada: aprovecha para empezar cosas.', `Suele estar de buen ánimo y con ideas: escúchalas y súmate.`],
      comida: ['Frutas, verduras frescas y proteína para acompañar la energía.', `Cocinen algo nuevo juntos o vayan a probar un lugar distinto.`],
      juntos: ['Propón ese plan que tienen pendiente o algo que nunca hayan hecho.', `Buen momento para ese plan pendiente o algo que nunca hayan hecho.`],
    },
    ovulatoria: {
      cuerpo: ['La energía suele estar en su punto más alto.', `${n} suele tener la energía en su punto más alto.`],
      animo: ['Muchas se sienten más seguras y sociables por estos días.', `Un cumplido sincero o un detalle se siente especialmente bien hoy.`],
      comida: ['Comida ligera y fresca, y agua: el cuerpo está a toda.', `Un plan de comida rica afuera puede caer muy bien.`],
      juntos: ['Buen momento para una cita o para ver a tus amigos.', `Días buenos para una cita o un plan con amigos.`],
    },
    lutea: {
      cuerpo: ['El cuerpo pide más descanso: intenta dormir un poco más temprano.', `Si la ves cansada, ayúdale a que descanse temprano.`],
      animo: ['Es normal querer más calma y rutina. No te exijas tanto.', `Puede querer más calma y rutina: un poco de paciencia extra.`],
      comida: ['Carbohidratos complejos, chocolate oscuro y magnesio ayudan con los antojos.', `Ten a la mano algo de lo que le suele provocar.`],
      juntos: ['Planes tranquilos: cocinar juntos, una caminata corta, una serie.', `Planes tranquilos: cocinar juntos, una serie, una caminata corta.`],
    },
    premenstrual: {
      cuerpo: ['Puede haber hinchazón o senos sensibles: ropa cómoda y menos sal.', `Ropa cómoda, abrazos suaves y nada de comentarios sobre su cuerpo.`],
      animo: ['Si te sientes más sensible o irritable, es la marea hormonal. Sé amable contigo.', `Si está más sensible o irritable, no es personal: baja el ritmo y escucha.`],
      comida: ['Agua, menos cafeína y sal, y date ese gusto dulce sin culpa.', `Encárgate de la cena o sorpréndela con algo dulce.`],
      juntos: ['Pídele a ' + n + ' lo que necesites: espacio, compañía o un abrazo.', `Revisa que haya en casa lo que suele usar en su periodo.`],
    },
    hormonal: {
      cuerpo: ['Fíjate en cómo te sientes y anótalo: así aprendes tu propio ritmo.', `Lo que más sirve es preguntarle cómo se siente hoy.`],
      animo: ['Tu ánimo no tiene por qué seguir un patrón: escúchate.', `Su ánimo no sigue un calendario: pregunta en vez de suponer.`],
      comida: ['Comer a tus horas y tomar agua siempre ayuda.', `Un detalle rico nunca sobra.`],
      juntos: ['Cuéntale a ' + n + ' lo que necesites con un toque en "Contarle".', `Está pendiente de lo que ella te cuente por aquí.`],
    },
  };
  const nombres: Record<Consejo['id'], string> = { cuerpo: 'Cuerpo', animo: 'Ánimo', comida: 'Comida', juntos: paraPareja ? 'Juntos' : 'Con ' + n };
  return (['cuerpo', 'animo', 'comida', 'juntos'] as const).map((id) => ({ id, titulo: nombres[id], texto: t[fase][id][paraPareja ? 1 : 0] }));
}
