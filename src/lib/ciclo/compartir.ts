// Lo que se le manda a la pareja sale solo de aquí: se arma con lo que ella permitió y nada más.
// La pareja nunca recibe los registros crudos, solo este resumen ya filtrado y cifrado para su llave.
import type { Ajustes, Dia, Fase, Permisos, Tramo } from './tipos';
import { patrones, sumar, type Prediccion } from './prediccion';

export type VistaCompartida = {
  v: 1;
  generado: string; // fecha en que se armó; la pareja calcula "hoy" con las fechas de abajo
  permisos: Omit<Permisos, 'activo'>;
  fases?: Tramo[];
  inicioCiclo?: string;
  hormonal?: boolean;
  periodo?: { proximo?: { probable: string; desde: string; hasta: string }; recientes: string[]; retraso: number; confianza: Prediccion['confianza'] };
  fertil?: { desde: string; hasta: string; masProbable: [string, string]; ovulacionConfirmada: boolean };
  animo?: { fecha: string; valores: string[] }[];
  sintomas?: { fecha: string; lista: string[]; dolor?: number }[];
  patrones?: { fase: Fase; ids: string[] }[];
  planificacion?: {
    ciclosBuscando: number;
    temperaturas: { fecha: string; valor: number }[];
    lh: { fecha: string; resultado: string }[];
    embarazo: { fecha: string; resultado: string }[];
  };
};

const DIAS_RECIENTES = 7;

// Sin ventana fértil, la mitad del ciclo no se nombra: se reparte entre la fase folicular y la lútea
function sinOvulatoria(ts: Tramo[]): Tramo[] {
  const salida: Tramo[] = [];
  for (const t of ts) {
    if (t.fase !== 'ovulatoria') { salida.push({ ...t }); continue; }
    const previo = salida[salida.length - 1];
    if (previo?.fase === 'folicular') previo.hasta = sumar(t.desde, 0);
    else salida.push({ ...t, fase: 'folicular', hasta: t.desde });
    if (t.hasta > t.desde) salida.push({ fase: 'lutea', desde: sumar(t.desde, 1), hasta: t.hasta, estimado: t.estimado });
  }
  // Une los tramos seguidos de la misma fase
  return salida.reduce<Tramo[]>((acc, t) => {
    const u = acc[acc.length - 1];
    if (u && u.fase === t.fase && sumar(u.hasta, 1) === t.desde) u.hasta = t.hasta;
    else acc.push(t);
    return acc;
  }, []);
}

