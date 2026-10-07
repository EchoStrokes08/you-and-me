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

export default function Ballena({ className = '', color = '#2C6E73', panza = '#CFE9E4', soplo = true, espejo = false, nadando = true }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 130" className={`${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`lomo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.85" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <g transform={espejo ? 'translate(200 0) scale(-1 1)' : undefined}>
        {soplo && (
          <g className="ballena-soplo" stroke={panza} strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M146 34 C146 24 140 18 132 14" />
            <path d="M146 34 C146 24 152 18 160 14" />
            <path d="M146 34 L146 10" />
            <circle cx="128" cy="10" r="3" fill={panza} stroke="none" />
            <circle cx="164" cy="10" r="3" fill={panza} stroke="none" />
          </g>
        )}
        {/* Cola */}
        <path
          d="M50 82 C36 78 26 66 22 52 C16 48 6 48 2 52 C6 40 18 36 26 40 C26 30 34 22 44 22 C38 30 36 40 38 50 C42 62 52 70 64 72 Z"
          fill={`url(#lomo-${id})`}
        />
        {/* Cuerpo */}
        <path
          d="M40 82 C40 54 72 36 112 36 C156 36 190 58 190 86 C190 106 172 118 144 118 L82 118 C56 118 40 102 40 82 Z"
          fill={`url(#lomo-${id})`}
        />
        {/* Panza con rayitas */}
        <path d="M58 104 C80 116 150 120 184 98 C178 110 164 118 144 118 L82 118 C70 118 62 112 58 104 Z" fill={panza} />
        <g stroke={color} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round">
          <path d="M100 111 L102 117" />
          <path d="M120 112 L121 118" />
          <path d="M140 111 L140 117" />
          <path d="M160 107 L158 113" />
        </g>
        {/* Aleta */}
        <path d="M112 96 C118 110 130 116 140 112 C132 108 124 102 120 92 Z" fill={color} />
        {/* Brillo en el lomo */}
        <path d="M86 50 C100 44 118 42 134 46" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Cara */}
        <circle cx="160" cy="78" r="5.5" fill="#0E2A20" />
        <circle cx="162" cy="76" r="1.8" fill="#fff" />
        <circle cx="172" cy="90" r="6" fill="#F2B8A0" opacity="0.7" />
        <path d="M150 92 Q158 99 167 93" stroke="#0E2A20" strokeWidth="2.6" strokeLinecap="round" fill="none" />
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
      <Ballena className="absolute w-[42%] -bottom-[6%] -left-[14%]" color="#2F8F63" panza="#EAF5ED" soplo={false} />
      <Burbujas className="absolute w-1/3 -top-[30%] right-[12%]" />
    </div>
  );
}
