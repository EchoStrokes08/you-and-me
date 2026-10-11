import { useId } from 'react';

type Props = {
  className?: string;
  /** Color principal del lomo */
  color?: string;
  /** Color de la panza */
  panza?: string;
  /** Color de los puntos y las rayas */
  motas?: string;
  /** Burbujas saliendo de las branquias (los tiburones no soplan) */
  burbujas?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

/** Pseudo-aleatorio estable: el patrón es siempre el mismo en cada render */
const azar = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/** Rayas verticales del cuerpo (las motas van entre ellas, como un tablero) */
const RAYAS = Array.from({ length: 12 }, (_, i) => 62 + i * 9);

const MOTAS_CUERPO = RAYAS.slice(0, -1).flatMap((x, c) =>
  Array.from({ length: 9 }, (_, f) => ({
    cx: x + 4.5 + (azar(c * 31 + f) - 0.5) * 1.6,
    cy: 40 + f * 6 + (c % 2 ? 3 : 0),
    r: 0.9 + azar(c * 17 + f * 7) * 0.6,
  })),
);

/** En la cabeza los puntos son más chiquitos y densos, sin rayas */
const MOTAS_CABEZA = Array.from({ length: 14 }, (_, c) =>
  Array.from({ length: 9 }, (_, f) => ({
    cx: 166 + c * 5 + (azar(c * 13 + f * 3) - 0.5) * 1.4,
    cy: 42 + f * 4.5 + (c % 2 ? 2.25 : 0),
    r: 0.6 + azar(c * 7 + f * 19) * 0.45,
  })),
).flat();

/** Rejilla de puntitos para las aletas (se recorta con clipPath) */
const rejilla = (x0: number, x1: number, y0: number, y1: number, paso: number, r: number) => {
  const puntos: { cx: number; cy: number; r: number }[] = [];
  for (let x = x0, c = 0; x <= x1; x += paso, c++) {
    for (let y = y0 + (c % 2 ? paso / 2 : 0); y <= y1; y += paso) {
      puntos.push({ cx: x, cy: y, r: r * (0.8 + azar(x * 3 + y) * 0.4) });
    }
  }
  return puntos;
};

const MOTAS_COLA = rejilla(8, 46, 14, 94, 6, 1);
const MOTAS_DORSAL = rejilla(106, 144, 18, 48, 5, 0.9);
const MOTAS_PECTORAL = rejilla(118, 170, 86, 124, 6, 1);

export default function TiburonBallena({
  className = '',
  color = '#3A4A5C',
  panza = '#EDE8DC',
  motas = '#C9D6E0',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E1A24';
  // Tiburón ballena: cabeza ancha y chata, boca en la punta, crestas en el lomo y patrón de tablero
  const cuerpo =
    'M40 64 C60 58 84 50 110 45 C140 40 170 40 196 44 C214 47 228 52 234 60 C237 64 237 70 234 73 C226 80 210 86 190 90 C160 96 124 96 96 90 C74 85 54 76 40 70 Z';
  const cola = 'M44 63 C38 50 28 32 20 16 C16 30 18 48 26 66 C20 74 16 82 12 90 C24 86 34 80 44 72 Z';
  const dorsal = 'M142 42 C134 32 124 24 116 20 C116 28 114 36 108 46 Z';
  const aletaFrente = 'M156 86 C148 98 134 112 120 122 C132 122 146 112 156 102 C162 96 166 90 168 86 Z';
  const branquias = [168, 173, 178, 183, 188];

  return (
    <svg viewBox="0 0 240 140" className={`${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.88" />
        </linearGradient>
        <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
        <clipPath id={`cola-${id}`}><path d={cola} /></clipPath>
        <clipPath id={`dorsal-${id}`}><path d={dorsal} /></clipPath>
        <clipPath id={`pectoral-${id}`}><path d={aletaFrente} /></clipPath>
      </defs>

      <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
        {burbujas && (
          <g className="ballena-soplo" fill="none" stroke={panza} strokeWidth="1.2">
            <circle cx="176" cy="34" r="2.4" />
            <circle cx="184" cy="24" r="1.8" />
            <circle cx="172" cy="18" r="1.5" />
            <circle cx="181" cy="9" r="2" />
            <circle cx="188" cy="36" r="1.3" />
          </g>
        )}

        {/* Cola de media luna, lóbulo de arriba más grande */}
        <path d={cola} fill={color} />
        <g clipPath={`url(#cola-${id})`} fill={motas} fillOpacity="0.55">
          {MOTAS_COLA.map((m, i) => <circle key={i} {...m} />)}
        </g>
        <path d="M44 63 C38 50 28 32 20 16 C26 32 34 48 40 64 Z" fill="#fff" fillOpacity="0.08" />

        {/* Segunda dorsal y aleta anal, chiquitas */}
        <path d="M74 54 C70 50 66 48 62 47 C62 51 62 54 60 58 Z" fill={color} />
        <path d="M80 82 C76 86 72 90 68 92 C74 92 78 88 82 84 Z" fill={color} />

        {/* Aletas pélvica y pectoral del otro lado (detrás del cuerpo) */}
        <path d="M104 88 C100 94 96 98 92 102 C98 102 104 98 108 90 Z" fill={panza} />
        <path d="M188 88 C186 98 182 104 176 108 C182 108 190 102 194 92 Z" fill={color} />
        <path d="M188 88 C186 98 182 104 176 108 C182 108 190 102 194 92 Z" fill={sombra} fillOpacity="0.3" />

        {/* Primera aleta dorsal */}
        <path d={dorsal} fill={color} />
        <g clipPath={`url(#dorsal-${id})`} fill={motas} fillOpacity="0.55">
          {MOTAS_DORSAL.map((m, i) => <circle key={i} {...m} />)}
        </g>
        <path d="M142 42 C134 32 124 24 116 20 C122 28 130 36 136 44 Z" fill="#fff" fillOpacity="0.08" />

        {/* Cuerpo */}
        <path d={cuerpo} fill={`url(#lomo-${id})`} />
        <g clipPath={`url(#cuerpo-${id})`}>
          {/* Rayas verticales claras */}
          <g stroke={motas} strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" fill="none">
            {RAYAS.map((x) => (
              <path key={x} d={`M${x} 36 C${x - 2} 56 ${x - 4} 76 ${x - 6} 100`} />
            ))}
          </g>

          {/* Crestas longitudinales del lomo (forman el tablero con las rayas) */}
          <g stroke={motas} strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" fill="none">
            <path d="M190 48 C150 43 110 47 50 63" />
            <path d="M184 58 C150 54 110 58 54 68" />
            <path d="M176 70 C146 68 112 72 60 74" />
          </g>

          {/* Motas entre las rayas y motas finitas en la cabeza */}
          <g fill={motas} fillOpacity="0.75">
            {MOTAS_CUERPO.map((m, i) => <circle key={`c${i}`} {...m} />)}
            {MOTAS_CABEZA.map((m, i) => <circle key={`h${i}`} {...m} />)}
          </g>

          {/* Panza clara */}
          <path
            d="M240 72 L234 71 C226 73 218 73 210 71 C200 76 186 80 170 82 C146 85 120 86 96 84 C78 80 60 74 40 70 L40 140 L240 140 Z"
            fill={panza}
          />
          {/* Sombrita en el borde de la panza */}
          <path d="M210 71 C200 76 186 80 170 82 C146 85 120 86 96 84 C120 89 150 89 172 86 C190 83 202 78 210 71 Z" fill={sombra} fillOpacity="0.07" />

          {/* Brillo en el lomo */}
          <path d="M120 44 C150 40 180 40 212 48" stroke="#fff" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>

        {/* Boca ancha justo en la punta del hocico */}
        <path d="M236 66 C230 67 220 68 210 70 C218 73.5 228 73.5 235.5 71 Z" fill={sombra} fillOpacity="0.85" />
        <path d="M236 66 C230 67 220 68 210 70" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.8" strokeLinecap="round" fill="none" />

        {/* Hendiduras branquiales */}
        <g stroke={sombra} strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" fill="none">
          {branquias.map((x, i) => (
            <path key={x} d={`M${x} ${54 + i} C${x - 2} 62 ${x - 2} 70 ${x} ${78 - i}`} />
          ))}
        </g>

        {/* Aleta pectoral grande del frente */}
        <path d={aletaFrente} fill={color} />
        <g clipPath={`url(#pectoral-${id})`} fill={motas} fillOpacity="0.6">
          {MOTAS_PECTORAL.map((m, i) => <circle key={i} {...m} />)}
        </g>
        <path d="M156 86 C148 98 134 112 120 122 C134 110 146 98 160 86 Z" fill="#fff" fillOpacity="0.1" />
        <path d="M168 86 C166 90 162 96 156 102 C146 112 132 122 120 122 C134 118 148 108 158 98 C162 94 165 90 166 86 Z" fill={sombra} fillOpacity="0.25" />

        {/* Cara: ojo chiquito detrás de la comisura */}
        <path d="M198 58.5 C201 56.5 206 56.5 209 59" stroke="#fff" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" fill="none" />
        <circle cx="204" cy="63" r="3.8" fill="#4A5868" />
        <circle cx="204" cy="63" r="2.9" fill={sombra} />
        <circle cx="205.2" cy="61.8" r="1.2" fill="#fff" />
        <circle cx="203" cy="64.3" r="0.55" fill="#fff" fillOpacity="0.7" />
        <ellipse cx="200" cy="70" rx="3.2" ry="1.9" fill="#F2B8A0" opacity="0.75" />
      </g>
    </svg>
  );
}