export function armarVista(p: Prediccion, dias: Dia[], ajustes: Ajustes, hoy: string): VistaCompartida | null {
  const per = ajustes.compartir;
  if (!per.activo) return null;
  const { activo: _activo, ...permisos } = per;
  const desde = sumar(hoy, -(DIAS_RECIENTES - 1));
  const recientes = dias.filter((d) => d.fecha >= desde && d.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const buscando = ajustes.modo === 'buscar';
  // La ventana fértil solo sale si ella la comparte y no hay anticonceptivo hormonal
  const fertilVisible = per.fertil && !p.sinVentana && !!p.fertil;
  const v: VistaCompartida = { v: 1, generado: hoy, permisos: { ...permisos, fertil: fertilVisible, planificacion: per.planificacion && buscando } };

  if (per.fase && p.tramos.length) {
    v.fases = fertilVisible ? p.tramos.map((t) => ({ ...t })) : sinOvulatoria(p.tramos);
    v.inicioCiclo = p.actual?.inicio;
    v.hormonal = p.sinVentana || undefined;
  }
  if (per.periodo) {
    v.periodo = {
      proximo: p.proximo,
      recientes: p.ciclos.slice(-6).map((c) => c.inicio),
      retraso: p.retraso,
      confianza: p.confianza,
    };
  }
  if (fertilVisible) v.fertil = { ...p.fertil!, ovulacionConfirmada: !!p.ovulacion?.confirmada };
  if (per.animo) v.animo = recientes.filter((d) => d.animo?.length).map((d) => ({ fecha: d.fecha, valores: [...d.animo!] }));
  if (per.sintomas) {
    v.sintomas = recientes.filter((d) => d.sintomas?.length || d.dolor).map((d) => ({ fecha: d.fecha, lista: [...(d.sintomas ?? [])], ...(d.dolor ? { dolor: d.dolor } : {}) }));
    // Lo que suele pasarle en cada fase, para que los consejos se adelanten (solo con fases visibles)
    if (per.fase) {
      v.patrones = patrones(dias, ajustes, hoy)
        .map((pt) => ({ fase: pt.fase, ids: pt.frecuentes.filter((f) => f.tipo === 'sintoma' || per.animo).map((f) => f.id).slice(0, 4) }))
        .filter((pt) => pt.ids.length && (fertilVisible || pt.fase !== 'ovulatoria'));
    }
  }
  if (per.planificacion && buscando && !p.sinVentana) {
    const inicio = p.actual?.inicio ?? desde;
    const delCiclo = dias.filter((d) => d.fecha >= inicio && d.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    v.planificacion = {
      ciclosBuscando: Math.max(1, p.ciclos.filter((c) => !ajustes.buscandoDesde || c.inicio >= ajustes.buscandoDesde).length),
      temperaturas: delCiclo.filter((d) => d.temperatura != null).map((d) => ({ fecha: d.fecha, valor: d.temperatura! })),
      lh: delCiclo.filter((d) => d.lh).map((d) => ({ fecha: d.fecha, resultado: d.lh! })),
      embarazo: delCiclo.filter((d) => d.embarazo).map((d) => ({ fecha: d.fecha, resultado: d.embarazo! })),
    };
  }
  return v;
}

// ---------- Avisos para la pareja ----------
// Lo que ella programa (antes del periodo, compras, ventana fértil) y lo que manda en el momento (necesidades, día difícil).
// El servidor solo sabe la hora de envío; el texto viaja cifrado y la notificación dice algo genérico.
export type ContenidoAviso =
  | { tipo: 'antes_periodo'; dias: number; fecha: string }
  | { tipo: 'compras'; productos: string; fecha: string }
  | { tipo: 'ventana_fertil'; desde: string; hasta: string }
  | { tipo: 'necesidad'; id: string; nota?: string }
  | { tipo: 'dia_dificil'; dolor?: number; sintomas: string[] };

export type AvisoProgramado = { enviarEn: string; contenido: ContenidoAviso };

// 9 a. m. en Bogotá (UTC−5, sin horario de verano)
const nueveAm = (f: string) => `${f}T14:00:00.000Z`;
const HORIZONTE = 40;

export function programarAvisos(p: Prediccion, ajustes: Ajustes, ahora: Date): AvisoProgramado[] {
  if (!ajustes.compartir.activo) return [];
  const a = ajustes.alertas;
  const salida: AvisoProgramado[] = [];
  const limite = ahora.getTime() + HORIZONTE * 86400000;
  const agregar = (f: string, c: ContenidoAviso) => {
    const t = Date.parse(nueveAm(f));
    if (t > ahora.getTime() && t < limite) salida.push({ enviarEn: nueveAm(f), contenido: c });
  };
  // Con el periodo atrasado no se avisa "llega en 2 días": sería información equivocada
  if (p.proximo && p.retraso === 0 && ajustes.compartir.periodo) {
    if (a.antesPeriodo) agregar(sumar(p.proximo.desde, -a.diasAntes), { tipo: 'antes_periodo', dias: a.diasAntes, fecha: p.proximo.desde });
    if (a.compras) agregar(sumar(p.proximo.desde, -Math.max(3, a.diasAntes + 1)), { tipo: 'compras', productos: a.productos.trim(), fecha: p.proximo.desde });
  }
  if (a.ventanaFertil && ajustes.modo === 'buscar' && ajustes.compartir.fertil && p.fertil && !p.sinVentana) {
    agregar(p.fertil.desde, { tipo: 'ventana_fertil', desde: p.fertil.desde, hasta: p.fertil.hasta });
  }
  return salida;
}

// Un día difícil: dolor fuerte, o dolor moderado con ánimo bajo
export const esDiaDificil = (d: Dia) => d.dolor === 3 || (d.dolor === 2 && !!d.animo?.some((x) => ['triste', 'irritable', 'ansiosa', 'estres'].includes(x)));
