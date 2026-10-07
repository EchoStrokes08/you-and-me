import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import Ballena from './Ballena';

/* ---------- Iconos (trazo, heredan currentColor) ---------- */
type IconProps = { className?: string };
const base = (path: ReactNode, className = 'w-6 h-6') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{path}</svg>
);
export const IconoCasa = ({ className }: IconProps) => base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5.5h4V20" /></>, className);
export const IconoCarta = ({ className }: IconProps) => base(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>, className);
export const IconoBurbuja = ({ className }: IconProps) => base(<><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M9 11h.01M12 11h.01M15 11h.01" /></>, className);
export const IconoFotos = ({ className }: IconProps) => base(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>, className);
export const IconoMapa = ({ className }: IconProps) => base(<><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" /><path d="M9 4v13M15 6.5v13" /></>, className);
export const IconoAjustes = ({ className }: IconProps) => base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>, className);
export const IconoAtras = ({ className }: IconProps) => base(<path d="M15 18 9 12l6-6" />, className ?? 'w-5 h-5');
export const IconoAdelante = ({ className }: IconProps) => base(<path d="m9 18 6-6-6-6" />, className ?? 'w-5 h-5');
export const IconoCerrar = ({ className }: IconProps) => base(<path d="M18 6 6 18M6 6l12 12" />, className ?? 'w-5 h-5');
export const IconoCheck = ({ className }: IconProps) => base(<path d="M20 6 9 17l-5-5" />, className ?? 'w-4 h-4');
export const IconoMas = ({ className }: IconProps) => base(<path d="M12 5v14M5 12h14" />, className ?? 'w-5 h-5');
export const IconoFlecha = ({ className }: IconProps) => base(<path d="M5 12h14M13 6l6 6-6 6" />, className ?? 'w-4 h-4');

export function Corazon({ className = 'w-5 h-5', lleno = true }: { className?: string; lleno?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.1 5.3 3 1.8-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z"
        fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Pestañas con píldora animada ---------- */
export function Segmented<T extends string>({ id, value, onChange, options, className = '' }: {
  id: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; className?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} data-active={value === k} onClick={() => onChange(k)} className="segmented-item">
          {value === k && <motion.span layoutId={id} className="segmented-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Encabezado de página ---------- */
export function Encabezado({ eyebrow, titulo, children }: { eyebrow?: string; titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-2">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[2rem] leading-[1.1] font-bold text-bosque-oscuro">{titulo}</h1>
      </div>
      {children}
    </header>
  );
}

/* ---------- Estado vacío con ballenita ---------- */
export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <Ballena className="w-28 mb-3 opacity-90" color="#5E8571" panza="#EAF5ED" />
      <p className="font-titulo text-lg font-semibold text-bosque-oscuro">{titulo}</p>
      {texto && <p className="text-sm text-salvia mt-1 max-w-xs">{texto}</p>}
      {children}
    </div>
  );
}

/* ---------- Número que cuenta hacia arriba ---------- */
export function Contador({ valor, duracion = 1100 }: { valor: number; duracion?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(valor); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duracion);
      setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valor, duracion]);
  return <>{n.toLocaleString('es-CO')}</>;
}

/* ---------- Pantalla de carga ---------- */
export function Cargando() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <Ballena className="w-32" />
      <p className="eyebrow">Nadando hacia ti…</p>
    </div>
  );
}
