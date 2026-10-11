import { useId } from 'react';

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
  // Ballena azul: larga pero gordita, lomo moteado, pliegues en la garganta y aleta dorsal chiquita y muy atrás
  const cuerpo = 'M30 76 C40 50 82 32 126 33 C168 34 194 54 194 78 C194 100 168 113 128 113 C88 113 50 102 30 84 Z';
  return (
    <svg viewBox="0 0 200 130" className={`${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.88" />
        </linearGradient>
        <clipPath id={`cuerpo-${id}`}><path d={cuerpo} /></clipPath>
      </defs>
      <g transform={espejo ? 'translate(200 0) scale(-1 1)' : undefined}>
        {soplo && (
          <g className="ballena-soplo" fill={panza}>
            <path d="M146 30 C144 22 145 14 147 8 C149 14 150 22 148 30 Z" />
            <circle cx="138" cy="14" r="2.6" />
            <circle cx="156" cy="13" r="2.2" />
            <circle cx="134" cy="24" r="1.7" />
            <circle cx="160" cy="23" r="1.6" />
            <circle cx="147" cy="3" r="1.8" />
          </g>
        )}
        {/* Cola */}
        <path d="M36 78 C26 74 16 62 10 44 C6 42 3 43 1 46 C4 34 14 30 22 36 C28 26 36 24 42 28 C36 36 36 50 44 66 Z" fill={color} />
        <path d="M34 80 C24 86 14 98 12 112 C22 110 32 102 40 90 Z" fill={color} />
        <path d="M36 78 C26 74 16 62 10 44 C18 56 28 66 40 72 Z M34 80 C26 88 18 98 12 112 C24 104 32 96 40 88 Z" fill="#0E2A20" fillOpacity="0.14" />
        {/* Aleta dorsal */}
        <path d="M64 46 C66 38 72 36 76 38 C74 41 74 44 76 47 Z" fill={color} />
        <path d="M64 46 C66 38 72 36 76 38 C74 41 74 44 76 47 Z" fill="#0E2A20" fillOpacity="0.14" />
        {/* Cuerpo */}
        <path d={cuerpo} fill={`url(#lomo-${id})`} />
        <g clipPath={`url(#cuerpo-${id})`}>
          {/* Panza con sus pliegues */}
          <path d="M20 88 C70 100 140 98 200 72 L200 130 L20 130 Z" fill={panza} />
          <g stroke={color} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" fill="none">
            <path d="M88 99 C120 103 156 99 186 86" />
            <path d="M94 104 C122 108 154 104 180 93" />
            <path d="M104 108 C126 111 150 108 170 100" />
            <path d="M116 112 C130 113 146 112 158 107" />
          </g>
          {/* Sombra bajo el lomo y motas */}
          <path d="M30 84 C60 96 100 100 140 98 C100 106 56 100 30 88 Z" fill="#0E2A20" fillOpacity="0.1" />
          <g fill="#0E2A20" fillOpacity="0.16">
            <circle cx="76" cy="58" r="3.2" /><circle cx="92" cy="50" r="2.2" /><circle cx="104" cy="60" r="3" />
            <circle cx="118" cy="48" r="2.4" /><circle cx="60" cy="68" r="2.2" /><circle cx="88" cy="70" r="1.8" />
            <circle cx="126" cy="62" r="1.9" /><circle cx="110" cy="74" r="1.6" /><circle cx="134" cy="46" r="1.6" />
          </g>
          <g fill="#fff" fillOpacity="0.3">
            <circle cx="84" cy="62" r="1.3" /><circle cx="98" cy="68" r="1.1" /><circle cx="70" cy="62" r="1" /><circle cx="114" cy="56" r="1.2" />
          </g>
          {/* Brillo en el lomo */}
          <path d="M78 44 C96 38 122 38 146 44" stroke="#fff" strokeOpacity="0.32" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
        {/* Aleta */}
        <path d="M112 102 C114 114 124 124 138 124 C134 116 130 108 130 100 Z" fill={color} />
        <path d="M112 102 C114 114 124 124 138 124 C128 118 120 110 118 101 Z" fill="#0E2A20" fillOpacity="0.16" />
        {/* Cara */}
        <path d="M192 82 C180 92 164 95 148 92" stroke="#0E2A20" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="163" cy="74" r="6" fill="#0E2A20" />
        <circle cx="165" cy="72" r="2.1" fill="#fff" />
        <circle cx="161" cy="76.5" r="1" fill="#fff" fillOpacity="0.7" />
        <ellipse cx="172" cy="85" rx="6.5" ry="4" fill="#F2B8A0" opacity="0.75" />
      </g>
    </svg>
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
      <Burbujas className="absolute w-1/3 -top-[30%] right-[12%]" />
    </div>
  );
}
