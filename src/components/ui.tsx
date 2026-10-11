import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
// El resto del juego: mismo trazo, para no usar emojis como iconos
export const IconoCalendario = ({ className }: IconProps) => base(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></>, className);
export const IconoPregunta = ({ className }: IconProps) => base(<><path d="M20.5 12a8 8 0 0 1-11.8 7L4 20l1-4.5A8 8 0 1 1 20.5 12Z" /><path d="M9.8 9.8a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.6M12 16.5h.01" /></>, className);
export const IconoDeslizadores = ({ className }: IconProps) => base(<><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h.01" /><circle cx="16" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="18" cy="17" r="2" /></>, className);
export const IconoLista = ({ className }: IconProps) => base(<><path d="M5 6.5h14M5 12h14M5 17.5h8" /><path d="m16 17.5 2 2 3.5-4" /></>, className);
export const IconoRegalo = ({ className }: IconProps) => base(<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5-.5S12 7 12 7Zm0 0c2-4 6-3 5-.5S12 7 12 7Z" /></>, className);
export const IconoMusica = ({ className }: IconProps) => base(<><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>, className);
export const IconoCamara = ({ className }: IconProps) => base(<><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8.5 7 10 4.5h4L15.5 7" /></>, className);
export const IconoPin = ({ className }: IconProps) => base(<><path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.2 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>, className);
export const IconoMicro = ({ className }: IconProps) => base(<><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>, className);
export const IconoFuego = ({ className }: IconProps) => base(<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5Z" />, className);
export const IconoCandado = ({ className }: IconProps) => base(<><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" /></>, className);
export const IconoLapiz = ({ className }: IconProps) => base(<><path d="m4 20 1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19Z" /><path d="m14 6.5 3.5 3.5" /></>, className);
export const IconoCapsula = ({ className }: IconProps) => base(<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5.5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5.5-4 8.5s4 4.5 4 8.5" />, className);
export const IconoBasura = ({ className }: IconProps) => base(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-11M10 11v5M14 11v5" />, className);
export const IconoBuscar = ({ className }: IconProps) => base(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>, className);
export const IconoDestello = ({ className }: IconProps) => base(<path d="M12 3.5c.6 4.5 3.5 7.4 8 8.5-4.5 1.1-7.4 4-8 8.5-.6-4.5-3.5-7.4-8-8.5 4.5-1.1 7.4-4 8-8.5Z" />, className);
export const IconoDado = ({ className }: IconProps) => base(<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" /></>, className);
export const IconoPercha = ({ className }: IconProps) => base(<path d="M12 9V7.5a2 2 0 1 0-2-2M12 9l8.5 6.5c.8.6.4 2-.6 2H4.1c-1 0-1.4-1.4-.6-2Z" />, className);
export const IconoCampana = ({ className }: IconProps) => base(<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15ZM10 21h4" />, className);

/** Solapa y sello de un sobre. Va dentro de un elemento con la clase `sobre` */
export function SolapaSobre({ estado = 'nueva' }: { estado?: 'nueva' | 'bloqueada' | 'abierta' }) {
  return (
    <>
      <svg viewBox="0 0 390 70" preserveAspectRatio="none" className={`absolute inset-x-0 top-0 w-full h-[70px] ${estado === 'nueva' ? 'text-bosque' : 'text-menta'}`} aria-hidden="true">
        <path d="M0 0C120 40 170 58 195 58S270 40 390 0" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={`absolute left-1/2 top-[30px] -ml-[25px] w-[50px] h-[50px] rounded-full flex items-center justify-center ${estado === 'nueva' ? 'bg-hondo text-lima shadow-soft' : estado === 'bloqueada' ? 'bg-menta text-salvia' : 'bg-seleccion text-bosque border border-menta'}`} aria-hidden="true">
        {estado === 'bloqueada' ? <IconoCandado className="w-5 h-5" /> : <ColaBallena className="w-6 h-6" />}
      </span>
    </>
  );
}

/** Cola de ballena: la marca chiquita de la app (sellos, botones, detalles) */
export function ColaBallena({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
      <path d="M24 13C28 8 37 5 47 9C45 17 38 22 30 23C29 29 30 34 34 39L14 39C18 34 19 29 18 23C10 22 3 17 1 9C11 5 20 8 24 13Z" fill="currentColor" />
    </svg>
  );
}

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
      <div className="min-w-0">
        <h1 className="text-[2.25rem] leading-[1.05] font-bold text-bosque-oscuro">{titulo}</h1>
        {eyebrow && <p className="text-salvia mt-1">{eyebrow}</p>}
      </div>
      {children}
    </header>
  );
}

/* ---------- Estado vacío con ballenita ---------- */
export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <Ballena className="w-32 mb-3" />
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

/* ---------- Mientras llegan los datos ---------- */
export function Esqueleto({ className = 'h-20' }: { className?: string }) {
  return <div className={`esqueleto ${className}`} aria-hidden="true" />;
}

/* ---------- Hoja inferior ---------- */
export function Hoja({ abierta, onClose, titulo, children }: { abierta: boolean; onClose: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Escape la cierra y, al abrir, el foco entra a la hoja
  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); previo?.focus?.(); };
  }, [abierta, onClose]);

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-pino/55" />
          <motion.div ref={ref} tabIndex={-1} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            role="dialog" aria-modal="true" aria-label={titulo}
            className="relative w-full max-w-lg max-h-[88dvh] overflow-y-auto bg-crema rounded-t-[2rem] shadow-soft px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-5 outline-none">
            <span className="w-10 h-1.5 rounded-full bg-menta mx-auto shrink-0" />
            <div className="flex items-center gap-3">
              <h2 className="flex-1 text-2xl font-bold">{titulo}</h2>
              <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
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
