// Las medusas, mascota secundaria: campana que pulsa, tentáculos y brazos con volantes, más una carita opcional; todo generado con cálculo.
// Ojo: repite copias propias de las ayudas de Trazos.ts (semilla y suave); lo que se arregle allá acá sigue igual.
import { useId } from 'react';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal de la umbrela (la campana) */
  color?: string;
  /** Color claro del borde inferior de la umbrela y de los tentáculos */
  panza?: string;
  /** Color de las manchitas de la umbrela */
  motas?: string;
  /** Color de los brazos orales con volantes */
  brazos?: string;
  /** Muestra burbujitas que escapan del borde con cada pulso */
  burbujas?: boolean;
  /** Muestra la carita (las medusas reales no tienen ojos) */
  cara?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

type P = [number, number];

/** Pseudo-aleatorio estable (Park-Miller): siempre da la misma secuencia */
function semilla(s: number) {
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const azar = semilla(42);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos */
function suave(p: P[], cerrado = true): string {
  const n = p.length;
  const en = (i: number) => (cerrado ? p[(i + n) % n] : p[Math.min(n - 1, Math.max(0, i))]);
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  for (let i = 0; i < (cerrado ? n : n - 1); i++) {
    const [a, b, c, e] = [en(i - 1), en(i), en(i + 1), en(i + 2)];
    d += ` C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${r1(c[0])} ${r1(c[1])}`;
  }
  return cerrado ? `${d} Z` : d;
}

// Sistema local: la umbrela se dibuja derecha, con el borde en y=0 y la cúpula hacia y=-40.
// Después todo se inclina para que nade en diagonal hacia la derecha, con la campana adelante.
const INCLINACION = 70;
const UBICACION = 'translate(162 53)';

// La carita va casi derecha (giro neto de 15°) aunque la umbrela esté inclinada
const CARA = { x: 2, y: -19, giro: -55 };
const SEP_OJOS = 8;
function aLocal(fx: number, fy: number): P {
  const a = (CARA.giro * Math.PI) / 180;
  return [CARA.x + fx * Math.cos(a) - fy * Math.sin(a), CARA.y + fx * Math.sin(a) + fy * Math.cos(a)];
}

/** Brazo oral: cinta que se afina hacia abajo con bordes de volantes alternados */
function brazoOral(x0: number, y0: number, largo: number, ancho: number, curva: number) {
  const N = 16;
  const izq: P[] = [];
  const der: P[] = [];
  const centro: P[] = [];
  const fase = azar() * Math.PI * 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = x0 + curva * Math.sin(t * Math.PI * 0.9) + 1.2 * Math.sin(fase + t * 9);
    const cy = y0 + largo * t;
    const w = (ancho / 2) * (1 - 0.6 * t) * (t < 0.15 ? 0.6 + (0.4 * t) / 0.15 : 1);
    const vuelo = i % 2 === 0 ? 1.25 : 0.8;
    izq.push([cx - w * (vuelo + azar() * 0.15), cy]);
    der.push([cx + w * (2.05 - vuelo + azar() * 0.15), cy]);
    centro.push([cx + w * 0.2, cy]);
  }
  const ultimo = centro[N];
  const punta: P = [ultimo[0] + curva * 0.1, ultimo[1] + 3];
  return {
    forma: suave([...izq, punta, ...[...der].reverse()]),
    sombra: suave([...centro, punta, ...[...der].reverse()]),
    pliegue: suave(centro.slice(1, -2), false),
  };
}

// Cuatro brazos orales: tres detrás de la umbrela y uno al frente
const BRAZOS_ATRAS = [
  brazoOral(-12, -6, 58, 9, -5),
  brazoOral(12, -6, 55, 9, 5),
  brazoOral(3, -6, 62, 10, -7),
];
const BRAZO_FRENTE = brazoOral(-1, 2, 66, 12, 7);

