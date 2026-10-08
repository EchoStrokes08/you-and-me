import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconoCerrar } from '../../components/ui';
import './flores.css';

// Aleatorio con semilla: el ramo se ve igual cada vez que se abre
const azar = (semilla: number) => () => {
  semilla = (semilla * 16807) % 2147483647;
  return (semilla - 1) / 2147483646;
};

// Base del ramo, de donde salen todos los tallos (coordenadas del viewBox)
const BASE = { x: 200, y: 640 };

type Flor = { x: number; y: number; r: number; giro: number; pliegue: number; retraso: number };

const FLORES: Flor[] = [
  { x: 200, y: 250, r: 64, giro: 0, pliegue: 0, retraso: 0.9 },
  { x: 118, y: 318, r: 48, giro: 12, pliegue: -14, retraso: 1.2 },
  { x: 284, y: 305, r: 50, giro: -8, pliegue: 16, retraso: 1.05 },
  { x: 150, y: 168, r: 42, giro: 20, pliegue: -8, retraso: 1.5 },
  { x: 262, y: 160, r: 44, giro: -15, pliegue: 10, retraso: 1.35 },
  { x: 72, y: 222, r: 32, giro: 30, pliegue: -22, retraso: 1.8 },
  { x: 330, y: 214, r: 33, giro: -26, pliegue: 24, retraso: 1.7 },
  { x: 205, y: 395, r: 40, giro: 6, pliegue: 0, retraso: 1.6 },
];

// Pétalo alargado con la punta suavemente redondeada
const petalo = (l: number, a: number) =>
  `M0 0 C ${a} ${-l * 0.25} ${a * 0.95} ${-l * 0.8} ${a * 0.18} ${-l} Q 0 ${-l * 1.03} ${-a * 0.18} ${-l} C ${-a * 0.95} ${-l * 0.8} ${-a} ${-l * 0.25} 0 0Z`;

function Cabeza({ r, semilla }: { r: number; semilla: number }) {
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
      <circle r={r * 1.7} fill="url(#halo)" className="flores-halo" />
      <g filter="url(#brillo)">
        {[...capas.atras, ...capas.frente].map((p, i) => (
          <g key={i} transform={`rotate(${p.ang})`}>
            <path d={petalo(p.l, p.a)} fill={p.grad} />
            <path d={`M0 ${-p.l * 0.12} Q ${p.a * 0.08} ${-p.l * 0.55} 0 ${-p.l * 0.92}`} stroke="#b45309" strokeOpacity="0.22" strokeWidth="0.8" fill="none" />
          </g>
        ))}
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
  // Hoja a mitad del tallo, hacia afuera del ramo
  const lado = f.x < BASE.x ? -1 : 1;
  const hx = (BASE.x + 2 * cx + f.x) / 4;
  const hy = (BASE.y + 2 * cy + f.y) / 4;
  return (
    <g style={{ animationDelay: `${f.retraso - 0.8}s` }} className="flores-crece">
      <path d={d} pathLength={1} stroke="url(#tallo)" strokeWidth={3 + f.r / 22} fill="none" strokeLinecap="round" className="flores-tallo" />
      {i % 2 === 0 && (
        // El giro va en el <g>: la animación CSS reemplazaría el transform del path
        <g transform={`translate(${hx} ${hy}) rotate(${lado * 55}) scale(${lado} 1)`}>
          <path d="M0 0 C 14 -10 34 -12 52 -2 C 34 8 14 8 0 0Z" fill="url(#hoja)" className="flores-hoja" style={{ animationDelay: `${f.retraso}s` }} />
        </g>
      )}
    </g>
  );
}

const fechaBonita = () => {
  const d = new Date();
  return {
    dia: d.toLocaleDateString('es-CO', { weekday: 'long' }),
    numero: d.getDate(),
    mes: d.toLocaleDateString('es-CO', { month: 'long' }),
    anio: d.getFullYear(),
  };
};

export default function FloresAmarillas() {
  const navigate = useNavigate();
  const fecha = useMemo(() => fechaBonita(), []);
  // Polen flotando alrededor del ramo
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

  return (
    <div className="flores-pagina fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 flores-fondo" aria-hidden="true" />

      {polen.map((p, i) => (
        <span key={i} className="flores-polen" aria-hidden="true"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}

      <button onClick={() => navigate('/')} aria-label="Cerrar"
        className="absolute z-10 left-4 top-[max(env(safe-area-inset-top),16px)] w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white/80">
        <IconoCerrar />
      </button>

      <div className="relative h-full max-w-lg mx-auto flex flex-col">
        <header className="pt-[max(calc(env(safe-area-inset-top)+3.5rem),4.5rem)] px-6 text-center flores-texto">
          <h1 className="font-titulo text-[3.4rem] leading-tight">
            <span className="italic font-medium flores-titulo pr-1 pb-2">For you</span> 💚
          </h1>
          <div className="mt-5 inline-flex flex-col items-center">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.35em] text-amber-200/70">{fecha.dia}</span>
            <span className="flex items-center gap-3 mt-1.5">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/60" />
              <span className="font-titulo text-2xl text-amber-50">
                <span className="text-amber-300 font-semibold">{fecha.numero}</span> de {fecha.mes}
              </span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/60" />
            </span>
            <span className="text-xs tracking-[0.3em] text-white/40 mt-1.5">{fecha.anio}</span>
          </div>
        </header>

        <svg viewBox="0 0 400 660" className="flex-1 w-full min-h-0 -mt-4" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Un ramo de flores amarillas">
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

          {/* Lazo verde que une el ramo */}
          <g className="flores-lazo">
            <path d="M184 600 Q200 590 216 600 L214 618 Q200 612 186 618Z" fill="#15803d" />
            <path d="M200 604 C 180 590 166 596 172 610 C 178 620 194 612 200 604Z M200 604 C 220 590 234 596 228 610 C 222 620 206 612 200 604Z" fill="#22c55e" opacity="0.9" />
          </g>

          {/* Las más grandes se dibujan al final para quedar al frente */}
          {FLORES.map((f, i) => ({ f, i })).sort((a, b) => a.f.r - b.f.r).map(({ f, i }) => (
            <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.giro})`}>
              <g className="flores-mece" style={{ animationDelay: `${-i * 0.7}s` }}>
                <g className="flores-abre" style={{ animationDelay: `${f.retraso}s` }}>
                  <Cabeza r={f.r} semilla={i * 97 + 13} />
                </g>
              </g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
