import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IconoCasa, IconoCarta, IconoBurbuja, IconoFotos, IconoMapa, IconoAjustes } from './ui';

export default function BottomNav({ admin, pendientes }: { admin: boolean; pendientes: number }) {
  const tabs = [
    { to: '/', label: 'Inicio', Icono: IconoCasa },
    { to: '/citas', label: 'Citas', Icono: IconoCarta },
    { to: '/preguntas', label: 'Preguntas', Icono: IconoBurbuja },
    { to: '/historia', label: 'Historia', Icono: IconoFotos },
    { to: '/lugares', label: 'Lugares', Icono: IconoMapa },
    ...(admin ? [{ to: '/admin', label: 'Admin', Icono: IconoAjustes }] : []),
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pointer-events-none">
      <div className="glass pointer-events-auto max-w-lg mx-auto rounded-[28px] shadow-soft flex items-stretch justify-around h-[68px] px-1.5">
        {tabs.map(({ to, label, Icono }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-[22px] my-1.5">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-activo" className="absolute inset-0 rounded-[22px] bg-seleccion border border-menta" transition={{ type: 'spring', stiffness: 450, damping: 36 }} />
                )}
                <span className={`relative transition-colors ${isActive ? 'text-bosque' : 'text-salvia'}`}>
                  <Icono className="w-[22px] h-[22px]" />
                  {to === '/admin' && pendientes > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-alerta text-white text-[10px] font-extrabold rounded-full min-w-4 h-4 px-1 flex items-center justify-center ring-2 ring-white">{pendientes}</span>
                  )}
                </span>
                <span className={`relative ${tabs.length > 5 ? 'text-[10px]' : 'text-[11px]'} transition-colors ${isActive ? 'text-bosque font-extrabold' : 'text-salvia font-semibold'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
