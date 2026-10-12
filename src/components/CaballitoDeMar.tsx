import { useId } from 'react';
import { aleta, r1, semilla, suave, type P } from './Trazos';

type Props = {
  className?: string;
  /** Color principal del cuerpo */
  color?: string;
  /** Color claro de la panza y de las aletas */
  panza?: string;
  /** Color oscuro de los anillos, los radios y la punta de la cola */
  detalles?: string;
  /** Muestra burbujitas que salen del hocico */
  burbujas?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

const azar = semilla(23);

// Eje del tronco, del cuello a donde empieza la cola: [x, y, medio ancho]
const TRONCO: [number, number, number][] = [
  [122, 36, 8], [116, 45, 10.5], [113, 56, 13.5], [115, 68, 16.5], [118.5, 80, 15],
  [119, 91, 11], [118, 101, 8.5], [115, 110, 6.5], [113, 118, 5.2],
];
// La cola se enrosca hacia adelante en espiral
const ESPIRAL = { cx: 127, cy: 118, r0: 14, r1: 2.6, giro: 480, w0: 5.2, w1: 1 };

type Tramo = { p: P; n: P; t: P; w: number; anillo: boolean };

// El cuerpo entero como una fila de tramos: cada dos, un anillo óseo (un poco más ancho)
const EJE: Tramo[] = (() => {
  const pts: { x: number; y: number; w: number }[] = [];
  const en = (i: number) => TRONCO[Math.min(TRONCO.length - 1, Math.max(0, i))];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < TRONCO.length - 1; i++) {
    const [a, b, c, d] = [en(i - 1), en(i), en(i + 1), en(i + 2)];
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      pts.push({ x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), w: cr(a[2], b[2], c[2], d[2], t) });
    }
  }
  for (let g = 0; g <= ESPIRAL.giro; g += 10) {
    const t = g / ESPIRAL.giro;
    const th = ((180 - g) * Math.PI) / 180;
    const r = ESPIRAL.r0 + (ESPIRAL.r1 - ESPIRAL.r0) * t;
    pts.push({ x: ESPIRAL.cx + r * Math.cos(th), y: ESPIRAL.cy + r * Math.sin(th), w: ESPIRAL.w0 + (ESPIRAL.w1 - ESPIRAL.w0) * t });
  }
  return pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t: P = [(b.x - a.x) / l, (b.y - a.y) / l];
    const anillo = i % 2 === 0;
    // La normal apunta al lomo: hacia atrás en el tronco, hacia afuera en la espiral
    return { p: [q.x, q.y] as P, n: [-t[1], t[0]] as P, t, w: q.w * (anillo ? 1.07 : 0.95) + (anillo ? 0.25 : 0), anillo };
  });
})();

/** Punto a `k` anchos del eje: 1 es el lomo, -1 la panza */
const lado = (e: Tramo, k: number): P => [e.p[0] + e.n[0] * e.w * k, e.p[1] + e.n[1] * e.w * k];
const N_TRONCO = (TRONCO.length - 1) * 4;
const PUNTA = (() => {
  const u = EJE[EJE.length - 1];
  return [u.p[0] + u.t[0] * 1.6, u.p[1] + u.t[1] * 1.6] as P;
})();

const CUERPO = suave([...EJE.map((e) => lado(e, 1)), PUNTA, ...EJE.map((e) => lado(e, -1)).reverse()]);
// Panza clara por el frente y sombra por el lomo (se recortan con la silueta)
const PANZA = suave([...EJE.map((e) => lado(e, -1.4)), ...EJE.map((e) => lado(e, -0.22)).reverse()]);
const SOMBRA_LOMO = suave([...EJE.map((e) => lado(e, 1.4)), ...EJE.map((e) => lado(e, 0.52)).reverse()]);
// Cresta lateral: la línea de bultitos que recorre el costado
const CRESTA = suave(EJE.slice(2, -6).map((e) => lado(e, 0.3)), false);
const BRILLO = suave(EJE.slice(5, 22).map((e) => lado(e, -0.62)), false);