// Ocho tentáculos marginales, cada uno con su propio largo y ondulación
const TENTACULOS = [-31, -22, -13, -5, 5, 13, 22, 31].map((x0) => {
  const largo = 92 + azar() * 22;
  const amp = 2.5 + azar() * 3;
  const fase = azar() * Math.PI * 2;
  const ondas = 1.3 + azar() * 0.8;
  const pts: P[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    pts.push([x0 * (1 + 0.12 * t) + amp * t * Math.sin(fase + t * ondas * Math.PI * 2), -1 + largo * t]);
  }
  return { d: suave(pts, false), grosor: r1(0.9 + azar() * 0.5) };
});

// Manchitas de la umbrela: se achatan cerca de los bordes de la cúpula y esquivan la cara
const MOTAS = (() => {
  const evitar: { p: P; r: number }[] = [
    { p: aLocal(-SEP_OJOS, 0), r: 6 },
    { p: aLocal(SEP_OJOS, 0), r: 6 },
    { p: aLocal(-SEP_OJOS - 5, 4.8), r: 4 },
    { p: aLocal(SEP_OJOS + 5, 4.8), r: 4 },
  ];
  const lista: { cx: number; cy: number; r: number; rx: number; ry: number }[] = [];
  for (let intento = 0; lista.length < 30 && intento < 600; intento++) {
    const x = -32 + azar() * 64;
    const y = -39 + azar() * 37;
    if ((x / 33) ** 2 + (y / 40) ** 2 > 0.9) continue;
    if (evitar.some(({ p, r }) => Math.hypot(x - p[0], y - p[1]) < r)) continue;
    const r = 1.1 + azar() ** 1.5 * 2;
    if (lista.some((m) => Math.hypot(x - m.cx, y - m.cy) < r + m.r + 1.6)) continue;
    const kx = Math.sqrt(1 - Math.min(0.8, (x / 34) ** 2));
    const ky = Math.sqrt(1 - Math.min(0.75, (y / 41) ** 2));
    lista.push({ cx: r1(x), cy: r1(y), r, rx: r1(r * kx), ry: r1(r * 0.85 * ky) });
  }
  return lista;
})();

// Canales radiales que bajan desde la cima hasta el borde
const CANALES = [-3, -2, -1, 1, 2, 3].map((k) => `M${k * 2.5} -37 C${k * 6.5} -31 ${k * 9.5} -15 ${k * 10} 1`);

