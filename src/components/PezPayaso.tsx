import { useId } from 'react';
import { aleta, r1, semilla } from './Trazos';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal (naranja) */
  color?: string;
  /** Naranja más claro de la panza */
  panza?: string;
  /** Color de las franjas blancas */
  franjas?: string;
  /** Color del filete oscuro que bordea franjas y aletas */
  bordes?: string;
  /** Muestra burbujitas que salen de las branquias */
  burbujas?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

const azar = semilla(11);

// Aletas en abanico (base pegada al cuerpo, borde redondeado)
const COLA = aleta([72, 61], [72, 81], [74, 71], 60, 38, 220, 140, 10);
const DORSAL_ESPINOSA = aleta([174, 38], [120, 40], [146, 40], 26, 17, 340, 200, 8, 0.12);
const DORSAL_BLANDA = aleta([122, 37], [80, 56], [100, 50], 26, 28, 290, 195, 8);
const ANAL = aleta([120, 102], [84, 90], [100, 92], 22, 24, 60, 160, 7);
const PELVICA = aleta([172, 102], [158, 105], [162, 104], 12, 20, 70, 125, 5);
const PECTORAL = aleta([170, 70], [170, 86], [168, 78], 26, 16, 215, 145, 7);

// Franjas: detrás del ojo, la del medio con su joroba hacia adelante y la del pedúnculo
const FRANJAS = [
  'M171 26 C177 50 178 88 172 114 L186 114 C192 88 191 50 185 26 Z',
  'M114 16 C116 48 122 84 118 114 L138 114 C140 96 150 82 150 70 C150 58 138 44 134 16 Z',
  'M80 44 C83 60 84 80 80 98 L92 98 C95 80 95 60 92 44 Z',
];

// Escamitas claras repartidas por el cuerpo, sin tocar el ojo
const ESCAMAS = (() => {
  const lista: { cx: number; cy: number; rx: number; ry: number }[] = [];
  for (let i = 0; lista.length < 45 && i < 600; i++) {
    const x = 70 + azar() * 146;
    const y = 36 + azar() * 68;
    if (((x - 142) / 74) ** 2 + ((y - 70) / 34) ** 2 > 1) continue;
    if (Math.hypot(x - 202, y - 62) < 9) continue;
    if (lista.some((e) => Math.hypot(x - e.cx, y - e.cy) < 6)) continue;
    const r = 0.9 + azar() * 0.8;
    lista.push({ cx: r1(x), cy: r1(y), rx: r1(r), ry: r1(r * 0.65) });
  }
  return lista;
})();

export default function PezPayaso({
  className = '',
  color = '#F07A22',
  panza = '#FFB57C',
  franjas = '#FBF7F2',
  bordes = '#2B1F2E',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';
  // Pez payaso: cuerpo ovalado y alto, hocico corto, pedúnculo ancho
  const cuerpo =
    'M218 70 C218 56 206 44 188 39 C168 33 140 31 118 37 C100 42 86 50 72 58 C68 60 66 64 66 71 C66 78 68 82 72 84 C88 92 104 100 124 104 C148 108 176 106 196 98 C210 92 218 82 218 70 Z';

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {/* Burbujitas que salen de las branquias */}
      {burbujas && (
        <Soplo caja={[185.5, 5, 12.3, 26.2]} espejo={espejo} stroke={franjas} strokeWidth="1" fill="none">
          <circle cx="190" cy="29" r="2.2" />
          <circle cx="196" cy="20" r="1.6" />
          <circle cx="187" cy="12" r="1.3" />
          <circle cx="194" cy="6" r="0.9" fill={franjas} stroke="none" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
        <defs>
          <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.85" />
          </linearGradient>
          <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
          <clipPath id={`dorsal-${id}`}>
            <path d={DORSAL_ESPINOSA.forma} />
            <path d={DORSAL_BLANDA.forma} />
          </clipPath>
        </defs>

        <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
          {/* Cola redondeada con filete oscuro */}
          <path d={COLA.forma} fill={color} />
          <g stroke={sombra} strokeOpacity="0.18" strokeWidth="0.9" strokeLinecap="round">
            {COLA.radios.map((d, i) => <path key={i} d={d} />)}
          </g>
          <path d={COLA.borde} stroke={bordes} strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Aletas dorsales: la espinosa adelante, la blanda atrás, y la franja del medio que sube */}
          {[DORSAL_ESPINOSA, DORSAL_BLANDA].map((a, i) => (
            <path key={i} d={a.forma} fill={color} />
          ))}
          <g clipPath={`url(#dorsal-${id})`}>
            <path d={FRANJAS[1]} fill={franjas} stroke={bordes} strokeWidth="2" />
          </g>
          <g stroke={sombra} strokeOpacity="0.16" strokeWidth="0.9" strokeLinecap="round">
            {[...DORSAL_ESPINOSA.radios, ...DORSAL_BLANDA.radios].map((d, i) => <path key={i} d={d} />)}
          </g>
          <g stroke={bordes} strokeWidth="1.8" strokeLinecap="round" fill="none">
            <path d={DORSAL_ESPINOSA.borde} />
            <path d={DORSAL_BLANDA.borde} />
          </g>

          {/* Aleta anal y aleta pélvica (detrás del cuerpo) */}
          {[ANAL, PELVICA].map((a, i) => (
            <g key={i}>
              <path d={a.forma} fill={color} />
              <path d={a.forma} fill={sombra} fillOpacity="0.1" />
              <g stroke={sombra} strokeOpacity="0.16" strokeWidth="0.9" strokeLinecap="round">
                {a.radios.map((d, j) => <path key={j} d={d} />)}
              </g>
              <path d={a.borde} stroke={bordes} strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </g>
          ))}

          {/* Cuerpo */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Panza más clara */}
            <path d="M60 82 C100 98 160 104 224 78 L224 140 L60 140 Z" fill={panza} fillOpacity="0.6" />

            {/* Escamitas */}
            <g fill="#fff" fillOpacity="0.22">
              {ESCAMAS.map((e, i) => <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />)}
            </g>

            {/* Franjas blancas con filete oscuro */}
            <g fill={franjas} stroke={bordes} strokeWidth="2.2" strokeLinejoin="round">
              {FRANJAS.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* Sombra suave bajo el vientre */}
            <path d="M66 80 C100 100 160 108 220 76 C204 104 150 112 104 102 C86 96 74 90 66 80 Z" fill={sombra} fillOpacity="0.1" />

            {/* Brillo en el lomo */}
            <path d="M124 40 C146 35 170 36 190 43" stroke="#fff" strokeOpacity="0.26" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>

          {/* Boquita */}
          <path d="M208 76 C211 78.5 215 78.5 217.5 75.5" stroke={sombra} strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" fill="none" />

          {/* Aleta pectoral del frente */}
          <path d={PECTORAL.forma} fill={color} />
          <g stroke={sombra} strokeOpacity="0.2" strokeWidth="0.9" strokeLinecap="round">
            {PECTORAL.radios.map((d, i) => <path key={i} d={d} />)}
          </g>
          <path d={PECTORAL.borde} stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />

          {/* Cara */}
          <path d="M197 54.5 C200 52.5 205 52.5 208 55" stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="202" cy="62" r="5.2" fill={sombra} />
          <circle cx="203.9" cy="60.1" r="1.9" fill="#fff" />
          <circle cx="200.3" cy="64" r="0.8" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="205" cy="72" rx="3.6" ry="2.2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}