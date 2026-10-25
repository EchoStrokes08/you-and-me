// El tablero del ciclo estilo pronóstico (anillo, tira de días con la energía, fase y consejos): el corazón visual del "Hoy" y del "Para ti".
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Fase } from '../../lib/ciclo/tipos';
import { NOMBRE_FASE } from '../../lib/ciclo/catalogo';
import { entre, faseEn } from '../../lib/ciclo/prediccion';
import { fechaCorta } from '../../lib/ciclo/formato';
import { anillo, bandas, centro, centroDe, consejos, curvas, INFO_FASE, proximoHito, tira, type Consejo, type DiaPronostico, type EntradaPronostico } from '../../lib/ciclo/pronostico';
import { Corazon, IconoCubiertos, IconoHoja, IconoOla } from '../ui';

// Pasteles fijos: se leen igual sobre el mar y sobre una tarjeta de día o de noche, siempre con texto pino encima
const COLOR_FASE: Record<Fase, string> = {
  menstrual: '#F2A58C',
  folicular: '#8FD3AC',
  ovulatoria: '#C3E08A',
  lutea: '#8FD0D0',
  premenstrual: '#EBCB9F',
  hormonal: '#9DBBAA',
};
const CORTO: Record<Fase, string> = { menstrual: 'Periodo', folicular: 'Folicular', ovulatoria: 'Mitad del ciclo', lutea: 'Lútea', premenstrual: 'Antes del periodo', hormonal: 'Hormonal' };

type Dato = { rotulo: string; valor: string; detalle?: string; color?: string };

// Tablero del ciclo al estilo de un pronóstico: anillo, tira de días con la energía, datos, fase y consejos.
// nombre: de quién es el ciclo (para la pareja) o con quién lo comparte (para ella).
// children va después de los datos y antes de la fase: lo que se hace hoy (registrar, acompañar)
export default function Pronostico({ entrada: e, paraPareja, nombre, energiaReal, confianza, children }: {
  entrada: EntradaPronostico; paraPareja: boolean; nombre: string; energiaReal?: Map<string, number>; confianza?: string; children?: ReactNode;
}) {
  // El día que se está mirando: el del centro de la tira. El anillo lo sigue con su bolita
  const [foco, setFoco] = useState(e.hoy);
  useEffect(() => { setFoco(e.hoy); }, [e.hoy]);
  const a = useMemo(() => anillo(e, foco), [e, foco]);
  const tramo = faseEn(e.tramos, e.hoy);
  if (!a) return null;

  const datos: Dato[] = [{ rotulo: 'Día del ciclo', valor: String(a.diaCiclo), detalle: e.retraso > 0 ? 'Más largo de lo usual' : `de unos ${a.largo}`, color: tramo && COLOR_FASE[tramo.fase] }];
  if (e.enPeriodo || tramo?.fase === 'menstrual') {
    const fin = tramo?.fase === 'menstrual' ? tramo.hasta : undefined;
    datos.push({ rotulo: 'Periodo', valor: 'En curso', detalle: fin ? `Suele ir hasta el ${fechaCorta(fin)}` : undefined, color: COLOR_FASE.menstrual });
  } else if (e.proximo) {
    const falta = entre(e.hoy, e.proximo.probable);
    datos.push({
      rotulo: 'Próximo periodo', color: COLOR_FASE.menstrual,
      valor: e.retraso > 0 ? (paraPareja ? 'Se demora' : `${e.retraso} ${e.retraso === 1 ? 'día' : 'días'} tarde`) : falta <= 0 ? 'Hoy' : falta === 1 ? 'Mañana' : `En ${falta} días`,
      detalle: e.retraso > 0 ? undefined : `Entre el ${fechaCorta(e.proximo.desde)} y el ${fechaCorta(e.proximo.hasta)}`,
    });
  }
  if (e.fertil) {
    const dentro = e.hoy >= e.fertil.desde && e.hoy <= e.fertil.hasta;
    const falta = entre(e.hoy, e.fertil.desde);
    if (dentro || falta > 0) datos.push({
      rotulo: 'Ventana fértil', color: COLOR_FASE.ovulatoria,
      valor: dentro ? 'Ahora' : falta === 1 ? 'Mañana' : `En ${falta} días`,
      detalle: `${fechaCorta(e.fertil.desde)} a ${fechaCorta(e.fertil.hasta)}`,
    });
  }
  const siguiente = e.tramos.find((t) => t.desde > e.hoy && t.fase !== tramo?.fase && t.fase !== 'menstrual');
  if (siguiente) {
    const n = entre(e.hoy, siguiente.desde);
    datos.push({ rotulo: 'Siguiente fase', valor: CORTO[siguiente.fase], detalle: n === 1 ? 'Empieza mañana' : `En ${n} días`, color: COLOR_FASE[siguiente.fase] });
  }
  if (confianza) datos.push({ rotulo: 'Predicción', valor: confianza });

  return (
    <div className="flex flex-col gap-4">
      <Anillo dias={a.dias} entrada={e} paraPareja={paraPareja} foco={foco} onFoco={setFoco} />
      <Tira entrada={e} energiaReal={energiaReal} paraPareja={paraPareja} foco={foco} onFoco={setFoco} />
      <div className="grid grid-cols-2 gap-3">
        {datos.slice(0, 4).map((d, i, todos) => (
          <section key={d.rotulo} className={`card !p-4 flex flex-col gap-1 ${i === todos.length - 1 && todos.length % 2 ? 'col-span-2' : ''}`}>
            <p className="eyebrow flex items-center gap-1.5">{d.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} aria-hidden="true" />}{d.rotulo}</p>
            <p className="font-titulo text-2xl font-semibold leading-tight tabular-nums">{d.valor}</p>
            {d.detalle && <p className="text-xs text-salvia">{d.detalle}</p>}
          </section>
        ))}
      </div>
      {children}
      {tramo && <FaseActual fase={tramo.fase} desde={tramo.desde} hasta={tramo.hasta} hoy={e.hoy} paraPareja={paraPareja} nombre={nombre} />}
      {tramo && <Consejos lista={consejos(tramo.fase, paraPareja, nombre)} />}
    </div>
  );
}

