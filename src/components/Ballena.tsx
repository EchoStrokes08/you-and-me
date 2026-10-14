import { useId } from 'react';
import Soplo from './Soplo';

type Props = {
  className?: string;
  /** Color principal del lomo */
  color?: string;
  /** Color de la panza */
  panza?: string;
  /** Muestra el chorrito de agua */
  soplo?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animación de nado suave */
  nadando?: boolean;
};

export default function Ballena({ className = '', color = '#4E86B4', panza = '#D8E8F3', soplo = true, espejo = false, nadando = true }: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';
  // Ballena jorobada: cuerpo largo, mandíbula blanca con pliegues, aletas pectorales largas y onduladas
  const cuerpo =
    'M38 33 C48 38 60 42 74 42 C100 37 128 31 160 31 C190 31 214 35 226 42 C234 46 235 51 231 55 C222 68 206 82 184 89 C158 97 126 96 102 89 C78 81 58 66 46 54 C42 48 40 41 38 33 Z';
  const aletaFrente =
    'M136 68 C126 82 108 102 97 118 C102 121 108 120 112 117 C116 117 119 113 123 112 C126 109 129 107 131 103 C135 96 141 86 150 72 Z';

  return (
    <div className={`mascota ${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      {soplo && (
        <Soplo caja={[169, 1, 26, 28]} espejo={espejo} fill={panza}>
          <path d="M181 29 C179 22 180 14 182 8 C184 14 185 22 183 29 Z" />
          <circle cx="174" cy="14" r="2.4" />
          <circle cx="190" cy="13" r="2" />
          <circle cx="171" cy="22" r="1.6" />
          <circle cx="193" cy="22" r="1.5" />
          <circle cx="182" cy="3" r="1.7" />
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
          {/* Cola: lóbulo hacia arriba y lóbulo hacia atrás */}
          <path d="M40 34 C42 26 48 19 55 15 C57 21 55 29 49 37 Z" fill={color} />
          <path d="M55 15 C57 21 55 29 49 37 L47 36 C52 29 54 22 54 16 Z" fill={panza} fillOpacity="0.55" />
          <path d="M42 33 C32 29 18 26 7 27 C12 33 24 40 42 45 Z" fill={color} />
          <path d="M7 27 C12 33 24 40 42 45 L42 43 C26 38 14 32 9 28 Z" fill={panza} fillOpacity="0.55" />
          <path d="M42 33 C32 30 20 28 10 28 C22 31 32 34 42 38 Z" fill={sombra} fillOpacity="0.12" />

          {/* Aleta dorsal chiquita */}
          <path d="M82 41 C86 34 94 33 100 34 C98 36 100 39 106 40 Z" fill={color} />
          <path d="M82 41 C86 34 94 33 100 34 C96 36 94 39 96 41 Z" fill={sombra} fillOpacity="0.12" />

          {/* Aleta pectoral del otro lado (detrás del cuerpo) */}
          <path d="M156 92 C154 102 151 112 152 121 C158 120 162 116 165 110 C168 104 171 98 174 92 Z" fill={color} />
          <path d="M156 92 C154 102 151 112 152 121 C158 120 162 116 165 110 C168 104 171 98 174 92 Z" fill={panza} fillOpacity="0.55" />

          {/* Cuerpo */}
          <path d={cuerpo} fill={`url(#lomo-${id})`} />
          <g clipPath={`url(#cuerpo-${id})`}>
            {/* Mandíbula y panza blancas */}
            <path d="M232 47 C222 49 208 49 196 51 C184 54 172 60 160 66 C148 71 130 72 112 71 C92 70 72 62 50 52 L40 60 L40 140 L240 140 L240 47 Z" fill={panza} />
            {/* Franja azul ondulada entre el costado y la panza */}
            <path d="M70 64 C82 72 96 75 110 76 C118 76 124 78 132 82 C120 82 108 84 96 82 C86 80 78 74 70 64 Z" fill={color} fillOpacity="0.55" />

            {/* Pliegues de la garganta */}
            <g stroke={color} strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" fill="none">
              <path d="M228 52 C214 62 196 70 168 76 C152 79 138 80 124 80" />
              <path d="M228 57 C214 68 194 77 166 82 C150 85 136 85 120 84" />
              <path d="M224 63 C210 74 190 82 162 87 C148 89 134 89 118 88" />
              <path d="M218 70 C204 80 186 87 160 91 C146 92 132 92 118 91" />
              <path d="M210 77 C196 85 180 90 158 93" />
              <path d="M198 83 C186 88 172 92 156 94" />
            </g>

            {/* Puntitos claros sobre la mandíbula */}
            <g fill={color} fillOpacity="0.45">
              <circle cx="200" cy="55" r="0.9" /><circle cx="207" cy="54" r="0.9" />
              <circle cx="214" cy="53" r="0.9" /><circle cx="221" cy="52" r="0.8" />
            </g>

            {/* Sombra suave bajo el lomo */}
            <path d="M50 52 C72 62 92 70 112 71 C130 72 148 71 160 66 C146 75 124 77 104 75 C84 73 64 64 50 52 Z" fill={sombra} fillOpacity="0.08" />

            {/* Motas oscuras */}
            <g fill={sombra} fillOpacity="0.2">
              <ellipse cx="60" cy="48" rx="1.6" ry="1.2" /><ellipse cx="70" cy="52" rx="1.3" ry="1" />
              <ellipse cx="84" cy="50" rx="2" ry="1.5" /><ellipse cx="90" cy="44" rx="1.4" ry="1" />
              <ellipse cx="100" cy="48" rx="2.4" ry="1.7" /><ellipse cx="96" cy="58" rx="1.5" ry="1.1" />
              <ellipse cx="110" cy="36" rx="1.2" ry="0.9" /><ellipse cx="112" cy="44" rx="1.8" ry="1.3" />
              <ellipse cx="118" cy="60" rx="1.6" ry="1.2" /><ellipse cx="122" cy="52" rx="2.2" ry="1.6" />
              <ellipse cx="128" cy="62" rx="1.3" ry="1" /><ellipse cx="134" cy="40" rx="1.5" ry="1.1" />
              <ellipse cx="140" cy="56" rx="1.4" ry="1" /><ellipse cx="146" cy="46" rx="1.8" ry="1.3" />
              <ellipse cx="152" cy="38" rx="1.2" ry="0.9" /><ellipse cx="165" cy="44" rx="1.3" ry="1" />
              <ellipse cx="176" cy="38" rx="1.1" ry="0.8" />
            </g>

            {/* Protuberancias sobre la cabeza */}
            <g fill={sombra} fillOpacity="0.28">
              <circle cx="180" cy="41" r="0.9" /><circle cx="188" cy="41" r="1" /><circle cx="196" cy="42" r="1" />
              <circle cx="203" cy="43" r="0.9" /><circle cx="209" cy="44" r="0.8" /><circle cx="215" cy="45" r="0.7" />
            </g>

            {/* Motas claras alargadas */}
            <g fill="#fff" fillOpacity="0.32">
              <ellipse cx="104" cy="40" rx="2.6" ry="1.1" /><ellipse cx="120" cy="36" rx="3" ry="1.3" />
              <ellipse cx="138" cy="34" rx="3" ry="1.2" /><ellipse cx="150" cy="36" rx="2.4" ry="1" />
              <ellipse cx="190" cy="36" rx="2.6" ry="1" />
            </g>

            {/* Brillo en el lomo */}
            <path d="M90 37 C112 32 140 30 168 31" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>

          {/* Línea de la mandíbula */}
          <path d="M231 49 C218 50 204 50 192 53 C182 56 172 61 160 67" stroke={sombra} strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" fill="none" />

          {/* Aleta pectoral larga del frente, con borde claro ondulado */}
          <path d={aletaFrente} fill={color} />
          <path d="M97 118 C102 121 108 120 112 117 C116 117 119 113 123 112 C126 109 129 107 131 103 C135 96 141 86 150 72 L147 72 C139 86 132 96 127 103 C122 108 114 112 100 117 Z" fill={panza} fillOpacity="0.85" />
          <path d="M136 68 C126 82 108 102 97 118 C104 108 116 94 126 82 C130 76 134 72 140 70 Z" fill={sombra} fillOpacity="0.14" />
          <path d="M134 69 C140 66 146 67 150 72" stroke={sombra} strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" fill="none" />

          {/* Cara */}
          <path d="M157 52 C160 49.5 166 49.5 169 52.5" stroke={sombra} strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" fill="none" />
          <circle cx="163" cy="57" r="4.3" fill={sombra} />
          <circle cx="164.5" cy="55.5" r="1.5" fill="#fff" />
          <circle cx="161.8" cy="58.6" r="0.7" fill="#fff" fillOpacity="0.7" />
          <ellipse cx="155" cy="61.5" rx="3.6" ry="2.2" fill="#F2B8A0" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}

/** Banda de olas que se desplaza en bucle */
export function Olas({ className = '', color = '#D8ECDF', opacidad = 1 }: { className?: string; color?: string; opacidad?: number }) {
  const ola = 'M0 20 C40 0 80 0 120 20 C160 40 200 40 240 20 C280 0 320 0 360 20 C400 40 440 40 480 20 L480 60 L0 60 Z';
  return (
    <div className={`overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <svg viewBox="0 0 960 60" preserveAspectRatio="none" className="olas w-[200%] h-full block">
        <path d={ola} fill={color} fillOpacity={opacidad} />
        <path d={ola} transform="translate(480 0)" fill={color} fillOpacity={opacidad} />
      </svg>
    </div>
  );
}

/** Burbujitas que suben */
export function Burbujas({ className = '', color = '#CFE9E4' }: { className?: string; color?: string }) {
  const b = [
    { x: 10, r: 4, d: 0 },
    { x: 30, r: 2.5, d: 1.2 },
    { x: 52, r: 3.5, d: 2.1 },
    { x: 74, r: 2, d: 0.6 },
    { x: 90, r: 3, d: 2.8 },
  ];
  return (
    <svg viewBox="0 0 100 80" className={`pointer-events-none ${className}`} aria-hidden="true">
      {b.map((p, i) => (
        <circle key={i} cx={p.x} cy={74} r={p.r} fill="none" stroke={color} strokeWidth="1.5" className="burbuja" style={{ animationDelay: `${p.d}s`, transformBox: 'fill-box' }} />
      ))}
    </svg>
  );
}

/** Mamá y bebé ballena juntas: el "nosotros" del océano */
export function FamiliaBallenas({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <Ballena className="w-full" />
      <Ballena className="absolute w-[42%] -bottom-[6%] -left-[14%]" color="#6E9FC8" panza="#E4F0F8" soplo={false} />
    </div>
  );
}

/** El mar del héroe: rayos de luz desde la superficie y plancton que brilla */
export function Mar({ className = '', children, ...rest }: { className?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`card-hero ${className}`} {...rest}>
      <svg viewBox="0 0 390 200" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-[0.1] pointer-events-none" aria-hidden="true">
        <path d="M150 0h40L110 200H40zM250 0h26l-50 200h-44zM330 0h18l-30 200h-30z" fill="#fff" />
      </svg>
      <svg viewBox="0 0 390 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full text-lima opacity-60 pointer-events-none" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="150" cy="38" r="1.6" /><circle cx="182" cy="132" r="1.2" /><circle cx="206" cy="22" r="1.4" /><circle cx="246" cy="176" r="1.6" />
          <circle cx="300" cy="18" r="1.2" /><circle cx="350" cy="150" r="1.4" /><circle cx="120" cy="164" r="1.2" /><circle cx="60" cy="180" r="1.5" /><circle cx="366" cy="60" r="1.3" />
        </g>
      </svg>
      {children}
    </section>
  );
}