export default function Medusa({
  className = '',
  color = '#8DBBDD',
  panza = '#DDEEF7',
  motas = '#5B8FC0',
  brazos = '#F1DEC2',
  burbujas = true,
  cara = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';
  // Umbrela: cúpula con el borde festoneado en lóbulos marginales
  const cuerpo =
    'M-34 0 C-36 -14 -28 -32 -12 -38 C-4 -41 4 -41 12 -38 C28 -32 36 -14 34 0 C30 3 26 3 22 1 C18 4 13 4 9 2 C5 5 -5 5 -9 2 C-13 4 -18 4 -22 1 C-26 3 -30 3 -34 0 Z';
  const borde = 'M34 0 C30 3 26 3 22 1 C18 4 13 4 9 2 C5 5 -5 5 -9 2 C-13 4 -18 4 -22 1 C-26 3 -30 3 -34 0';

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {/* Burbujitas que escapan del borde de la umbrela con cada pulso */}
      {burbujas && (
        <Soplo caja={[139.5, 1.5, 15.3, 13.7]} espejo={espejo} stroke={panza} strokeWidth="1" fill="none">
          <circle cx="146" cy="13" r="2.2" />
          <circle cx="153" cy="7" r="1.6" />
          <circle cx="141" cy="5" r="1.3" />
          <circle cx="149" cy="2.6" r="0.9" fill={panza} stroke="none" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
        <defs>
          <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.85" />
          </linearGradient>
          <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
        </defs>

        <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
          <g transform={`${UBICACION} rotate(${INCLINACION})`}>
            {/* Tentáculos marginales (en el lugar de la cola: detrás de todo) */}
            <g className={nadando ? 'aleta-nado' : ''} style={{ transformOrigin: '0px 0px', ['--aleteo' as string]: '4deg', animationDuration: '3.4s' }} stroke={panza} strokeOpacity="0.9" strokeLinecap="round" fill="none">
              {TENTACULOS.map((t, i) => (
                <path key={i} d={t.d} strokeWidth={t.grosor} />
              ))}
            </g>

            {/* Brazos orales de atrás, un poco más oscuros para que se sientan lejos */}
            {BRAZOS_ATRAS.map((b, i) => (
              <g key={i}>
                <path d={b.forma} fill={brazos} />
                <path d={b.forma} fill={sombra} fillOpacity="0.14" />
                <path d={b.pliegue} stroke={sombra} strokeOpacity="0.15" strokeWidth="0.9" strokeLinecap="round" fill="none" />
              </g>
            ))}

            {/* Umbrela */}
            <path d={cuerpo} fill={`url(#lomo-${id})`} />
            <g clipPath={`url(#cuerpo-${id})`}>
              {/* Borde inferior claro, donde la campana se curva hacia adentro */}
              <path d="M-40 -5 C-22 -10 22 -10 40 -5 L40 10 L-40 10 Z" fill={panza} fillOpacity="0.8" />
              <path d="M-40 -5 C-22 -10 22 -10 40 -5 C22 -7 -22 -7 -40 -5 Z" fill={sombra} fillOpacity="0.08" />

              {/* Canales radiales */}
              <g stroke={sombra} strokeOpacity="0.07" strokeWidth="1" strokeLinecap="round" fill="none">
                {CANALES.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* Sombra suave del lado de abajo */}
              <path d="M14 -37 C30 -31 37 -14 34 0 L22 1 C27 -10 26 -26 14 -37 Z" fill={sombra} fillOpacity="0.1" />

              {/* Manchitas */}
              <g fill={motas} fillOpacity="0.55">
                {MOTAS.map((m, i) => (
                  <ellipse key={i} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} />
                ))}
              </g>

              {/* Brillo en la cúpula */}
              <path d="M-27 -13 C-25 -24 -17 -32 -5 -36" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>

            {/* Línea del borde festoneado (en el lugar de la mandíbula) */}
            <path d={borde} stroke={sombra} strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Brazo oral del frente, con sombra de un lado para dar volumen */}
            <g className={nadando ? 'aleta-nado' : ''} style={{ transformOrigin: '0px 2px', ['--aleteo' as string]: '-5deg', animationDuration: '3s', animationDelay: '-1s' }}>
              <path d={BRAZO_FRENTE.forma} fill={brazos} />
              <path d={BRAZO_FRENTE.sombra} fill={sombra} fillOpacity="0.12" />
              <path d={BRAZO_FRENTE.pliegue} stroke={sombra} strokeOpacity="0.2" strokeWidth="0.9" strokeLinecap="round" fill="none" />
            </g>

            {/* Cara */}
            {cara && (
              <g transform={`translate(${CARA.x} ${CARA.y}) rotate(${CARA.giro})`}>
                {[-1, 1].map((l) => {
                  const x = l * SEP_OJOS;
                  return (
                    <g key={l}>
                      <path d={`M${x - 3} -6.5 C${x - 1.5} -8 ${x + 1.5} -8 ${x + 3} -6.5`} stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
                      <circle cx={x} cy="0" r="3.6" fill={sombra} />
                      <circle cx={x + 1.2} cy="-1.3" r="1.3" fill="#fff" />
                      <circle cx={x - 1.1} cy="1.3" r="0.6" fill="#fff" fillOpacity="0.7" />
                      <ellipse cx={l * (SEP_OJOS + 5)} cy="4.8" rx="3" ry="1.8" fill="#F2B8A0" opacity="0.8" />
                    </g>
                  );
                })}
                <path d="M-2 3 C-1 4.4 1 4.4 2 3" stroke={sombra} strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" fill="none" />
              </g>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}