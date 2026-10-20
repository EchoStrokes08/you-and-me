// La vista de la pareja traducida a cosas que puede hacer. En vez de "día 24, fase lútea":
// "puede sentir más cansancio estos días; buen momento para encargarte de la cena".
// Todo se dice con "puede" y "suele": es una guía, no un diagnóstico, y nada reemplaza preguntarle.
import type { VistaCompartida, ContenidoAviso } from './compartir';
import type { Fase } from './tipos';
import { entre, faseEn } from './prediccion';
import { etiqueta, NECESIDADES, SINTOMAS } from './catalogo';

export type Accion = { id: string; texto: string; detalle?: string };
export type Resumen = {
  titular: string;
  contexto?: string; // la fase en palabras sencillas, en pequeño
  fase?: Fase;
  acciones: Accion[];
  proximo?: string;
  fertil?: string;
};

const POR_FASE: Record<Fase, { titular: (n: string) => string; acciones: Accion[] }> = {
  menstrual: {
    titular: (n) => `${n} puede tener cólicos y menos energía estos días.`,
    acciones: [
      { id: 'calor', texto: 'Ofrécele una bolsa de agua caliente o algo calientito de tomar.' },
      { id: 'comida', texto: 'Encárgate de la comida o de las vueltas de hoy sin que te lo pida.' },
      { id: 'plan-tranquilo', texto: 'Si tienen plan, que sea tranquilo; pregúntale qué le provoca.', detalle: 'Mejor una peli en casa que una caminata larga, salvo que ella diga otra cosa.' },
    ],
  },
  folicular: {
    titular: (n) => `${n} suele tener más energía y ganas de hacer cosas en estos días.`,
    acciones: [
      { id: 'plan', texto: 'Buen momento para proponer ese plan que tienen pendiente.' },
      { id: 'nuevo', texto: 'Algo nuevo juntos (un lugar, una clase, una caminata) puede caer muy bien.' },
    ],
  },
  ovulatoria: {
    titular: (n) => `${n} puede sentirse con más energía y más sociable en estos días.`,
    acciones: [
      { id: 'cita', texto: 'Buen momento para una cita o un plan con amigos.' },
      { id: 'detalle', texto: 'Un detalle o un cumplido sincero suma mucho.' },
    ],
  },
  lutea: {
    titular: (n) => `La energía de ${n} puede ir bajando poco a poco.`,
    acciones: [
      { id: 'paciencia', texto: 'Planes más tranquilos y un poco de paciencia extra.' },
      { id: 'descanso', texto: 'Si la ves cansada, ayúdale a que descanse temprano.' },
    ],
  },
  premenstrual: {
    titular: (n) => `${n} puede sentir más cansancio o estar más sensible estos días.`,
    acciones: [
      { id: 'cena', texto: 'Buen momento para encargarte de la cena.' },
      { id: 'no-personal', texto: 'Si está más irritable, no es personal: baja el ritmo y escucha.' },
      { id: 'despensa', texto: 'Revisa que haya en casa lo que suele usar (productos de higiene, analgésico, algo dulce).' },
    ],
  },
  hormonal: {
    titular: (n) => `Con su método, el cuerpo de ${n} no sigue las fases de siempre.`,
    acciones: [
      { id: 'preguntar', texto: 'Lo que más sirve es preguntarle cómo está hoy.' },
    ],
  },
};

const POR_SINTOMA: Record<string, string> = {
  colicos: 'Bolsa de agua caliente, una aromática o un masaje suave en la espalda baja.',
  cabeza: 'Luz baja, poco ruido y agua a la mano.',
  espalda: 'Un masaje suave en la espalda baja puede aliviar.',
  cansancio: 'Encárgate tú de lo pendiente para que pueda descansar.',
  hinchazon: 'Ropa cómoda y nada de comentarios sobre su cuerpo.',
  senos: 'Abrazos suaves: puede tener los senos sensibles.',
  antojos: 'Sorpréndela con algo de lo que le provoca.',
  nauseas: 'Algo liviano de comer y agua o suero a la mano.',
  insomnio: 'Durmió mal: un plan sin madrugar le vendría bien.',
  digestion: 'Comida sencilla y casera.',
  mareo: 'Que se siente o se acueste; si no mejora o se desmaya, acompáñala al médico.',
};

