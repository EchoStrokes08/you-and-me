import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { IconoCerrar } from '../../components/ui';
import './flores.css';

// Aleatorio con semilla: el ramo se ve igual cada vez que se abre
const azar = (semilla: number) => () => {
  semilla = (semilla * 16807) % 2147483647;
  return (semilla - 1) / 2147483646;
};

// Base del ramo, de donde salen todos los tallos (coordenadas del viewBox)
const BASE = { x: 200, y: 640 };

type Flor = { x: number; y: number; r: number; giro: number; pliegue: number; razon: string };

const FLORES: Flor[] = [
  { x: 200, y: 250, r: 64, giro: 0, pliegue: 0, razon: 'Because choosing you is the easiest decision I make every day.' },
  { x: 118, y: 318, r: 48, giro: 12, pliegue: -14, razon: 'Because your hugs fix things that words can’t.' },
  { x: 284, y: 305, r: 50, giro: -8, pliegue: 16, razon: 'Because you always find a way to make me laugh when I’m crying.' },
  { x: 150, y: 168, r: 42, giro: 20, pliegue: -8, razon: 'Because you text me “did you get home okay?” every time I leave.' },
  { x: 262, y: 160, r: 44, giro: -15, pliegue: 10, razon: 'Because your laugh is my favorite sound.' },
  { x: 72, y: 222, r: 32, giro: 30, pliegue: -22, razon: 'Because you celebrate my wins like they’re your own.' },
  { x: 330, y: 214, r: 33, giro: -26, pliegue: 24, razon: 'Because you look at me like I’m the best thing that ever happened to you.' },
  { x: 205, y: 395, r: 40, giro: 6, pliegue: 0, razon: 'Because you’re home, wherever you are.' },
];

// Línea de tiempo del florecer, en segundos
const T = {
  texto: 0.1,
  lazo: 0.6,
  tallo: 0.9, talloPaso: 0.07, talloDur: 1.3,
  cabeza: 2.2, cabezaPaso: 0.22, abreDur: 1.1,
  polen: 4.4,
  listo: 4.9, // desde aquí se puede tocar
};
// Orden en que florecen: de afuera hacia adentro, la grande del centro de última
const ORDEN = [7, 1, 2, 5, 6, 3, 4, 0];
const retrasoTallo = (i: number) => T.tallo + ORDEN.indexOf(i) * T.talloPaso;
const retrasoCabeza = (i: number) => T.cabeza + ORDEN.indexOf(i) * T.cabezaPaso;
// Cada flor se mece a su ritmo; tallo y cabeza usan los mismos valores para moverse juntos
const vaiven = (i: number): CSSProperties => ({ animationDuration: `${6 + ((i * 0.73) % 2.4)}s`, animationDelay: `${-i * 1.3}s` });
// Las más grandes se dibujan al final para quedar al frente
const zonaTactil = (f: Flor) => Math.max(f.r * 1.1, 38);
const POR_TAMANO =FLORES.map((_, i) => i).sort((a, b) => FLORES[a].r - FLORES[b].r);

const GUARDADO = 'flores-abiertas';
const leerAbiertas = () => {
  try {
    const v = JSON.parse(localStorage.getItem(GUARDADO) ?? '[]');
    return new Set<number>(Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n >= 0 && n < FLORES.length) : []);
  } catch {
    return new Set<number>();
  }
};

// Pétalo alargado con la punta suavemente redondeada
const petalo = (l: number, a: number) =>
  `M0 0 C ${a} ${-l * 0.25} ${a * 0.95} ${-l * 0.8} ${a * 0.18} ${-l} Q 0 ${-l * 1.03} ${-a * 0.18} ${-l} C ${-a * 0.95} ${-l * 0.8} ${-a} ${-l * 0.25} 0 0Z`;