// Los días del ciclo en círculo, con hoy siempre abajo: a la izquierda lo vivido, a la derecha lo que viene.
// La bolita marca el día que se mira en la tira y gira hasta él; tocar un punto también lo elige
function Anillo({ dias, entrada, paraPareja, foco, onFoco }: {
  dias: DiaPronostico[]; entrada: EntradaPronostico; paraPareja: boolean; foco: string; onFoco: (fecha: string) => void;
}) {
  const enHoy = foco === entrada.hoy;
  const otro = enHoy ? null : centroDe(entrada, foco);
  const c = otro ? { ...otro, grande: otro.fase ? CORTO[otro.fase] : otro.grande } : centro(entrada, paraPareja);
  const hito = proximoHito(entrada);
  const paso = 360 / dias.length;
  const tam = Math.min(5.4, 250 / dias.length);
  const diaFoco = dias.find((d) => d.fecha === foco);
  const colorFoco = diaFoco?.fase ? COLOR_FASE[diaFoco.fase] : '#F3FBF5';
  const resumen = [c.rotulo, c.grande, c.detalle, enHoy ? hito : null].filter(Boolean).join('. ');

  return (
    <section className="card-hero flex flex-col items-center gap-4 !pt-5" aria-label="Pronóstico del ciclo">
      <div className="relative w-full max-w-[19rem] aspect-square" role="img" aria-label={resumen}>
        {dias.map((d) => {
          // Cada fecha va siempre en el mismo ángulo, contado desde hoy (abajo)
          const desdeHoy = entre(entrada.hoy, d.fecha);
          const ang = ((90 - desdeHoy * paso) * Math.PI) / 180;
          const color = d.fase ? COLOR_FASE[d.fase] : 'rgba(243,251,245,0.4)';
          return (
            <span key={d.fecha} className="absolute cursor-pointer after:absolute after:-inset-1.5 after:content-['']" aria-hidden="true" onClick={() => onFoco(d.fecha)}
              style={{ left: `${50 + 44 * Math.cos(ang)}%`, top: `${50 + 44 * Math.sin(ang)}%`, width: `${tam}%`, height: `${tam}%`, transform: 'translate(-50%, -50%)' }}>
              <span className="punto-anillo block w-full h-full rounded-full"
                style={{
                  animationDelay: `${Math.abs(desdeHoy) * 18}ms`,
                  ...(d.hoy
                    ? { background: color, boxShadow: '0 0 0 2px #0C2F27, 0 0 0 3.5px #F3FBF5' }
                    : d.pasado
                      ? { border: `2px solid ${color}`, opacity: 0.55 }
                      : { background: color, opacity: d.estimado ? 0.9 : 1, boxShadow: d.fertil ? `0 0 10px 1px ${COLOR_FASE.ovulatoria}88` : undefined }),
                }} />
            </span>
          );
        })}
        {/* La bolita: gira sobre el centro del anillo hasta el día que se mira */}
        <div className="bolita-anillo absolute inset-0 pointer-events-none" aria-hidden="true" style={{ transform: `rotate(${-entre(entrada.hoy, foco) * paso}deg)` }}>
          <span className="absolute rounded-full transition-[background-color,box-shadow] duration-300"
            style={{ left: '50%', top: '94%', width: `${tam * 1.9}%`, height: `${tam * 1.9}%`, transform: 'translate(-50%, -50%)', background: colorFoco, boxShadow: `0 0 0 3px #0C2F27, 0 0 0 5px #F3FBF5, 0 0 18px 4px ${colorFoco}66` }} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[18%] pointer-events-none">
          <p className="eyebrow !text-[#CFE6D7]">{c.rotulo}</p>
          <p className={`font-titulo font-bold leading-none tabular-nums mt-1 ${c.grande.length > 9 ? 'text-[1.9rem]' : 'text-[2.6rem]'}`}>{c.grande}</p>
          {c.detalle && <p className="text-sm opacity-85 mt-2">{c.detalle}</p>}
        </div>
      </div>
      {enHoy
        ? hito && <p className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.1em] text-[#E6F3EA]">{hito}</p>
        : <button type="button" onClick={() => onFoco(entrada.hoy)} className="w-full min-h-11 rounded-full border border-white/25 bg-white/15 px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.1em] text-[#F3FBF5]">Volver a hoy</button>}
    </section>
  );
}

