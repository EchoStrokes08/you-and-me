import { useId } from 'react';
import { r1, semilla, suave, type P } from './Trazos';
import Soplo from './Soplo';

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

const azar = semilla(7);

// Perfil del lomo y borde de la panza, para que el dibujo de la piel siga la forma del cuerpo
const LOMO: P[] = [[48, 61], [96, 47], [124, 40], [160, 37], [204, 43], [234, 57]];
const BORDE_PANZA: P[] = [[44, 67], [98, 83], [170, 83], [213, 70], [234, 65]];
const altura = (perfil: P[], x: number) => {
  const i = Math.max(1, perfil.findIndex(([px]) => px >= x));
  const [x0, y0] = perfil[i - 1];
  const [x1, y1] = perfil[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
};

/** Barras claras que bajan por el costado, curvadas como si envolvieran el cuerpo */
const BARRAS = Array.from({ length: 13 }, (_, i) => 58 + i * 9);
const TRAZO_BARRAS = BARRAS.map((x) => {
  const arriba = altura(LOMO, x);
  const abajo = altura(BORDE_PANZA, x);
  return `M${x + 1.5} ${r1(arriba - 1)} Q${x - 2.5} ${r1((arriba + abajo) / 2)} ${x + 1} ${r1(abajo + 1)}`;
});

/** Entre barra y barra, una hilera de motas: más grandes en el costado, chiquitas hacia el lomo y la cola */
const MOTAS_CUERPO = BARRAS.slice(0, -1).flatMap((x0, c) => {
  const x = x0 + 4.5;
  const arriba = altura(LOMO, x) + 2;
  const alto = altura(BORDE_PANZA, x) - arriba;
  const filas = Math.max(2, Math.round(alto / 6.2));
  return Array.from({ length: filas }, (_, f) => {
    const t = (f + (c % 2 ? 0.72 : 0.36)) / filas;
    return {
      cx: r1(x + (azar() - 0.5) * 1.8),
      cy: r1(arriba + t * alto),
      r: r1(0.65 + Math.sin(Math.PI * t) * (alto / 45) * 0.95 + azar() * 0.3),
    };
  });
});

/** En la cabeza, sin barras: puntitos finos y apretados que esquivan el ojo */
const MOTAS_CABEZA = (() => {
  const lista: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; lista.length < 120 && i < 1500; i++) {
    const x = 171 + azar() * 61;
    const arriba = altura(LOMO, x) + 2;
    const y = arriba + azar() * (altura(BORDE_PANZA, x) - arriba - 1);
    if (Math.hypot(x - 208, y - 61) < 6.2) continue;
    if (lista.some((m) => Math.hypot(x - m.cx, y - m.cy) < 3.3)) continue;
    lista.push({ cx: r1(x), cy: r1(y), r: r1(0.5 + azar() * 0.45) });
  }
  return lista;
})();

/** Crestas a lo largo del lomo: tres, y la de abajo sigue hasta la quilla de la cola */
const CRESTAS = [
  { t: 0.24, hasta: 200 },
  { t: 0.5, hasta: 190 },
  { t: 0.78, hasta: 172 },
].map(({ t, hasta }) => {
  const pts: P[] = [];
  for (let x = 50; x <= hasta; x += 14) {
    const arriba = altura(LOMO, x);
    pts.push([x, arriba + t * (altura(BORDE_PANZA, x) - arriba)]);
  }
  return suave(pts, false);
});

/** Puntitos para las aletas (se recortan con clipPath) */
const salpicado = (x0: number, x1: number, y0: number, y1: number, paso: number, r: number) => {
  const puntos: { cx: number; cy: number; r: number }[] = [];
  for (let x = x0, c = 0; x <= x1; x += paso, c++) {
    for (let y = y0 + (c % 2 ? paso / 2 : 0); y <= y1; y += paso) {
      puntos.push({ cx: r1(x + (azar() - 0.5) * 1.6), cy: r1(y + (azar() - 0.5) * 1.6), r: r1(r * (0.7 + azar() * 0.6)) });
    }
  }
  return puntos;
};

