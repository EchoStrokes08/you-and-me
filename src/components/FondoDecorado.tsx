import { useId } from 'react';
import { r1 } from './Trazos';

// Lo que vive en el fondo de la app además de las algas: el suelo, los corales, las rocas,
// los cardúmenes, la luz que baja de la superficie y el plancton. Todo tenue: es paisaje, no contenido.

type Props = { className?: string; espejo?: boolean };

/** La arena del fondo: una franja de dunas bajitas donde se apoya todo lo demás */
export function Arena({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 30" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 30 L0 14 C40 4 90 6 140 12 C200 20 250 6 310 8 C350 9 380 14 400 10 L400 30 Z" fill="currentColor" />
    </svg>
  );
}

/** Coral de ramas, como un arbolito */
export function CoralRamas({ className = '', espejo = false }: Props) {
  const ramas = [
    'M50 110 C50 92 48 80 50 64',
    'M50 82 C40 76 30 72 26 56',
    'M26 62 C20 56 14 50 14 40',
    'M27 58 C30 50 30 44 28 36',
    'M50 70 C58 62 68 60 72 46',
    'M72 52 C78 46 84 44 86 32',
    'M71 50 C68 42 66 36 68 28',
    'M50 64 C48 52 44 44 46 30',
    'M47 44 C52 38 56 32 56 22',
  ];
  return (
    <svg viewBox="0 0 100 110" className={className} aria-hidden="true">
      <g transform={espejo ? 'translate(100 0) scale(-1 1)' : undefined} stroke="currentColor" strokeLinecap="round" fill="none">
        {ramas.map((d, i) => <path key={i} d={d} strokeWidth={i === 0 ? 10 : i < 3 || i === 4 || i === 7 ? 8 : 6.5} />)}
      </g>
    </svg>
  );
}

/** Coral abanico: una hoja ancha con sus nervios, que se mece apenas */
export function CoralAbanico({ className = '', espejo = false }: Props) {
  const nervios = [
    'M50 108 C50 80 50 50 50 16',
    'M50 96 C40 76 28 60 20 40',
    'M50 96 C60 76 72 60 80 40',
    'M50 80 C42 60 38 44 36 22',
    'M50 80 C58 60 62 44 64 22',
  ];
  return (
    // Se mece el dibujo entero (una capa ya pintada), no un grupo de adentro
    <svg viewBox="0 0 100 110" className={`alga overflow-visible ${className}`} style={{ animationDuration: '11s', animationDelay: '-4s' }} aria-hidden="true">
      <g transform={espejo ? 'translate(100 0) scale(-1 1)' : undefined}>
        <path d="M50 110 C48 96 20 84 12 58 C6 36 22 12 50 10 C78 12 94 36 88 58 C80 84 52 96 50 110 Z" fill="currentColor" fillOpacity="0.45" />
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none">
          {nervios.map((d, i) => <path key={i} d={d} />)}
        </g>
      </g>
    </svg>
  );
}

// Estrella de mar de puntas redondeadas
const ESTRELLA = Array.from({ length: 10 }, (_, i) => {
  const a = (i * 36 - 90) * (Math.PI / 180);
  const r = i % 2 ? 4.6 : 11;
  return `${i ? 'L' : 'M'}${r1(r * Math.cos(a))} ${r1(r * Math.sin(a))}`;
}).join(' ') + ' Z';

/** Un par de rocas con una estrella de mar encima y una conchita al lado */
export function Rocas({ className = '', espejo = false }: Props) {
  return (
    <svg viewBox="0 0 150 64" className={className} aria-hidden="true">
      <g transform={espejo ? 'translate(150 0) scale(-1 1)' : undefined}>
        <path d="M58 64 C60 44 74 30 94 32 C108 26 124 34 128 48 C136 52 140 58 140 64 Z" className="text-oceano" fill="currentColor" fillOpacity="0.7" />
        <path d="M4 64 C4 42 18 26 40 28 C50 14 76 14 86 32 C98 36 106 48 106 64 Z" className="text-salvia" fill="currentColor" />
        <g transform="translate(52 34) rotate(14)" className="text-coral">
          <path d={ESTRELLA} fill="currentColor" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
        </g>
        <g transform="translate(118 50)" className="text-durazno">
          <path d="M0 14 C0 5 7 0 14 0 C21 0 28 5 28 14 L18 17 L10 17 Z" fill="currentColor" />
        </g>
      </g>
    </svg>
  );
}