const COL = 44;
const ALTO = 92;

// Curva suave por los puntos (Catmull-Rom a Bézier), cortada donde no hay datos
function trazo(valores: (number | null)[], cerrar: boolean): string {
  const tramos: [number, number][][] = [];
  valores.forEach((v, i) => {
    if (v == null) { tramos.push([]); return; }
    if (!tramos.length) tramos.push([]);
    tramos[tramos.length - 1].push([i * COL + COL / 2, ALTO - 6 - v * (ALTO - 16)]);
  });
  return tramos.filter((t) => t.length > 1).map((pts) => {
    let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
    }
    return cerrar ? `${d} L${pts[pts.length - 1][0]},${ALTO} L${pts[0][0]},${ALTO} Z` : d;
  }).join(' ');
}

const moverSuave = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tres semanas por delante y una atrás, con la energía que suele tener y las fases abajo. El día que queda en el
// centro es el que se mira (el anillo lo sigue con la bolita); tocar un día lo trae al centro
function Tira({ entrada, energiaReal, paraPareja, foco, onFoco }: {
  entrada: EntradaPronostico; energiaReal?: Map<string, number>; paraPareja: boolean; foco: string; onFoco: (fecha: string) => void;
}) {
  const dias = useMemo(() => tira(entrada), [entrada]);
  const cs = useMemo(() => curvas(entrada, dias), [entrada, dias]);
  const bs = useMemo(() => bandas(dias), [dias]);
  const ref = useRef<HTMLDivElement>(null);
  // Mientras la tira se mueve sola hasta un día, los días por los que pasa no cuentan como elegidos
  const destino = useRef<number | null>(null);
  const cuadro = useRef(0);
  const iHoy = dias.findIndex((d) => d.hoy);
  const iFoco = dias.findIndex((d) => d.fecha === foco);
  // Con los rellenos de los lados, el día i queda en el centro cuando scrollLeft = i * COL
  const enCentro = () => Math.round((ref.current?.scrollLeft ?? 0) / COL);

  useLayoutEffect(() => {
    if (ref.current && iHoy >= 0) ref.current.scrollLeft = iHoy * COL;
  }, [iHoy]);

  useEffect(() => {
    const el = ref.current;
    if (!el || iFoco < 0 || enCentro() === iFoco) return;
    destino.current = iFoco;
    el.scrollTo({ left: iFoco * COL, behavior: moverSuave() ? 'smooth' : 'auto' });
    const t = setTimeout(() => { destino.current = null; }, 900);
    return () => clearTimeout(t);
  }, [iFoco]);

  useEffect(() => () => cancelAnimationFrame(cuadro.current), []);

  const alDeslizar = () => {
    if (cuadro.current) return;
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = 0;
      const i = Math.max(0, Math.min(dias.length - 1, enCentro()));
      if (destino.current != null) { if (i === destino.current) destino.current = null; return; }
      if (dias[i]) onFoco(dias[i].fecha);
    });
  };

  if (dias.length < 2) return null;
  const ancho = dias.length * COL;
  const reales = energiaReal ? dias.map((d, i) => ({ i, v: energiaReal.get(d.fecha) })).filter((x): x is { i: number; v: number } => x.v != null) : [];
  const elegido = dias[iFoco];
  const rotuloFoco = !elegido || elegido.hoy ? 'Hoy' : new Date(elegido.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace(/\./g, '');
  const relleno = <span className="shrink-0" style={{ width: `calc(50cqw - ${COL / 2}px)` }} aria-hidden="true" />;

  return (
    <section className="card !px-0 flex flex-col gap-3" aria-labelledby="tira-titulo">
      <div className="px-5 flex items-baseline justify-between gap-2">
        <h2 id="tira-titulo" className="text-lg font-bold">Los próximos días</h2>
        <p className="text-xs text-salvia text-right">{elegido?.fase ? <><b className="text-bosque-oscuro">{rotuloFoco}</b> · {CORTO[elegido.fase]}</> : 'Desliza'}</p>
      </div>
      <div className="relative">
        {/* Marco fijo en el centro: el día que queda dentro es el que se mira */}
        <span className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-2xl border-2 border-esmeralda/45 bg-esmeralda/[0.06] pointer-events-none" style={{ width: COL }} aria-hidden="true" />
        <div ref={ref} onScroll={alDeslizar} className="overflow-x-auto sin-barra overscroll-x-contain snap-x snap-mandatory" style={{ containerType: 'inline-size' }}
          tabIndex={0} aria-label="Días del ciclo, desliza para ver cada día">
          <div className="flex w-max">
            {relleno}
            <div className="relative" style={{ width: ancho }}>
              <ol className="flex" aria-label="Fase de cada día">
                {dias.map((d) => {
                  const f = new Date(d.fecha + 'T00:00:00');
                  const esFoco = d.fecha === foco;
                  return (
                    <li key={d.fecha} className="flex flex-col items-center gap-1.5 shrink-0 snap-center" style={{ width: COL }}>
                      <button type="button" onClick={() => onFoco(d.fecha)} aria-pressed={esFoco}
                        aria-label={`${f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}${d.hoy ? ', hoy' : ''}${d.fase ? `, ${NOMBRE_FASE[d.fase].toLowerCase()}` : ''}${d.fertil ? ', ventana fértil' : ''}`}
                        className={`flex flex-col items-center rounded-full py-1.5 w-9 leading-tight transition-colors ${d.hoy ? 'bg-hondo text-white' : esFoco ? 'bg-seleccion text-bosque-oscuro' : d.pasado ? 'text-salvia' : 'text-bosque-oscuro'}`}>
                        <span className="text-[0.65rem] font-bold uppercase">{f.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').slice(0, 3)}</span>
                        <span className="text-sm font-extrabold tabular-nums">{f.getDate()}</span>
                      </button>
                      <span className={`w-2.5 h-2.5 rounded-full transition-transform ${esFoco ? 'scale-150' : ''}`} aria-hidden="true"
                        style={d.fase ? (d.pasado ? { border: `2px solid ${COLOR_FASE[d.fase]}` } : { background: COLOR_FASE[d.fase] }) : undefined} />
                    </li>
                  );
                })}
              </ol>
              <svg width={ancho} height={ALTO} className="block mt-2" aria-hidden="true">
                <defs>
                  <linearGradient id="grad-energia" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--color-esmeralda)" stopOpacity="0.45" />
                    <stop offset="1" stopColor="var(--color-esmeralda)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="grad-sensible" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--color-coral)" stopOpacity="0.28" />
                    <stop offset="1" stopColor="var(--color-coral)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {dias.map((d, i) => <line key={d.fecha} x1={i * COL + COL / 2} x2={i * COL + COL / 2} y1={0} y2={ALTO} stroke="var(--color-menta)" strokeWidth={1} opacity={0.7} />)}
                <path d={trazo(cs.sensibilidad, true)} fill="url(#grad-sensible)" />
                <path d={trazo(cs.energia, true)} fill="url(#grad-energia)" />
                <path d={trazo(cs.sensibilidad, false)} fill="none" stroke="var(--color-coral)" strokeWidth={2} strokeLinecap="round" opacity={0.75} />
                <path d={trazo(cs.energia, false)} fill="none" stroke="var(--color-esmeralda)" strokeWidth={2.5} strokeLinecap="round" />
                {reales.map(({ i, v }) => <circle key={i} cx={i * COL + COL / 2} cy={ALTO - 6 - (v === 1 ? 0.2 : v === 2 ? 0.55 : 0.9) * (ALTO - 16)} r={4} fill="var(--color-tarjeta)" stroke="var(--color-bosque)" strokeWidth={2} />)}
                {iHoy >= 0 && <line x1={iHoy * COL + COL / 2} x2={iHoy * COL + COL / 2} y1={0} y2={ALTO} stroke="var(--color-bosque-oscuro)" strokeWidth={2} strokeLinecap="round" />}
              </svg>
              <div className="relative h-9 mt-2" aria-hidden="true">
                {bs.map((b) => (
                  <span key={`${b.fase}-${b.desde}`} className="absolute top-0 h-9 rounded-full flex items-center justify-center px-3 text-xs font-extrabold text-[#0E2A20] overflow-hidden whitespace-nowrap"
                    style={{ left: b.desde * COL + 3, width: b.largo * COL - 6, background: COLOR_FASE[b.fase] }}>
                    <span className="truncate">{b.largo >= 2 ? CORTO[b.fase] : ''}</span>
                  </span>
                ))}
              </div>
            </div>
            {relleno}
          </div>
        </div>
      </div>
      <ul className="px-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-salvia" aria-label="Convenciones">
        <li className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full bg-esmeralda" />Energía</li>
        <li className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full bg-coral opacity-75" />Sensibilidad</li>
        {reales.length > 0 && <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-bosque" />Tu energía registrada</li>}
      </ul>
      <p className="px-5 text-xs text-salvia -mt-1">{paraPareja ? 'Es lo que suele pasar en cada fase, no lo que ella siente: para eso, pregúntale.' : 'Es lo que suele pasar en cada fase; tu cuerpo puede ir a su ritmo.'}</p>
    </section>
  );
}

// La luna sobre el mar cambia con la fase: nueva en el periodo, llena a mitad del ciclo
const SOMBRA: Record<Fase, number | null> = { menstrual: 0, folicular: -15, ovulatoria: null, lutea: 40, premenstrual: 15, hormonal: -27 };

function Luna({ fase }: { fase: Fase }) {
  const s = SOMBRA[fase];
  const color = COLOR_FASE[fase];
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[15rem]" aria-hidden="true">
      <defs>
        <mask id={`luna-${fase}`}>
          <circle cx="100" cy="50" r="30" fill="#fff" />
          {s != null && <circle cx={100 + s} cy="46" r="30" fill="#000" />}
        </mask>
        <linearGradient id="borde-mar">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.2" stopColor="#fff" />
          <stop offset="0.8" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="mar-luna"><rect width="200" height="120" fill="url(#borde-mar)" /></mask>
        <radialGradient id="halo-luna">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="50" r="52" fill="url(#halo-luna)" />
      {[[34, 22], [58, 12], [150, 18], [168, 40], [44, 50], [140, 62]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={1.6} fill="var(--color-salvia)" opacity={0.5} />)}
      <circle cx="100" cy="50" r="30" fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={s === 0 ? '3 4' : undefined} opacity={0.6} />
      <circle cx="100" cy="50" r="30" fill={color} mask={`url(#luna-${fase})`} />
      <g mask="url(#mar-luna)">
        <path d="M0 92 C25 84 45 84 70 91 S120 99 145 91 S185 83 200 88 V120 H0Z" fill="var(--color-espuma)" />
        <path d="M0 104 C30 97 50 98 80 104 S130 111 160 104 S190 99 200 101 V120 H0Z" fill="var(--color-menta)" />
        {s !== 0 && [[86, 96, 28], [92, 104, 16]].map(([x, y, w]) => <rect key={y} x={x} y={y} width={w} height={2.5} rx={1.25} fill={color} opacity={0.6} />)}
      </g>
    </svg>
  );
}