const POR_ANIMO: Record<string, string> = {
  triste: 'Escúchala sin tratar de arreglarlo. A veces basta con estar.',
  irritable: 'No es personal: baja el ritmo y evita discusiones que pueden esperar.',
  ansiosa: 'Pregúntale qué necesita; respirar juntos o salir a caminar puede ayudar.',
  estres: 'Quítale algo de encima: una vuelta, la comida, un mensaje bonito.',
  sensible: 'Más cariño y menos bromas pesadas hoy.',
  energia: 'Tiene energía: propón un plan.',
  cariñosa: 'Está cariñosa: aprovecha para estar cerca.',
};

export const POR_NECESIDAD: Record<string, { titulo: (n: string) => string; texto: string }> = {
  espacio: { titulo: (n) => `${n} necesita espacio`, texto: 'Dale su espacio sin tomarlo personal. Un "aquí estoy si me necesitas" basta; no insistas con preguntas.' },
  compania: { titulo: (n) => `${n} quiere compañía`, texto: 'Si puedes, ve a acompañarla o llámala. No hace falta un plan: estar es suficiente.' },
  abrazo: { titulo: (n) => `${n} necesita un abrazo`, texto: 'Un abrazo largo, sin prisa. Si no están juntos, una llamada o una nota de voz.' },
  dulce: { titulo: (n) => `${n} tiene antojo de algo dulce`, texto: 'Llévale algo dulce o pídeselo a domicilio. Puntos extra si es su favorito.' },
  dolor: { titulo: (n) => `${n} tiene dolor fuerte`, texto: 'Pregúntale si necesita un analgésico, agua caliente o que la acompañes. Si el dolor es muy fuerte, distinto a lo usual, con fiebre o desmayo, acompáñala a urgencias.' },
  descanso: { titulo: (n) => `${n} necesita descansar`, texto: 'Encárgate de lo pendiente y deja que duerma o se quede quieta sin culpa.' },
  hablar: { titulo: (n) => `${n} quiere hablar`, texto: 'Busca un rato sin el celular. Escucha primero; los consejos, solo si los pide.' },
  mimos: { titulo: (n) => `${n} quiere mimos`, texto: 'Cariño sin agenda: caricias, una peli abrazados, un mensaje bonito.' },
};

const fechaCorta = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const enDias = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);