// Cada pez del cardumen: [x, y, tamaño]
const PECES: [number, number, number][] = [
  [86, 14, 1], [64, 8, 0.8], [104, 30, 0.9], [72, 28, 1.1], [44, 22, 0.85],
  [90, 46, 0.8], [58, 44, 1], [28, 38, 0.75], [40, 58, 0.85], [14, 20, 0.7],
];

/** Un cardumen de pececitos que pasa junto. Van quietos entre sí: a lo lejos y tan tenues, el coleteo
 *  no se alcanzaba a ver y obligaba a repintar el cardumen en cada cuadro */
export function Cardumen({ className = '', espejo = false }: Props) {
  return (
    <svg viewBox="0 0 130 70" className={className} aria-hidden="true">
      <g transform={espejo ? 'translate(130 0) scale(-1 1)' : undefined} fill="currentColor">
        {PECES.map(([x, y, k], i) => (
          <path key={i} transform={`translate(${x} ${y}) scale(${k})`} d="M0 0 C4 -4.4 11 -4.4 16 0 C11 4.4 4 4.4 0 0 Z M1 0 L-5.5 -4 L-4 0 L-5.5 4 Z" />
        ))}
      </g>
    </svg>
  );
}

/** La luz de la superficie: haces anchos que bajan en diagonal y respiran despacio */
export function RayosDeLuz({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  // Cada haz, con el tramo que ocupa de los 390 de ancho: [desde, ancho, forma]
  const haces: [number, number, string][] = [
    [-60, 200, 'M70 0h70L40 500H-60z'], [30, 204, 'M190 0h44L110 500H30z'], [160, 164, 'M290 0h34L230 500h-70z'], [280, 102, 'M360 0h22L330 500h-50z'],
  ];
  // Un dibujo por haz: así cada uno es una capa ya pintada que solo se corre y se aclara,
  // en vez de repintar media pantalla de degradado en cada cuadro
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {haces.map(([x, ancho, d], i) => (
        <svg key={i} viewBox={`${x} 0 ${ancho} 500`} preserveAspectRatio="none" className="rayo absolute top-0 h-full overflow-visible"
          style={{ left: `${x / 3.9}%`, width: `${ancho / 3.9}%`, animationDelay: `${-i * 4.5}s`, animationDuration: `${15 + i * 3}s` }}>
          <defs>
            <linearGradient id={`luz-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={d} fill={`url(#luz-${id}-${i})`} />
        </svg>
      ))}
    </div>
  );
}

// Motas de plancton: [izquierda %, arriba %, tamaño px, segundos, adelanto]
const PLANCTON: [number, number, number, number, number][] = [
  [8, 22, 3, 11, -2], [22, 61, 4, 14, -9], [37, 34, 3, 12, -5], [52, 74, 3, 15, -12], [63, 18, 4, 13, -7],
  [78, 52, 3, 10, -1], [91, 31, 3, 16, -10], [86, 80, 4, 12, -4], [15, 84, 3, 13, -8], [46, 9, 3, 14, -6],
];

/** Plancton suspendido: motas que derivan y titilan */
export function Plancton() {
  return (
    <>
      {PLANCTON.map(([x, y, px, s, d], i) => (
        <span
          key={i}
          className="plancton absolute rounded-full bg-esmeralda"
          style={{ left: `${x}%`, top: `${y}%`, width: px, height: px, animationDuration: `${s}s`, animationDelay: `${d}s` }}
        />
      ))}
    </>
  );
}