function FaseActual({ fase, desde, hasta, hoy, paraPareja, nombre }: { fase: Fase; desde: string; hasta: string; hoy: string; paraPareja: boolean; nombre: string }) {
  const info = INFO_FASE[fase];
  const total = entre(desde, hasta) + 1;
  const dia = entre(desde, hoy) + 1;
  return (
    <section className="card flex flex-col items-center text-center gap-3" aria-labelledby="fase-titulo">
      <p className="eyebrow">Fase actual</p>
      <Luna fase={fase} />
      <div>
        <h2 id="fase-titulo" className="font-titulo text-[1.65rem] font-semibold leading-tight">{NOMBRE_FASE[fase]}</h2>
        <p className="text-sm font-bold text-bosque mt-0.5">{info.estacion}</p>
      </div>
      <p>{paraPareja ? info.pareja(nombre) : info.propia}</p>
      {fase !== 'hormonal' && total > 1 && (
        <div className="w-full flex flex-col gap-1.5 mt-1">
          <div className="h-2 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={dia} aria-label="Avance de la fase">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (dia / total) * 100)}%`, background: COLOR_FASE[fase] }} />
          </div>
          <p className="text-xs text-salvia">Día {dia} de unos {total} de esta fase</p>
        </div>
      )}
    </section>
  );
}

const ICONO: Record<Consejo['id'], ReactNode> = {
  cuerpo: <IconoHoja className="w-5 h-5" />,
  animo: <Corazon className="w-5 h-5" lleno={false} />,
  comida: <IconoCubiertos className="w-5 h-5" />,
  juntos: <IconoOla className="w-5 h-5" />,
};

function Consejos({ lista }: { lista: Consejo[] }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="consejos-titulo">
      <h2 id="consejos-titulo" className="text-lg font-bold px-1">Ideas para hoy</h2>
      <ul className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory sin-barra pb-2">
        {lista.map((c) => (
          <li key={c.id} className="card !p-4 snap-start scroll-ml-5 shrink-0 w-[72%] max-w-[17rem] flex flex-col gap-2">
            <span className="w-10 h-10 rounded-full bg-seleccion text-bosque flex items-center justify-center">{ICONO[c.id]}</span>
            <p className="font-bold">{c.titulo}</p>
            <p className="text-sm text-salvia">{c.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