export function resumenPareja(v: VistaCompartida, hoy: string, nombre: string): Resumen {
  const tramo = v.fases ? faseEn(v.fases, hoy) : undefined;
  const fase = tramo?.fase;
  const acciones: Accion[] = [];
  const ya = new Set<string>();
  const sumarAccion = (a: Accion) => { if (!ya.has(a.id)) { ya.add(a.id); acciones.push(a); } };

  // Lo que registró hoy o ayer pesa más que lo que "suele" pasar
  const sintomasRecientes = (v.sintomas ?? []).filter((s) => entre(s.fecha, hoy) <= 1).flatMap((s) => s.lista);
  const dolorReciente = Math.max(0, ...(v.sintomas ?? []).filter((s) => entre(s.fecha, hoy) <= 1).map((s) => s.dolor ?? 0));
  const animoReciente = (v.animo ?? []).filter((a) => entre(a.fecha, hoy) <= 1).flatMap((a) => a.valores);

  for (const s of new Set(sintomasRecientes)) if (POR_SINTOMA[s]) sumarAccion({ id: `s-${s}`, texto: POR_SINTOMA[s], detalle: `Registró: ${etiqueta(SINTOMAS, s).toLowerCase()}` });
  if (dolorReciente === 3) sumarAccion({ id: 'dolor-fuerte', texto: 'Registró dolor fuerte: pregúntale qué necesita y no la presiones con planes.' });
  for (const a of new Set(animoReciente)) if (POR_ANIMO[a]) sumarAccion({ id: `a-${a}`, texto: POR_ANIMO[a] });

  let titular: string;
  if (fase) {
    const base = POR_FASE[fase];
    titular = base.titular(nombre);
    // Lo que suele pasarle a ella en esta fase, aprendido de sus ciclos
    const suyos = v.patrones?.find((p) => p.fase === fase)?.ids ?? [];
    for (const s of suyos) if (POR_SINTOMA[s]) sumarAccion({ id: `s-${s}`, texto: POR_SINTOMA[s], detalle: `En esta fase suele tener ${etiqueta(SINTOMAS, s).toLowerCase()}` });
    for (const a of base.acciones) sumarAccion(a);
  } else if (animoReciente.length || sintomasRecientes.length) {
    titular = `Esto es lo que ${nombre} te contó de estos días.`;
  } else {
    titular = `${nombre} comparte contigo algo de su ciclo.`;
  }

  let contexto: string | undefined;
  if (tramo && v.inicioCiclo && fase !== 'hormonal') {
    const nombres: Record<Fase, string> = {
      menstrual: 'está con el periodo', folicular: 'fase folicular: después del periodo', ovulatoria: 'mitad del ciclo',
      lutea: 'fase lútea: después de la ovulación', premenstrual: 'días antes del periodo', hormonal: '',
    };
    contexto = `Día ${entre(v.inicioCiclo, hoy) + 1} del ciclo · ${nombres[fase!]}${tramo.estimado ? ' (estimado)' : ''}`;
  }

  let proximo: string | undefined;
  if (v.periodo?.proximo && fase !== 'menstrual') {
    const p = v.periodo.proximo;
    const falta = entre(hoy, p.probable);
    if (v.periodo.retraso > 0 || falta < 0) proximo = 'El periodo se está demorando un poco. No hace falta comentarlo; si quiere hablarlo, ella te contará.';
    else if (falta <= 7) proximo = `Su periodo podría llegar ${enDias(falta)} (entre el ${fechaCorta(p.desde)} y el ${fechaCorta(p.hasta)}).`;
    else proximo = `Su próximo periodo sería alrededor del ${fechaCorta(p.probable)}.`;
  }

  let fertil: string | undefined;
  if (v.fertil) {
    const f = v.fertil;
    if (hoy >= f.desde && hoy <= f.hasta) fertil = `Están en la ventana fértil (hasta el ${fechaCorta(f.hasta)}). Los días de más probabilidad: ${fechaCorta(f.masProbable[0])} a ${fechaCorta(f.masProbable[1])}.`;
    else if (hoy < f.desde && entre(hoy, f.desde) <= 10) fertil = `La ventana fértil empezaría ${enDias(entre(hoy, f.desde))}.`;
  }

  return { titular, contexto, fase, acciones: acciones.slice(0, 5), proximo, fertil };
}

// Texto de un aviso recibido (lo que ella programó o mandó)
export function textoAviso(c: ContenidoAviso, nombre: string): { titulo: string; texto: string } {
  switch (c.tipo) {
    case 'antes_periodo':
      return { titulo: `El periodo de ${nombre} podría llegar ${enDias(c.dias)}`, texto: 'Un buen momento para estar pendiente, encargarte de algo de la casa o preguntarle qué le provoca.' };
    case 'compras':
      return { titulo: 'Para tener en casa', texto: c.productos ? `${nombre} te pidió tener a la mano: ${c.productos}.` : `Revisa que haya en casa lo que ${nombre} suele usar en su periodo (productos de higiene, analgésico, algo dulce).` };
    case 'ventana_fertil':
      return { titulo: 'Empieza la ventana fértil', texto: `Va del ${fechaCorta(c.desde)} al ${fechaCorta(c.hasta)}.` };
    case 'necesidad': {
      const n = POR_NECESIDAD[c.id];
      return { titulo: n ? n.titulo(nombre) : `${nombre}: ${etiqueta(NECESIDADES, c.id)}`, texto: [c.nota ? `«${c.nota}»` : null, n?.texto].filter(Boolean).join('\n') };
    }
    case 'dia_dificil':
      return { titulo: `${nombre} está teniendo un día difícil`, texto: `${c.dolor === 3 ? 'Registró dolor fuerte. ' : ''}Pregúntale cómo está y qué necesita; a veces lo mejor es quitarle algo de encima.` };
  }
}