const MOTAS_COLA = salpicado(14, 54, 10, 104, 6.5, 0.95);
const MOTAS_DORSAL = salpicado(104, 140, 18, 46, 5.5, 0.85);
const MOTAS_PECTORAL = salpicado(126, 172, 86, 126, 6.5, 0.95);

export default function TiburonBallena({
  className = '',
  color = '#3F556C',
  panza = '#F1EDE2',
  motas = '#DCE8F0',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E1A24';
  // Tiburón ballena: cabeza ancha y chata con la boca en la punta, cuerpo que se afina hacia la cola
  const cuerpo =
    'M48 61 C70 54 96 44 124 40 C150 36 180 37 204 43 C218 46 229 50 233.5 56 C236.5 60 236.5 67 233 71 C224 80 208 87 188 91 C160 96 126 95 100 88 C80 82 62 73 48 68 Z';
  // Cola de media luna: el lóbulo de arriba, más largo
  const cola = 'M54 59 C46 48 32 28 16 10 C19 28 27 46 41 63 C32 76 24 90 20 104 C33 96 46 82 54 70 Z';
  const dorsal = 'M140 39 C132 30 122 22 112 18 C110 26 109 36 103 46 Z';
  const aletaFrente = 'M172 84 C166 98 150 114 128 124 C126 125 125 123 126.5 121 C136 112 144 100 148 86 Z';
  const branquias = [162, 167, 172, 177, 182];

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {burbujas && (
        <Soplo caja={[170, 5, 20, 28.5]} espejo={espejo} fill="none" stroke={panza} strokeWidth="1.2">
          <circle cx="176" cy="30" r="2.4" />
          <circle cx="184" cy="21" r="1.8" />
          <circle cx="172" cy="15" r="1.5" />
          <circle cx="181" cy="7" r="2" />
          <circle cx="188" cy="32" r="1.3" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
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
          {/* Cola */}
          <path d={cola} fill={color} />
          <g clipPath={`url(#cola-${id})`}>
            <g fill={motas} fillOpacity="0.6">
              {MOTAS_COLA.map((m, i) => <circle key={i} {...m} />)}
            </g>
            {/* El lóbulo de abajo queda en sombra */}
            <path d="M41 63 C32 76 24 90 20 104 L60 104 L60 63 Z" fill={sombra} fillOpacity="0.16" />
            <path d="M54 59 C46 48 32 28 16 10 C28 28 40 46 49 61 Z" fill="#fff" fillOpacity="0.1" />
          </g>

          {/* Segunda dorsal y aleta anal, chiquitas */}
          <path d="M86 50 C82 45 77 42.5 72 42 C72.5 46 72 50 69 55 Z" fill={color} />
          <path d="M86 81 C82 87 76 91 70 93 C72.5 89 73 85 72 79 Z" fill={color} />
          <path d="M86 81 C82 87 76 91 70 93 C72.5 89 73 85 72 79 Z" fill={sombra} fillOpacity="0.2" />

          {/* Aletas pélvica y pectoral del otro lado (detrás del cuerpo) */}
          <path d="M114 89 C110 96 104 101 97 103 C100 98 101 94 101 88 Z" fill={color} />
          <path d="M114 89 C110 96 104 101 97 103 C100 98 101 94 101 88 Z" fill={sombra} fillOpacity="0.2" />
          <path d="M192 87 C191 98 185 106 175 111 C179 104 180 96 180 88 Z" fill={color} />
          <path d="M192 87 C191 98 185 106 175 111 C179 104 180 96 180 88 Z" fill={sombra} fillOpacity="0.3" />

          {/* Primera aleta dorsal: atrás de la mitad del cuerpo y de punta redondeada */}
          <path d={dorsal} fill={color} />
          <g clipPath={`url(#dorsal-${id})`}>
            <g fill={motas} fillOpacity="0.6">
              {MOTAS_DORSAL.map((m, i) => <circle key={i} {...m} />)}
            </g>
            <path d="M112 18 C110 26 109 36 103 46 L110 46 C114 38 115 28 112 18 Z" fill={sombra} fillOpacity="0.16" />
          </g>

          {/* Cuerpo */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Barras claras */}
            <g stroke={motas} strokeOpacity="0.34" strokeWidth="0.8" strokeLinecap="round" fill="none">
              {TRAZO_BARRAS.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* Crestas del lomo: una línea de luz y su sombra debajo */}
            {CRESTAS.map((d, i) => (
              <g key={i} strokeLinecap="round" fill="none">
                <path d={d} stroke={sombra} strokeOpacity="0.16" strokeWidth="1.4" transform="translate(0 1)" />
                <path d={d} stroke={motas} strokeOpacity="0.3" strokeWidth="0.9" />
              </g>
            ))}

            {/* Motas del costado y puntitos de la cabeza */}
            <g fill={motas} fillOpacity="0.88">
              {MOTAS_CUERPO.map((m, i) => <circle key={`c${i}`} {...m} />)}
              {MOTAS_CABEZA.map((m, i) => <circle key={`h${i}`} {...m} />)}
            </g>

            {/* El costado se oscurece hacia la panza */}
            <path d="M213 70 C200 77 186 81 170 83 C146 86 120 86 98 83 C80 79 62 73 44 67 L44 60 C64 66 82 72 100 75 C124 78 148 78 172 75 C188 73 202 70 213 66 Z" fill={sombra} fillOpacity="0.12" />

            {/* Panza clara: arranca en la comisura y sigue hasta la cola */}
            <path
              d="M240 66 L234 65 C227 67 220 68.5 213 70 C200 77 186 81 170 83 C146 86 120 86 98 83 C80 79 62 73 44 67 L40 140 L240 140 Z"
              fill={panza}
            />
            {/* Sombra de la panza, abajo */}
            <path d="M232 72 C222 81 206 88 188 91 C160 96 126 95 100 88 C80 82 62 73 48 68 C66 73 84 80 102 84 C128 89 160 89 188 85 C206 82 222 77 232 72 Z" fill={sombra} fillOpacity="0.07" />

            {/* Brillo en el lomo */}
            <path d="M122 43 C150 38.5 180 39.5 206 46" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </g>

          {/* Boca ancha en la punta del hocico, con la comisura hacia arriba */}
          <path d="M235 63.6 C228 66.2 220 68.2 213.6 69.4 C212.6 69.6 211.8 68.9 211.6 67.9" stroke={sombra} strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M234.6 65.4 C228 67.8 221 69.4 215 70.6" stroke={sombra} strokeOpacity="0.1" strokeWidth="1" strokeLinecap="round" fill="none" />

          {/* Hendiduras branquiales, largas y un poco echadas hacia atrás */}
          <g stroke={sombra} strokeOpacity="0.38" strokeWidth="1.1" strokeLinecap="round" fill="none">
            {branquias.map((x, i) => (
              <path key={x} d={`M${x + 1.5} ${50 + i * 1.2} C${x - 1.5} ${59 + i * 0.6} ${x - 2} 69 ${x - 0.5} ${80 - i * 0.8}`} />
            ))}
          </g>

          {/* Aleta pectoral grande del frente */}
          <path d={aletaFrente} fill={color} />
          <g clipPath={`url(#pectoral-${id})`}>
            <g fill={motas} fillOpacity="0.65">
              {MOTAS_PECTORAL.map((m, i) => <circle key={i} {...m} />)}
            </g>
            <path d="M148 86 C144 100 136 112 126.5 121 L128 124 C140 114 150 102 156 86 Z" fill={sombra} fillOpacity="0.2" />
            <path d="M172 84 C166 98 150 114 128 124 C148 112 160 98 167 84 Z" fill="#fff" fillOpacity="0.1" />
          </g>
          <path d="M148 86 C155 83 164 82.5 172 84" stroke={sombra} strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" fill="none" />

          {/* Cara: el ojo chiquito, justo detrás de la comisura */}
          <path d="M203 55.6 C205.6 53.6 210.4 53.6 213 56" stroke="#fff" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="208" cy="61" r="4.2" fill={color} />
          <circle cx="208" cy="61" r="3.5" fill={sombra} />
          <circle cx="209.3" cy="59.7" r="1.3" fill="#fff" />
          <circle cx="206.9" cy="62.4" r="0.6" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="203" cy="69.6" rx="3.4" ry="2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}
