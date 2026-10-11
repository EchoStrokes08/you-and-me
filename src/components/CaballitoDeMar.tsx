import { useId } from 'react';

type Props = {
  className?: string;
  color?: string;
  panza?: string;
  detalles?: string;
  burbujas?: boolean;
  espejo?: boolean;
  nadando?: boolean;
};

export default function CaballitoDeMar({
  className = '',
  color = '#E88B4D',
  panza = '#FCE3C8',
  detalles = '#C46A2C',
  burbujas = true,
  espejo = false,
  nadando = true,
}: Props) {
  const id = useId().replace(/:/g, '');
  const sombra = '#0E2A20';

  return (
    <svg viewBox="0 0 240 140" className={`${nadando ? 'ballena-nado' : ''} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`cuerpo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={detalles} />
        </linearGradient>
      </defs>

      <g transform={espejo ? 'translate(240 0) scale(-1 1)' : undefined}>
        {/* Burbujitas */}
        {burbujas && (
          <g className="ballena-soplo" fill={panza}>
            <circle cx="165" cy="25" r="2.2" />
            <circle cx="172" cy="18" r="1.6" />
            <circle cx="168" cy="10" r="1.2" />
          </g>
        )}

        {/* Aleta dorsal pequeña abanico */}
        <path d="M102 55 C92 45 88 50 86 65 C94 65 98 62 102 55 Z" fill={panza} opacity="0.8" stroke={detalles} strokeWidth="1" />

        {/* Cuerpo curvado característico de caballito de mar */}
        {/* Cabeza con hociquito largo */}
        <path
          d="M110 32 C115 22 128 20 138 26 C144 23 154 26 158 32 C162 34 156 38 146 38 C140 44 130 46 122 46 L120 54 C128 58 132 68 128 78 C124 88 116 94 116 102 C116 110 124 114 122 120 C120 124 112 122 108 116 C104 110 110 102 110 94 C110 88 116 82 114 74 C112 66 102 58 102 48 C102 38 106 34 110 32 Z"
          fill={`url(#cuerpo-${id})`}
        />

        {/* Pecho / Pliegues de la panza marcados */}
        <path
          d="M120 46 C126 50 128 58 126 66 C124 74 118 80 116 88 C114 80 118 72 120 66 C122 58 118 50 114 46 Z"
          fill={panza}
        />

        {/* Anillos / Pliegues horizontales */}
        <g stroke={detalles} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" fill="none">
          <path d="M112 52 Q120 54 122 52" />
          <path d="M110 60 Q122 62 125 60" />
          <path d="M108 68 Q122 70 124 67" />
          <path d="M108 76 Q120 78 122 75" />
          <path d="M109 84 Q118 86 119 83" />
          <path d="M110 92 Q116 94 116 91" />
        </g>

        {/* Corona / Cresta en la cabeza */}
        <path d="M124 22 Q128 16 132 20 Q134 15 138 22" fill={panza} stroke={detalles} strokeWidth="1" />

        {/* Ojo tierno */}
        <circle cx="132" cy="30" r="3.5" fill={sombra} />
        <circle cx="133" cy="29" r="1.2" fill="#fff" />
        <ellipse cx="135" cy="35" rx="2.5" ry="1.5" fill="#F2B8A0" opacity="0.7" />

        {/* Aleta pectoral cerca de las agallas */}
        <path d="M126 42 Q132 44 128 48 Z" fill={panza} stroke={detalles} strokeWidth="0.8" />
      </g>
    </svg>
  );
}
