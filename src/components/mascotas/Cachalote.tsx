// El cachalote, mascota principal: cabeza cuadrada, mandíbula con dientes y soplo inclinado hacia adelante, como le sale a los suyos.
// Su cola y su aleta se animan con transform-origin en coordenadas del viewBox (240×140).
import { useId } from 'react';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal del cuerpo */
  color?: string;
  /** Color de la mandíbula y la panza */
  panza?: string;
  /** Muestra el chorrito de agua (inclinado hacia adelante, como el de los cachalotes) */
  soplo?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

export default function Cachalote({ className = '', color = '#6F8FB3', panza = '#DCE5EE', soplo = true, espejo = false, nadando = true }: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';
  // Cachalote: cabeza enorme y cuadrada, mandíbula inferior angosta con dientes, piel arrugada, joroba en vez de aleta dorsal
  const cuerpo =
    'M30 62 C44 56 60 48 80 43 C100 38 118 32 140 29 C170 26 205 25 222 28 C232 30 236 38 236 48 C236 60 234 70 228 76 C226 80 224 82 222 84 C206 92 180 95 150 94 C120 93 90 88 66 80 C50 74 38 68 30 62 Z';
  const boca = 'M229 76 C214 77.5 196 77.5 178 77 C186 79 204 82 224 83 Z';
  const aletaFrente = 'M150 84 C146 92 140 100 132 106 C140 108 150 104 156 96 C158 92 158 88 156 84 Z';
  const dientes = [184, 190, 196, 202, 208, 214, 220].map((x) => ({ x, y: 80 + ((x - 180) / 44) * 3 }));

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {soplo && (
        <Soplo caja={[214, 0, 21, 28]} espejo={espejo} fill={panza}>
          {/* El soplo del cachalote sale inclinado hacia adelante */}
          <path d="M219 27 C220 20 223 12 228 6 C229 13 226 21 222 28 Z" />
          <circle cx="220" cy="8" r="2.2" />
          <circle cx="233" cy="10" r="1.8" />
          <circle cx="216" cy="16" r="1.5" />
          <circle cx="231" cy="18" r="1.4" />
          <circle cx="230" cy="2" r="1.5" />
        </Soplo>
      )}
      <svg viewBox="0 0 240 140" className="relative block w-full h-full">
        <defs>
          <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.85" />
          </linearGradient>
          <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
          <clipPath id={`boca-${id}`}><path d={boca} /></clipPath>
        </defs>

        <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
          {/* Cola: lóbulo hacia arriba y lóbulo hacia atrás */}
          <g className={nadando ? 'cola-nado' : ''} style={{ transformOrigin: '33px 62px', ['--coleteo' as string]: '5deg' }}>
            <path d="M34 60 C30 50 24 42 14 36 C14 46 20 56 30 64 Z" fill={color} />
            <path d="M14 36 C14 46 20 56 30 64 L32 62 C24 55 18 46 16 38 Z" fill={panza} fillOpacity="0.5" />
            <path d="M32 62 C22 64 12 70 4 78 C16 80 26 74 34 66 Z" fill={color} />
            <path d="M4 78 C16 80 26 74 34 66 L33 64 C25 71 15 76 6 77 Z" fill={panza} fillOpacity="0.5" />
            <path d="M33 61 C26 62 18 66 10 72 C20 68 28 66 34 65 Z" fill={sombra} fillOpacity="0.12" />
          </g>

          {/* Joroba dorsal y "nudillos" hacia la cola */}
          <path d="M66 49 C70 41 78 37 85 37 C90 37 93 39 98 40 L98 44 L66 52 Z" fill={color} />
          <path d="M66 49 C70 41 78 37 85 37 C80 40 78 44 80 47 Z" fill={sombra} fillOpacity="0.12" />
          <circle cx="58" cy="51.5" r="2.5" fill={color} />
          <circle cx="50" cy="55" r="2" fill={color} />
          <circle cx="43" cy="58.5" r="1.6" fill={color} />

          {/* Aleta pectoral del otro lado (detrás del cuerpo) */}
          <path d="M176 90 C176 98 174 104 170 108 C176 108 182 102 184 92 Z" fill={color} />
          <path d="M176 90 C176 98 174 104 170 108 C176 108 182 102 184 92 Z" fill={panza} fillOpacity="0.55" />

          {/* Cuerpo */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Mandíbula inferior y panza claras */}
            <path d="M240 84 L224 83 C204 82 186 79 178 77 C170 82 160 87 146 89 C120 91 92 85 66 78 C52 74 40 68 30 62 L30 140 L240 140 Z" fill={panza} />

            {/* Líneas suaves en la panza */}
            <g stroke={color} strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" fill="none">
              <path d="M200 86 C180 90 160 92 136 92" />
              <path d="M190 90 C172 93 152 94 130 94" />
              <path d="M120 89 C104 88 88 84 74 80" />
            </g>

            {/* Sombra suave bajo la cabeza */}
            <path d="M236 66 C222 74 200 76 178 77 C160 79 140 82 120 82 C142 86 164 84 180 81 C200 80 222 78 236 72 Z" fill={sombra} fillOpacity="0.08" />

            {/* Piel arrugada en la mitad trasera */}
            <g stroke={sombra} strokeOpacity="0.16" strokeWidth="1.2" strokeLinecap="round" fill="none">
              <path d="M60 58 C66 56 70 58 76 56" />
              <path d="M72 64 C78 62 84 64 90 62" />
              <path d="M86 52 C92 50 96 52 102 50" />
              <path d="M96 70 C102 68 108 70 114 68" />
              <path d="M104 58 C110 56 116 58 122 56" />
              <path d="M116 46 C122 44 126 46 132 44" />
              <path d="M126 64 C132 62 136 64 142 62" />
              <path d="M138 52 C143 50 147 52 152 50" />
            </g>

            {/* Motas oscuras */}
            <g fill={sombra} fillOpacity="0.2">
              <ellipse cx="146" cy="40" rx="1.6" ry="1.2" /><ellipse cx="158" cy="48" rx="1.3" ry="1" />
              <ellipse cx="170" cy="36" rx="2" ry="1.5" /><ellipse cx="178" cy="54" rx="1.4" ry="1" />
              <ellipse cx="186" cy="44" rx="2.2" ry="1.6" /><ellipse cx="196" cy="62" rx="1.5" ry="1.1" />
              <ellipse cx="200" cy="36" rx="1.2" ry="0.9" /><ellipse cx="206" cy="50" rx="1.8" ry="1.3" />
              <ellipse cx="218" cy="40" rx="1.4" ry="1" /><ellipse cx="224" cy="60" rx="1.6" ry="1.2" />
              <ellipse cx="110" cy="48" rx="1.4" ry="1" /><ellipse cx="92" cy="58" rx="1.2" ry="0.9" />
              <ellipse cx="128" cy="38" rx="1.5" ry="1.1" />
            </g>

            {/* Motas claras alargadas */}
            <g fill="#fff" fillOpacity="0.3">
              <ellipse cx="150" cy="33" rx="3" ry="1.2" /><ellipse cx="176" cy="30" rx="3.2" ry="1.3" />
              <ellipse cx="196" cy="31" rx="2.6" ry="1" /><ellipse cx="164" cy="56" rx="2.4" ry="1" />
              <ellipse cx="212" cy="66" rx="2.6" ry="1.1" /><ellipse cx="120" cy="40" rx="2.4" ry="1" />
            </g>

            {/* Cicatrices de calamar en la frente */}
            <g stroke="#fff" strokeOpacity="0.32" strokeWidth="0.8" fill="none">
              <circle cx="222" cy="46" r="1.6" /><circle cx="227" cy="52" r="1.2" />
              <circle cx="216" cy="54" r="1.3" />
              <path d="M210 40 C214 38 218 39 221 37" strokeLinecap="round" />
            </g>

            {/* Brillo en la cabeza */}
            <path d="M130 33 C160 28 190 27 216 30" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Boca entreabierta con lengua y dientes de abajo */}
            <path d={boca} fill={sombra} fillOpacity="0.75" />
            <g clipPath={`url(#boca-${id})`}>
              <ellipse cx="190" cy="79" rx="8" ry="1.6" fill="#E79A9A" />
            </g>
            <g fill="#fff">
              {dientes.map((d) => (
                <path key={d.x} d={`M${d.x - 1.6} ${d.y + 0.4} L${d.x} ${d.y - 2.4} L${d.x + 1.6} ${d.y + 0.4} Z`} />
              ))}
            </g>
          </g>

          {/* Línea de la boca y espiráculo */}
          <path d="M229 76 C214 77.5 196 77.5 178 77" stroke={sombra} strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <ellipse cx="220" cy="28.5" rx="2" ry="0.8" fill={sombra} fillOpacity="0.3" />

          {/* Aleta pectoral del frente, chiquita y con borde claro */}
          <g className={nadando ? 'aleta-nado' : ''} style={{ transformOrigin: '153px 84px', ['--aleteo' as string]: '-12deg' }}>
            <path d={aletaFrente} fill={color} />
            <path d="M132 106 C140 108 150 104 156 96 C158 92 158 88 156 84 L154 85 C155 90 153 95 149 99 C144 103 138 105 132 106 Z" fill={panza} fillOpacity="0.8" />
            <path d="M150 84 C146 92 140 100 132 106 C140 98 146 92 152 86 Z" fill={sombra} fillOpacity="0.14" />
          </g>

          {/* Cara: el ojo va bajito, cerca de la comisura */}
          <path d="M160 61 C163 58.5 169 58.5 172 61.5" stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="166" cy="67" r="4.3" fill={sombra} />
          <circle cx="167.5" cy="65.5" r="1.5" fill="#fff" />
          <circle cx="164.8" cy="68.6" r="0.7" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="158" cy="73" rx="3.6" ry="2.2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}