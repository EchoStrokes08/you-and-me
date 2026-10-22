type Props = { className?: string };
const icono = (trazo: React.ReactNode, className = 'w-6 h-6') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{trazo}</svg>
);

export const IconoCasa = ({ className }: Props) => icono(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5.5h4V20" /></>, className);
export const IconoCarta = ({ className }: Props) => icono(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>, className);
export const IconoFotos = ({ className }: Props) => icono(<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>, className);
export const IconoCalendario = ({ className }: Props) => icono(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></>, className);
export const IconoPregunta = ({ className }: Props) => icono(<><path d="M20.5 12a8 8 0 0 1-11.8 7L4 20l1-4.5A8 8 0 1 1 20.5 12Z" /><path d="M9.8 9.8a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.6M12 16.5h.01" /></>, className);

export function Corazon({ className = 'w-5 h-5', lleno = true }: { className?: string; lleno?: boolean }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.1 5.3 3 1.8-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
