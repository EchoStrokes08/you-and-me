import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IconoCasa, IconoCalendario, IconoPregunta, IconoFotos, IconoCarta } from './ui';

// Lugares vive dentro de Historia y el panel de admin se abre desde Ajustes
const tabs = [
  { to: '/', label: 'Inicio', Icono: IconoCasa },
  { to: '/citas', label: 'Citas', Icono: IconoCalendario },
  { to: '/preguntas', label: 'Preguntas', Icono: IconoPregunta },
  { to: '/historia', label: 'Historia', Icono: IconoFotos },
  { to: '/cartas', label: 'Cartas', Icono: IconoCarta },
];

export default function BottomNav() {
  return (
    <nav aria-label="Secciones" className="fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pointer-events-none">
      <div className="pointer-events-auto max-w-lg mx-auto rounded-[28px] bg-tarjeta border border-menta shadow-soft flex items-stretch justify-around h-[68px] px-1.5">
        {tabs.map(({ to, label, Icono }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-[22px] my-1.5">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-activo" className="absolute inset-0 rounded-[22px] bg-seleccion" transition={{ type: 'spring', stiffness: 450, damping: 36 }} />
                )}
                <Icono className={`relative w-[23px] h-[23px] ${isActive ? 'text-bosque' : 'text-salvia'}`} />
                <span className={`relative text-xs ${isActive ? 'text-bosque font-extrabold' : 'text-salvia font-bold'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
