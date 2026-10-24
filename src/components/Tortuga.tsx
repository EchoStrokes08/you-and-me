import { useId } from 'react';
import { bezier, r1, semilla, type P } from './Trazos';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal del caparazón */
  color?: string;
  /** Color claro del plastrón (la panza) y de la garganta */
  panza?: string;
  /** Color de la piel: cabeza y aletas */
  piel?: string;
  /** Color de las escamas oscuras de la piel */
  escamas?: string;
  /** Color de las uniones entre los escudos del caparazón */
  vetas?: string;
  /** Muestra burbujitas que salen de la nariz */
  burbujas?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

const azar = semilla(31);

// El caparazón de costado: la línea que separa los escudos del lomo de los del costado,
// y el borde de abajo, donde va la banda de escudos marginales
const LINEA_LOMO: [P, P, P, P] = [[80, 56], [100, 44], [146, 42], [174, 54]];
const BORDE: [P, P, P, P] = [[66, 73], [92, 86], [150, 86], [183, 62]];
const ALTO_BANDA = 6.5;
const enLomo = (t: number) => bezier(...LINEA_LOMO, t);
const enBorde = (t: number): P => {
  const [x, y] = bezier(...BORDE, t);
  return [x, y - ALTO_BANDA];
};
const linea = (a: P, b: P) => `M${r1(a[0])} ${r1(a[1])} L${r1(b[0])} ${r1(b[1])}`;

// Uniones entre los escudos del costado (bajan del lomo a la banda) y entre los del lomo (suben al filo)
const UNIONES_COSTADO = [0.2, 0.4, 0.6, 0.8].map((t) => linea(enLomo(t), enBorde(t + (t - 0.5) * 0.08)));
const UNIONES_LOMO = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => {
  const [x, y] = enLomo(t);
  return linea([x, y], [x + (x - 126) * 0.16, y - 16]);
});
const UNIONES_BANDA = Array.from({ length: 11 }, (_, i) => {
  const t = 0.06 + i * 0.088;
  const [x, y] = bezier(...BORDE, t);
  return linea([x, y + 1], [x + (t - 0.5) * 2.4, y - ALTO_BANDA]);
});

// Cada escudo del costado lleva una mancha más oscura al centro, como el carey
const MANCHAS = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => {
  const a = enLomo(t);
  const b = enBorde(t);
  const alto = b[1] - a[1];
  return { cx: r1((a[0] + b[0]) / 2), cy: r1((a[1] + b[1]) / 2), rx: r1(5.6 - Math.abs(t - 0.5) * 3), ry: r1(alto * 0.26) };
});

/** Escamas de las aletas: manchitas repartidas sin tocarse (se recortan con clipPath) */
const escamado = (x0: number, x1: number, y0: number, y1: number, cuantas: number, r: number) => {
  const lista: { cx: number; cy: number; rx: number; ry: number }[] = [];
  for (let i = 0; lista.length < cuantas && i < 900; i++) {
    const x = x0 + azar() * (x1 - x0);
    const y = y0 + azar() * (y1 - y0);
    if (lista.some((e) => Math.hypot(x - e.cx, y - e.cy) < r * 2.5)) continue;
    const k = r * (0.75 + azar() * 0.5);
    lista.push({ cx: r1(x), cy: r1(y), rx: r1(k), ry: r1(k * 0.8) });
  }
  return lista;
};
const ESCAMAS_ALETA = escamado(114, 168, 80, 128, 44, 2.1);
const ESCAMAS_ATRAS = escamado(52, 88, 76, 104, 18, 1.9);

