// La orca, mascota principal: torpedo negro con la mancha blanca sobre el ojo y la silla gris tras la aleta dorsal.
// Su cola y su aleta se animan con transform-origin en coordenadas del viewBox (240×140).
import { useId } from 'react';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal (el negro de la orca) */
  color?: string;
  /** Color de las manchas blancas (ojo, garganta, panza, flanco) */
  panza?: string;
  /** Color de la "silla" gris detrás de la aleta dorsal */
  silla?: string;
  /** Muestra el chorrito de agua */
  soplo?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

export default function Orca({ className = '', color = '#1F2630', panza = '#F1F4F6', silla = '#8A949E', soplo = true, espejo = false, nadando = true }: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0A0F14';
  // Orca: cuerpo de torpedo, aleta dorsal alta, mancha blanca sobre el ojo, panza blanca y parche en el flanco
  const cuerpo =
    'M34 64 C50 56 72 48 100 44 C130 40 160 38 186 40 C208 42 224 47 232 56 C236 60 237 64 234 67 C226 74 210 80 190 85 C164 92 126 94 98 89 C72 84 50 75 34 66 Z';
  const dorsal = 'M150 40 C140 26 128 14 120 6 C123 20 121 32 116 44 Z';
  const aletaFrente = 'M180 80 C176 92 166 108 154 118 C146 124 140 118 144 110 C150 100 160 88 166 80 Z';

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {soplo && (
        <Soplo caja={[187, 10, 26, 29]} espejo={espejo} fill={panza}>
          <path d="M199 39 C197 32 198 24 200 18 C202 24 203 32 201 39 Z" />
          <circle cx="192" cy="24" r="2.4" />
          <circle cx="208" cy="23" r="2" />
          <circle cx="189" cy="32" r="1.6" />
          <circle cx="211" cy="32" r="1.5" />
          <circle cx="200" cy="12" r="1.7" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
        <defs>
          <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.92" />
          </linearGradient>
          <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
        </defs>

        <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
          {/* Cola: lóbulos negros por arriba y blancos por debajo */}
          <g className={nadando ? 'cola-nado' : ''} style={{ transformOrigin: '35px 64px', ['--coleteo' as string]: '5deg' }}>
            <path d="M36 62 C30 54 22 46 10 42 C12 50 20 58 32 66 Z" fill={color} />
            <path d="M10 42 C12 50 20 58 32 66 L34 63 C24 56 16 50 12 44 Z" fill={panza} fillOpacity="0.85" />
            <path d="M34 64 C24 68 14 76 6 86 C18 86 28 78 36 68 Z" fill={color} />
            <path d="M6 86 C18 86 28 78 36 68 L34 66 C26 74 16 82 8 85 Z" fill={panza} fillOpacity="0.85" />
          </g>

          {/* Aleta dorsal alta, un poquito curvada hacia atrás */}
          <path d={dorsal} fill={color} />
          <path d="M150 40 C140 26 128 14 120 6 C126 16 136 28 144 40 Z" fill="#fff" fillOpacity="0.12" />

          {/* Aleta pectoral del otro lado (detrás del cuerpo): nace de la panza, apenas asoma su punta */}
          <path d="M160 84 C157 94 150 103 142 110 C136 114 132 110 135 104 C140 96 148 88 155 84 Z" fill={color} />
          <path d="M160 84 C157 94 150 103 142 110 C136 114 132 110 135 104 C140 96 148 88 155 84 Z" fill={sombra} fillOpacity="0.25" />
          <path d="M158 85 C155 93 149 101 143 107 C146 100 152 92 156 85 Z" fill="#fff" fillOpacity="0.08" />

          {/* Cuerpo */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Garganta, panza y parche blanco del flanco */}
            <path
              d="M240 66 L235 65.5 C226 68 214 70 204 69 C198 74 188 79 176 82 C160 86 138 88 120 87 C106 84 92 76 78 70 C70 67 62 66 56 67 C64 74 76 82 90 88 L90 140 L240 140 Z"
              fill={panza}
            />
            {/* Sombrita suave en el borde del blanco */}
            <path d="M204 69 C198 74 188 79 176 82 C160 86 138 88 120 87 C140 90 162 89 178 85 C190 82 198 77 204 69 Z" fill={sombra} fillOpacity="0.06" />

            {/* Silla gris detrás de la aleta dorsal */}
            <path d="M118 43 C106 44 94 46 84 50 C86 55 92 58 98 57 C96 54 98 51 104 50 C108 49 113 48 118 47 Z" fill={silla} fillOpacity="0.9" />

            {/* Mancha blanca sobre el ojo */}
            <path d="M168 58 C170 52 182 49 190 52 C194 54 192 58 186 60 C180 62 170 62 168 58 Z" fill={panza} />

            {/* Brillo en el lomo */}
            <path d="M140 42 C168 39 196 40 214 46" stroke="#fff" strokeOpacity="0.16" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M60 58 C76 52 92 48 108 46" stroke="#fff" strokeOpacity="0.08" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>

          {/* Sonrisa (línea de la boca) */}
          <path d="M235 65.5 C226 68 214 70 204 69" stroke={sombra} strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" fill="none" />

          {/* Aleta pectoral grande del frente, en forma de remo */}
          <g className={nadando ? 'aleta-nado' : ''} style={{ transformOrigin: '173px 80px', ['--aleteo' as string]: '-14deg' }}>
            <path d={aletaFrente} fill={color} />
            <path d="M180 80 C176 92 166 108 154 118 C162 106 170 94 174 80 Z" fill="#fff" fillOpacity="0.1" />
            <path d="M166 80 C160 88 150 100 144 110 C142 114 143 118 146 119 C148 108 158 94 170 82 Z" fill={sombra} fillOpacity="0.25" />
          </g>

          {/* Cara: ojo con aro clarito para que se vea sobre el negro */}
          <path d="M191 59.5 C194 57.5 199 57.5 202 60" stroke="#fff" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="197" cy="64" r="4.2" fill="#3A4552" />
          <circle cx="197" cy="64" r="3.2" fill={sombra} />
          <circle cx="198.3" cy="62.7" r="1.3" fill="#fff" />
          <circle cx="196" cy="65.4" r="0.6" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="200" cy="75" rx="3.4" ry="2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}