// Anillos óseos: cruzan el cuerpo combándose hacia la cola
const ANILLOS = EJE.filter((e, i) => e.anillo && i > 1 && i < EJE.length - 4).map((e) => {
  const [a, b] = [lado(e, 1), lado(e, -1)];
  const comba = e.w * 0.28;
  return `M${r1(a[0])} ${r1(a[1])} Q${r1(e.p[0] + e.t[0] * comba)} ${r1(e.p[1] + e.t[1] * comba)} ${r1(b[0])} ${r1(b[1])}`;
});
// Bultitos donde cada anillo cruza la cresta y el lomo
const BULTOS = EJE.filter((e, i) => e.anillo && i > 1 && i < EJE.length - 12).flatMap((e) => {
  const r = Math.max(0.5, e.w * 0.09);
  return [{ p: lado(e, 0.3), r }, { p: lado(e, 0.94), r: r * 0.9 }];
});
// Pequitas claras del costado, solo en el tronco
const PECAS = (() => {
  const lista: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; lista.length < 26 && i < 400; i++) {
    const e = EJE[3 + Math.floor(azar() * (N_TRONCO - 4))];
    const [x, y] = lado(e, -0.1 + azar() * 0.95);
    if (lista.some((m) => Math.hypot(x - m.cx, y - m.cy) < 4.2)) continue;
    lista.push({ cx: r1(x), cy: r1(y), r: r1(0.6 + azar() * 0.9) });
  }
  return lista;
})();

// Aleta dorsal en abanico sobre el lomo y aleta pectoral junto a la agalla
const DORSAL = aleta([101.5, 64], [108.5, 92], [103, 78], 19, 15.5, 258, 102, 10, 0.07);
const PECTORAL = aleta([120, 41.5], [123.5, 51], [121.5, 46.5], 10, 7.5, 262, 96, 6);

// Cabeza con el hocico largo en tubo; la base queda dentro del cuello
const CABEZA =
  'M110.5 38.5 C110 27 116 17.5 126 15 C134.5 12.8 143 16.5 146.5 23.5 C151 26.3 158 28.4 164.5 30 C168 30.4 170 32.6 169.6 35.4 C169.2 38.4 166.4 39.8 163.4 38.8 C157 37.6 150.5 37.8 145.5 39.6 C141 42.4 136 44.6 131 45 C129 46.6 127 48.4 125.4 50.6 L114 50 Z';
// Corona de puntas y espinitas de la frente y la nuca (van detrás de la cabeza)
const CORONA = 'M119.5 21 L117.6 11.6 L122.6 15.4 L125 7.6 L129 13.4 L133.4 8.8 L134.6 16.4 Z';
const PUNTAS_CORONA: P[] = [[117.6, 11.6], [125, 7.6], [133.4, 8.8]];
const ESPINAS = ['M139.5 16.4 L143.4 11.8 L145.4 19.6 Z', 'M111.8 30 L106.6 27.6 L111.4 24.4 Z'];