export default function Tortuga({
  className = '',
  color = '#B5793F',
  panza = '#F4E6BE',
  piel = '#8FC98A',
  escamas = '#3F7F5A',
  vetas = '#F0D3A0',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';
  // Tortuga marina de costado: caparazón en cúpula, plastrón claro, cabeza redonda con pico y aletas largas
  const cuerpo =
    'M68 74 C72 55 94 38 124 35 C152 33 176 46 181 62 C183 70 180 78 172 84 C156 95 126 98 100 92 C84 88 72 82 68 74 Z';
  const cabeza =
    'M170 60 C178 50 192 44 205 45 C216 46 224 52 225 59 C225.5 62 224 64.5 221 66 C222 69 220 72 215 73 C202 76 184 75 170 72 Z';
  const aletaFrente = 'M166 80 C164 98 148 116 120 127 C116 128.5 114.5 125.5 117.5 122.5 C130 111 139 98 143 82 Z';
  const aletaAtras = 'M86 82 C80 92 68 100 54 102 C51 98 56 90 66 82 C70 78 76 76 82 76 Z';
  const aletaFrenteLejos = 'M180 74 C188 86 190 100 186 114 C178 106 172 94 168 80 Z';
  const aletaAtrasLejos = 'M100 90 C98 100 92 108 82 112 C82 104 84 96 88 88 Z';

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {/* Burbujitas que salen de la nariz */}
      {burbujas && (
        <Soplo caja={[211.5, 11, 12.3, 26.2]} espejo={espejo} stroke={panza} strokeWidth="1" fill="none">
          <circle cx="216" cy="35" r="2.2" />
          <circle cx="222" cy="26" r="1.6" />
          <circle cx="213" cy="19" r="1.3" />
          <circle cx="220" cy="12" r="0.9" fill={panza} stroke="none" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
        <defs>
          <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.88" />
          </linearGradient>
          <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
          <clipPath id={`cabeza-${id}`}><path d={cabeza} /></clipPath>
          <clipPath id={`aleta-${id}`}><path d={aletaFrente} /></clipPath>
          <clipPath id={`atras-${id}`}><path d={aletaAtras} /></clipPath>
        </defs>

        <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
          {/* Aletas del otro lado (detrás del cuerpo) */}
          {[aletaFrenteLejos, aletaAtrasLejos].map((d, i) => (
            <g key={i}>
              <path d={d} fill={piel} />
              <path d={d} fill={sombra} fillOpacity="0.3" />
            </g>
          ))}

          {/* Colita */}
          <g className={nadando ? 'cola-nado' : ''} style={{ transformOrigin: '74px 74px', ['--coleteo' as string]: '8deg' }}>
            <path d="M72 70 C66 71 60 74 56 78 C62 79 68 78 74 77 Z" fill={piel} />
          </g>

          {/* Aleta de atrás, corta y en pala */}
          <g className={nadando ? 'aleta-nado' : ''} style={{ transformOrigin: '82px 82px', ['--aleteo' as string]: '10deg', animationDuration: '2.2s', animationDelay: '-0.6s' }}>
            <path d={aletaAtras} fill={piel} />
            <g clipPath={`url(#atras-${id})`}>
              <g fill={escamas} fillOpacity="0.5">
                {ESCAMAS_ATRAS.map((e, i) => <ellipse key={i} {...e} />)}
              </g>
              <path d="M54 102 C51 98 56 90 66 82 C60 90 58 96 60 102 Z" fill={sombra} fillOpacity="0.16" />
            </g>
          </g>

          {/* Cabeza y cuello */}
          <path d={cabeza} fill={piel} />
          <g clipPath={`url(#cabeza-${id})`}>
            {/* Garganta clara */}
            <path d="M166 67 C184 73 204 73 224 65 L224 80 L166 80 Z" fill={panza} fillOpacity="0.75" />
            {/* Escamas de la coronilla */}
            <g fill={escamas} fillOpacity="0.5">
              <ellipse cx="187" cy="52.5" rx="4.2" ry="2.8" />
              <ellipse cx="196.5" cy="48.6" rx="4.4" ry="2.6" />
              <ellipse cx="206.5" cy="47.6" rx="4" ry="2.2" />
              <ellipse cx="215.5" cy="50.4" rx="3.2" ry="2" />
              <ellipse cx="179" cy="58" rx="3.4" ry="2.6" />
              <ellipse cx="191" cy="59" rx="3.6" ry="2.6" />
              <ellipse cx="199" cy="54.6" rx="2.6" ry="1.9" />
              <ellipse cx="183" cy="64.5" rx="2.8" ry="2" />
            </g>
            {/* Sombra que deja el caparazón sobre el cuello */}
            <path d="M166 56 L178 54 C182 60 182 68 178 76 L166 76 Z" fill={sombra} fillOpacity="0.16" />
          </g>

          {/* Caparazón y plastrón */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Plastrón claro */}
            <path d="M66 73 C92 86 150 86 183 62 L190 110 L60 110 Z" fill={panza} />
            <path d="M70 76 C84 86 104 92 126 93 C148 94 166 88 178 78 C168 92 146 98 124 97 C102 96 82 88 70 76 Z" fill={sombra} fillOpacity="0.1" />

            {/* Manchas de los escudos */}
            <g fill={sombra} fillOpacity="0.14">
              {MANCHAS.map((m, i) => <ellipse key={i} {...m} />)}
            </g>

            {/* Banda de escudos marginales */}
            <path d="M66 73 C92 86 150 86 183 62 L183 55.5 C150 79.5 92 79.5 66 66.5 Z" fill={sombra} fillOpacity="0.2" />

            {/* Uniones entre los escudos */}
            <g stroke={vetas} strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" fill="none">
              <path d="M80 56 C100 44 146 42 174 54" />
              <path d="M66 66.5 C92 79.5 150 79.5 183 55.5" />
              {UNIONES_COSTADO.map((d, i) => <path key={`c${i}`} d={d} />)}
              {UNIONES_LOMO.map((d, i) => <path key={`l${i}`} d={d} />)}
            </g>
            <g stroke={vetas} strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round">
              {UNIONES_BANDA.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* Brillo en la cúpula */}
            <path d="M96 44.5 C112 38.5 138 37.5 156 43.5" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
          {/* Filo del caparazón sobre el plastrón */}
          <path d="M67 73.6 C92 86 150 86 182.4 62.6" stroke={sombra} strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" fill="none" />

          {/* Aleta larga del frente */}
          <g className={nadando ? 'aleta-remar' : ''} style={{ transformOrigin: '155px 81px', ['--aleteo' as string]: '-18deg' }}>
            <path d={aletaFrente} fill={piel} />
            <g clipPath={`url(#aleta-${id})`}>
              <g fill={escamas} fillOpacity="0.5">
                {ESCAMAS_ALETA.map((e, i) => <ellipse key={i} {...e} />)}
              </g>
              <path d="M143 82 C139 98 130 111 117.5 122.5 L120 127 C134 116 146 102 152 82 Z" fill={sombra} fillOpacity="0.16" />
              <path d="M166 80 C164 98 148 116 120 127 C144 112 156 98 161 80 Z" fill="#fff" fillOpacity="0.18" />
            </g>
          </g>

          {/* Cara */}
          <path d="M224.4 62.4 C221 65.6 216 67 211 66.4" stroke={sombra} strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <circle cx="219.6" cy="55.6" r="0.6" fill={sombra} fillOpacity="0.45" />
          <path d="M203 49.6 C206 47.6 211 47.6 214 50" stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="208.5" cy="57" r="4.8" fill={sombra} />
          <circle cx="210.2" cy="55.3" r="1.7" fill="#fff" />
          <circle cx="207" cy="58.8" r="0.75" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="203.5" cy="66.6" rx="3.6" ry="2.2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}