function Cabeza({ r, semilla, retraso }: { r: number; semilla: number; retraso: number }) {
  const rnd = useMemo(() => azar(semilla), [semilla]);
  const capas = useMemo(() => {
    const disco = r * 0.38;
    const anillo = (n: number, largo: number, ancho: number, desfase: number, grad: string) =>
      Array.from({ length: n }, (_, i) => ({
        ang: (360 / n) * i + desfase + (rnd() - 0.5) * 6,
        l: largo * (0.88 + rnd() * 0.2),
        a: ancho * (0.85 + rnd() * 0.3),
        grad,
      }));
    // Semillas del centro en espiral (ángulo áureo), como un girasol de verdad
    const semillas = Array.from({ length: Math.round(disco * 3.2) }, (_, i) => {
      const t = i * 137.508 * (Math.PI / 180);
      const d = disco * 0.92 * Math.sqrt(i / (disco * 3.2));
      return { x: Math.cos(t) * d, y: Math.sin(t) * d, s: 0.7 + (d / disco) * 0.9 };
    });
    return {
      disco,
      atras: anillo(16, r, r * 0.17, 11, 'url(#petalo-oscuro)'),
      frente: anillo(16, r * 0.9, r * 0.15, 0, 'url(#petalo)'),
      semillas,
    };
  }, [r, rnd]);

  return (
    <g>
      {/* El brillo se enciende cuando la flor ya casi terminó de abrirse */}
      <g className="flores-enciende" style={{ animationDelay: `${retraso + T.abreDur * 0.7}s` }}>
        <circle r={r * 1.7} fill="url(#halo)" className="flores-halo" />
      </g>
      <circle r={r * 1.8} fill="url(#halo-calido)" className="flores-halo-calido" />
      <g className="flores-recoge" style={{ animationDelay: `${retraso}s` }}>
        <g filter="url(#brillo)">
          {[...capas.atras, ...capas.frente].map((p, i) => (
            <g key={i} transform={`rotate(${p.ang})`}>
              <path d={petalo(p.l, p.a)} fill={p.grad} />
              <path d={`M0 ${-p.l * 0.12} Q ${p.a * 0.08} ${-p.l * 0.55} 0 ${-p.l * 0.92}`} stroke="#b45309" strokeOpacity="0.22" strokeWidth="0.8" fill="none" />
            </g>
          ))}
        </g>
      </g>
      <circle r={capas.disco * 1.12} fill="#3b1d06" opacity="0.6" />
      <circle r={capas.disco} fill="url(#disco)" />
      {capas.semillas.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill={i % 3 ? '#2a1404' : '#7c3f0e'} opacity="0.85" />
      ))}
      <circle r={capas.disco} fill="url(#disco-luz)" />
    </g>
  );
}

function Tallo({ f, i }: { f: Flor; i: number }) {
  const cx = (BASE.x + f.x) / 2 + f.pliegue * 2;
  const cy = (BASE.y + f.y) / 2 + 40;
  const d = `M${BASE.x} ${BASE.y} Q ${cx} ${cy} ${f.x} ${f.y + f.r * 0.3}`;
  // Hoja a mitad del tallo (t = 0.5 de la curva), hacia afuera del ramo
  const lado = f.x < BASE.x ? -1 : 1;
  const hx = (BASE.x + 2 * cx + f.x) / 4;
  const hy = (BASE.y + 2 * cy + f.y) / 4;
  const retraso = retrasoTallo(i);
  return (
    <g className="flores-mece" style={vaiven(i)}>
      <path d={d} pathLength={1} stroke="url(#tallo)" strokeWidth={3 + f.r / 22} fill="none" strokeLinecap="round" className="flores-tallo"
        style={{ animationDelay: `${retraso}s`, animationDuration: `${T.talloDur}s` }} />
      {i % 2 === 0 && (
        // El giro va en el <g>: la animación CSS reemplazaría el transform del path
        <g transform={`translate(${hx} ${hy}) rotate(${lado * 55}) scale(${lado} 1)`}>
          <path d="M0 0 C 14 -10 34 -12 52 -2 C 34 8 14 8 0 0Z" fill="url(#hoja)" className="flores-hoja" style={{ animationDelay: `${retraso + T.talloDur * 0.5}s` }} />
        </g>
      )}
    </g>
  );
}

const fechaBonita = () => {
  const d = new Date();
  return {
    dia: d.toLocaleDateString('en-US', { weekday: 'long' }),
    numero: d.getDate(),
    mes: d.toLocaleDateString('en-US', { month: 'long' }),
    anio: d.getFullYear(),
  };
};