export default function CaballitoDeMar({
  className = '',
  color = '#E88B4D',
  panza = '#FCE3C8',
  detalles = '#C46A2C',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';

  return (
    <svg viewBox="0 0 240 140" className={`${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      <defs>
        {/* En coordenadas del dibujo, para que cabeza y cuerpo compartan el mismo degradado */}
        <linearGradient id={`cuerpo-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="134">
          <stop offset="0" stopColor={color} />
          <stop offset="0.62" stopColor={color} />
          <stop offset="1" stopColor={detalles} />
        </linearGradient>
        <clipPath id={`silueta-${id}`}><path d={CUERPO} /></clipPath>
        <clipPath id={`cabeza-${id}`}><path d={CABEZA} /></clipPath>
      </defs>

      <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
        {/* Burbujitas que salen del hocico */}
        {burbujas && (
          <g className="ballena-soplo" stroke={panza} strokeWidth="1" fill="none">
            <circle cx="177" cy="25" r="2.2" />
            <circle cx="183" cy="17" r="1.6" />
            <circle cx="175" cy="11" r="1.3" />
            <circle cx="181" cy="5.5" r="0.9" fill={panza} stroke="none" />
          </g>
        )}

        {/* Aleta dorsal en abanico (detrás del cuerpo) */}
        <path d={DORSAL.forma} fill={panza} fillOpacity="0.9" />
        <g stroke={detalles} strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round">
          {DORSAL.radios.map((d, i) => <path key={i} d={d} />)}
        </g>
        <path d={DORSAL.borde} stroke={detalles} strokeWidth="1.4" strokeLinecap="round" fill="none" />

        {/* Corona y espinitas de la cabeza */}
        <path d={CORONA} fill={`url(#cuerpo-${id})`} stroke={detalles} strokeWidth="1.1" strokeLinejoin="round" />
        {PUNTAS_CORONA.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill={panza} />)}
        <g fill={`url(#cuerpo-${id})`} stroke={detalles} strokeWidth="0.9" strokeLinejoin="round">
          {ESPINAS.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* Tronco y cola enroscada */}
        <path d={CUERPO} fill={`url(#cuerpo-${id})`} />
        <g clipPath={`url(#silueta-${id})`}>
          <path d={PANZA} fill={panza} fillOpacity="0.85" />
          <path d={SOMBRA_LOMO} fill={sombra} fillOpacity="0.1" />

          {/* Pequitas */}
          <g fill="#fff" fillOpacity="0.26">
            {PECAS.map((m, i) => <circle key={i} cx={m.cx} cy={m.cy} r={m.r} />)}
          </g>

          {/* Anillos óseos y cresta lateral con sus bultitos */}
          <g stroke={detalles} strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" fill="none">
            {ANILLOS.map((d, i) => <path key={i} d={d} />)}
          </g>
          <path d={CRESTA} stroke={detalles} strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <g fill={detalles} fillOpacity="0.6">
            {BULTOS.map((b, i) => <circle key={i} cx={r1(b.p[0])} cy={r1(b.p[1])} r={r1(b.r)} />)}
          </g>

          {/* Brillo en el pecho */}
          <path d={BRILLO} stroke="#fff" strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </g>

        {/* Cabeza */}
        <path d={CABEZA} fill={`url(#cuerpo-${id})`} />
        <g clipPath={`url(#cabeza-${id})`}>
          {/* Parte de abajo del hocico y la garganta, más claras */}
          <path d="M172 34.6 C160 33 150 33.6 144 36.4 C139 39.6 133 41.6 127 42 L122 54 L176 54 Z" fill={panza} fillOpacity="0.7" />
          {/* Sombra de la nuca */}
          <path d="M108 40 C108 26 115 16 127 13.6 C120 20 116.6 29 117.4 40 Z" fill={sombra} fillOpacity="0.1" />
          {/* Brillo de la frente y del hocico */}
          <path d="M129 17.6 C134.6 16.4 140 18.6 143 22.6" stroke="#fff" strokeOpacity="0.3" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M150 28.8 C155 30.4 160 31.6 165 32.6" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Anillitos del hocico */}
          <g stroke={detalles} strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" fill="none">
            <path d="M152.6 27.6 C151.6 31 151.6 34.6 152.4 38" />
            <path d="M158.4 29 C157.6 32 157.6 35 158.2 38" />
          </g>
        </g>
        {/* Boquita en la punta del hocico y agalla */}
        <path d="M165.8 31.6 C164.6 33.6 164.6 35.8 165.6 37.8" stroke={sombra} strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <path d="M125.6 29 C123 33.6 123.4 39.4 126.6 43.4" stroke={sombra} strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        {/* Aleta pectoral del frente */}
        <path d={PECTORAL.forma} fill={panza} fillOpacity="0.92" />
        <g stroke={detalles} strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round">
          {PECTORAL.radios.map((d, i) => <path key={i} d={d} />)}
        </g>
        <path d={PECTORAL.borde} stroke={detalles} strokeWidth="1" strokeLinecap="round" fill="none" />

        {/* Cara */}
        <path d="M132.6 19.4 C135.4 17.6 139.4 17.8 142 20" stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
        <circle cx="137.4" cy="26.4" r="6" fill={panza} fillOpacity="0.6" />
        <circle cx="137.4" cy="26.4" r="4.6" fill={sombra} />
        <circle cx="139" cy="24.7" r="1.7" fill="#fff" />
        <circle cx="135.9" cy="28.1" r="0.7" fill="#fff" fillOpacity="0.7" />
        <ellipse cx="141.6" cy="35" rx="3.2" ry="1.9" fill="#F2B8A0" opacity="0.8" />
      </g>
    </svg>
  );
}