const SUAVE = [0.22, 1, 0.36, 1] as const;

export default function FloresAmarillas() {
  const navigate = useNavigate();
  const fecha = useMemo(() => fechaBonita(), []);
  const [reducido] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const [ronda, setRonda] = useState(0); // cambia con "See it again" para repetir el florecer
  const [listo, setListo] = useState(reducido);
  const [abiertas, setAbiertas] = useState(leerAbiertas);
  const [tarjeta, setTarjeta] = useState<number | null>(null);
  const [nota, setNota] = useState(false);
  const [lluvia, setLluvia] = useState(0);
  const todas = abiertas.size === FLORES.length;

  const svgRef = useRef<SVGSVGElement>(null);
  const inclinaRefs = useRef<(SVGGElement | null)[]>([]);
  const pulsoRefs = useRef<(SVGGElement | null)[]>([]);
  const zonaRefs = useRef<(SVGCircleElement | null)[]>([]);
  const objetivo = useRef<{ x: number; y: number } | null>(null);
  const cuadro = useRef(0);

  // La interactividad se activa cuando termina la entrada
  useEffect(() => {
    if (reducido) return;
    const t = setTimeout(() => setListo(true), T.listo * 1000);
    return () => clearTimeout(t);
  }, [ronda, reducido]);

  useEffect(() => {
    try { localStorage.setItem(GUARDADO, JSON.stringify([...abiertas])); } catch { /* sin almacenamiento: solo se pierde el contador */ }
  }, [abiertas]);

  // La lluvia se quita sola cuando ya cayeron todos los pétalos
  useEffect(() => {
    if (!lluvia) return;
    const t = setTimeout(() => setLluvia(0), 12000);
    return () => clearTimeout(t);
  }, [lluvia]);

  useEffect(() => () => cancelAnimationFrame(cuadro.current), []);

  useEffect(() => {
    if (tarjeta === null && !nota) return;
    const alEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setTarjeta(null); setNota(false); }
    };
    window.addEventListener('keydown', alEscape);
    return () => window.removeEventListener('keydown', alEscape);
  }, [tarjeta, nota]);

  const polen = useMemo(() => {
    const rnd = azar(7);
    return Array.from({ length: 34 }, () => ({
      left: `${rnd() * 100}%`,
      top: `${30 + rnd() * 65}%`,
      size: 1.5 + rnd() * 3,
      dur: 7 + rnd() * 9,
      delay: -rnd() * 14,
    }));
  }, []);

  const petalos = useMemo(() => {
    const rnd = azar(29);
    return Array.from({ length: 26 }, () => ({
      left: `${rnd() * 96}%`,
      w: 9 + rnd() * 6,
      h: 17 + rnd() * 9,
      dur: 6 + rnd() * 4,
      delay: rnd() * 2.6,
      dx: `${(rnd() - 0.5) * 140}px`,
      giro: `${20 + rnd() * 40}deg`,
      vuelta: 1.8 + rnd() * 1.6,
    }));
  }, []);

  // Las cabezas se inclinan hacia el dedo (o el mouse), como buscando el sol
  const inclinar = () => {
    cuadro.current = 0;
    const o = objetivo.current;
    FLORES.forEach((f, i) => {
      const el = inclinaRefs.current[i];
      if (!el) return;
      if (!o) { el.style.transform = ''; return; }
      const dx = o.x - f.x;
      const dy = o.y - f.y;
      const dist = Math.hypot(dx, dy) || 1;
      const giro = Math.max(-1, Math.min(1, dx / 180)) * 5;
      const paso = Math.min(dist / 60, 1) * 3;
      el.style.transform = `translate(${(dx / dist) * paso}px, ${(dy / dist) * paso}px) rotate(${giro}deg)`;
    });
  };
  const programar = () => { if (!cuadro.current) cuadro.current = requestAnimationFrame(inclinar); };
  const apuntar = (e: PointerEvent) => {
    if (!listo || reducido || tarjeta !== null || nota) return;
    if (e.pointerType !== 'mouse' && !e.buttons) return;
    const m = svgRef.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    objetivo.current = { x: p.x, y: p.y };
    programar();
  };
  const soltar = () => {
    if (!objetivo.current) return;
    objetivo.current = null;
    programar();
  };

  const tocarFlor = (i: number) => {
    if (!listo) return;
    soltar();
    setTarjeta(i);
    setAbiertas((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    if (!reducido) {
      pulsoRefs.current[i]?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }],
        { duration: 900, easing: 'ease-in-out' },
      );
    }
  };

  // Las zonas táctiles se solapan (la grande del centro cubre parte de sus vecinas), así que
  // el toque es de la flor más cercana en proporción a su tamaño, medida donde está ahora mismo
  const florEn = (x: number, y: number) => {
    let mejor = -1;
    let menor = Infinity;
    FLORES.forEach((f, i) => {
      const zona = zonaRefs.current[i]?.getBoundingClientRect();
      if (!zona) return;
      const radio = zona.width / 2;
      const d = Math.hypot(x - (zona.left + radio), y - (zona.top + zona.height / 2));
      if (d > radio) return;
      const relativa = d / ((radio * f.r) / zonaTactil(f));
      if (relativa < menor) { menor = relativa; mejor = i; }
    });
    return mejor;
  };

  const tocarRamo = (e: MouseEvent) => {
    if ((e.target as Element).closest('.flores-lazo-toque')) return;
    const i = florEn(e.clientX, e.clientY);
    if (i >= 0) tocarFlor(i);
  };

  const tocarLazo = () => {
    if (!listo) return;
    soltar();
    setTarjeta(null);
    if (!reducido) setLluvia((n) => n + 1);
    setNota(true);
  };

  const conTeclado = (e: KeyboardEvent, accion: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); accion(); }
  };

  const verOtraVez = () => {
    soltar();
    setNota(false);
    setTarjeta(null);
    setLluvia(0);
    setAbiertas(new Set());
    setListo(reducido);
    setRonda((n) => n + 1);
  };

  const pista = abiertas.size === 0 ? 'Tap the sunflowers 🌻' : `${abiertas.size} of ${FLORES.length}`;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`flores-pagina fixed inset-0 z-50 overflow-hidden bg-black text-white touch-none select-none${listo ? ' flores-listo' : ''}`}
        onPointerDown={apuntar}
        onPointerMove={apuntar}
        onPointerUp={(e) => e.pointerType !== 'mouse' && soltar()}
        onPointerCancel={soltar}
        onPointerLeave={soltar}
      >
        <div className="absolute inset-0 flores-fondo" aria-hidden="true" />

        <div key={ronda} className="absolute inset-0">
          <div className="flores-polen-capa absolute inset-0 pointer-events-none" style={{ animationDelay: `${T.polen}s` }} aria-hidden="true">
            {polen.map((p, i) => (
              <span key={i} className="flores-polen"
                style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
            ))}
          </div>

          <div className="relative h-full max-w-lg mx-auto flex flex-col">
            <header className="pt-[max(calc(env(safe-area-inset-top)+3.5rem),4.5rem)] px-6 text-center flores-texto" style={{ animationDelay: `${T.texto}s` }}>
              <h1 className="font-titulo text-[3.4rem] leading-tight">
                <span className="italic font-medium flores-titulo pr-1 pb-2">For you</span> 💚
              </h1>
              <div className="mt-5 inline-flex flex-col items-center">
                <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.35em] text-amber-200/70">{fecha.dia}</span>
                <span className="flex items-center gap-3 mt-1.5">
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/60" />
                  <span className="font-titulo text-2xl text-amber-50">
                    {fecha.mes} <span className="text-amber-300 font-semibold">{fecha.numero}</span>
                  </span>
                  <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/60" />
                </span>
                <span className="text-xs tracking-[0.3em] text-white/40 mt-1.5">{fecha.anio}</span>
              </div>
            </header>

            <svg ref={svgRef} onClick={tocarRamo} viewBox="0 0 400 660" className="flex-1 w-full min-h-0 -mt-4" preserveAspectRatio="xMidYMax meet" role="group" aria-label="A bouquet of yellow flowers">
              <defs>
                <linearGradient id="petalo" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="#e88a07" />
                  <stop offset="0.35" stopColor="#fbbf24" />
                  <stop offset="0.8" stopColor="#fde047" />
                  <stop offset="1" stopColor="#fef3a0" />
                </linearGradient>
                <linearGradient id="petalo-oscuro" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="#9a4f04" />
                  <stop offset="0.5" stopColor="#e3a008" />
                  <stop offset="1" stopColor="#f8cf3a" />
                </linearGradient>
                <radialGradient id="disco" cx="0.45" cy="0.4" r="0.65">
                  <stop offset="0" stopColor="#8a4b12" />
                  <stop offset="0.6" stopColor="#4a2307" />
                  <stop offset="1" stopColor="#1f0d02" />
                </radialGradient>
                <radialGradient id="disco-luz" cx="0.35" cy="0.3" r="0.6">
                  <stop offset="0" stopColor="#ffd27a" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="halo">
                  <stop offset="0" stopColor="#fcd34d" stopOpacity="0.45" />
                  <stop offset="0.45" stopColor="#f59e0b" stopOpacity="0.14" />
                  <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="halo-calido">
                  <stop offset="0" stopColor="#fdba74" stopOpacity="0.5" />
                  <stop offset="0.45" stopColor="#f97316" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#f97316" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="tallo" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stopColor="#14532d" />
                  <stop offset="1" stopColor="#4d7c0f" />
                </linearGradient>
                <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#166534" />
                  <stop offset="1" stopColor="#65a30d" />
                </linearGradient>
                <filter id="brillo" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feColorMatrix in="b" values="1 0 0 0 0.1  0 1 0 0 0.05  0 0 1 0 0  0 0 0 0.9 0" result="g" />
                  <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {FLORES.map((f, i) => <Tallo key={i} f={f} i={i} />)}

              {/* Lazo verde que une el ramo; esconde la nota final */}
              <g className="flores-lazo" style={{ animationDelay: `${T.lazo}s` }}>
                <circle cx="200" cy="606" r="48" fill="url(#halo)" className={`flores-lazo-luz${listo && todas ? ' encendida' : ''}`} />
                <path d="M184 600 Q200 590 216 600 L214 618 Q200 612 186 618Z" fill="#15803d" />
                <path d="M200 604 C 180 590 166 596 172 610 C 178 620 194 612 200 604Z M200 604 C 220 590 234 596 228 610 C 222 620 206 612 200 604Z" fill="#22c55e" opacity="0.9" />
                <circle cx="200" cy="606" r="36" fill="transparent" className="flores-lazo-toque"
                  role="button" tabIndex={listo ? 0 : -1} aria-label="The ribbon"
                  onClick={tocarLazo} onKeyDown={(e) => conTeclado(e, tocarLazo)} />
              </g>

              {POR_TAMANO.map((i) => {
                const f = FLORES[i];
                const retraso = retrasoCabeza(i);
                return (
                  <g key={i} className={`flores-mece flores-flor${abiertas.has(i) ? ' abierta' : ''}${tarjeta === i ? ' activa' : ''}`} style={vaiven(i)}
                    role="button" tabIndex={listo ? 0 : -1} aria-label={`Sunflower ${ORDEN.indexOf(i) + 1}`}
                    onKeyDown={(e) => conTeclado(e, () => tocarFlor(i))}>
                    <g transform={`translate(${f.x} ${f.y})`}>
                      <g ref={(el) => { inclinaRefs.current[i] = el; }} className="flores-inclina">
                        <g ref={(el) => { pulsoRefs.current[i] = el; }} className="flores-pulso">
                          <g transform={`rotate(${f.giro})`}>
                            <g className="flores-abre" style={{ animationDelay: `${retraso}s`, animationDuration: `${T.abreDur}s` }}>
                              <Cabeza r={f.r} semilla={i * 97 + 13} retraso={retraso} />
                            </g>
                          </g>
                        </g>
                      </g>
                      {/* Zona táctil: cómoda incluso en las flores pequeñas; el toque lo reparte florEn */}
                      <circle ref={(el) => { zonaRefs.current[i] = el; }} r={zonaTactil(f)} fill="transparent" />
                    </g>
                  </g>
                );
              })}
            </svg>

            <p className={`flores-pista text-center text-[0.72rem] tracking-[0.2em] text-amber-200/70 pt-1 pb-[max(env(safe-area-inset-bottom),14px)]${listo ? ' visible' : ''}`} aria-live="polite">
              <span key={pista} className="flores-cambia inline-block">{pista}</span>
            </p>
          </div>
        </div>

        {lluvia > 0 && (
          <div key={lluvia} className="absolute inset-0 z-20 overflow-hidden pointer-events-none" aria-hidden="true">
            {petalos.map((p, i) => (
              <span key={i} className="flores-cae"
                style={{ left: p.left, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, '--dx': p.dx } as CSSProperties}>
                <span className="flores-petalo" style={{ width: p.w, height: p.h, animationDuration: `${p.vuelta}s`, '--giro': p.giro } as CSSProperties} />
              </span>
            ))}
          </div>
        )}

        <button onClick={() => navigate('/')} aria-label="Close"
          className="absolute z-10 left-4 top-[max(env(safe-area-inset-top),16px)] w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white/80">
          <IconoCerrar />
        </button>

        {/* Tarjeta con la razón de cada girasol */}
        <AnimatePresence>
          {tarjeta !== null && (
            <motion.div key="tarjeta" className="absolute inset-0 z-30 flex items-end sm:items-center justify-center px-4 pb-[max(calc(env(safe-area-inset-bottom)+1.5rem),2rem)] sm:pb-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
              onClick={() => setTarjeta(null)}>
              <div className="absolute inset-0 bg-black/30" />
              <motion.div role="dialog" aria-modal="true" aria-label="Reasons I love you" onClick={(e) => e.stopPropagation()}
                initial={{ y: 18 }} animate={{ y: 0 }} exit={{ y: 10 }} transition={{ duration: 0.6, ease: SUAVE }}
                className="flores-tarjeta relative w-full max-w-sm rounded-3xl px-7 pt-9 pb-8 text-center">
                <button onClick={() => setTarjeta(null)} aria-label="Close" className="absolute right-2 top-2 w-10 h-10 flex items-center justify-center text-amber-100/50">
                  <IconoCerrar className="w-4 h-4" />
                </button>
                <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.3em] text-amber-200/70">Reasons I love you</span>
                <span className="flex items-center justify-center gap-3 mt-3" aria-hidden="true">
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/60" />
                  <span className="text-sm">🌻</span>
                  <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/60" />
                </span>
                <p className="font-titulo italic text-[1.45rem] leading-snug text-amber-50 mt-4 text-balance">{FLORES[tarjeta].razon}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nota final escondida en el lazo */}
        <AnimatePresence>
          {nota && (
            <motion.div key="nota" className="absolute inset-0 z-30 flex items-center justify-center px-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 1.2, delay: reducido ? 0 : 0.8 } }} exit={{ opacity: 0, transition: { duration: 0.5 } }}
              onClick={() => setNota(false)}>
              <div className="absolute inset-0 bg-black/35" />
              <motion.div role="dialog" aria-modal="true" aria-label="A note for you" onClick={(e) => e.stopPropagation()}
                initial={{ y: 18 }} animate={{ y: 0, transition: { duration: 1.2, delay: reducido ? 0 : 0.8, ease: SUAVE } }} exit={{ y: 10 }}
                className="flores-tarjeta relative w-full max-w-sm rounded-3xl px-7 pt-11 pb-7 text-center">
                <button onClick={() => setNota(false)} aria-label="Close" className="absolute right-2 top-2 w-10 h-10 flex items-center justify-center text-amber-100/50">
                  <IconoCerrar className="w-4 h-4" />
                </button>
                <p className="font-titulo italic text-[1.75rem] leading-snug text-balance">
                  <span className="flores-titulo">And there’s a million little reasons more.</span>
                </p>
                <p className="font-titulo text-2xl text-amber-50 mt-4">I love you 💚</p>
                <button onClick={verOtraVez} className="mt-8 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.3em] text-amber-200/55">
                  See it again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
