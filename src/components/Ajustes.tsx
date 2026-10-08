import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import SelectorTema from './SelectorTema';
import { IconoCerrar } from './ui';

// Hoja de ajustes del inicio: lo que se usa poco y antes ocupaba tarjetas
export default function Ajustes({ abierto, onClose }: { abierto: boolean; onClose: () => void }) {
  const { salir } = useAuth();
  const { confirmar } = useAvisos();

  const cerrarSesion = async () => {
    if (await confirmar({ titulo: '¿Cerrar sesión en este celular?', texto: 'Dejarán de llegarte los avisos aquí.', boton: 'Cerrar sesión' })) await salir();
  };

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-pino/40 backdrop-blur-[2px]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            role="dialog" aria-modal="true" aria-label="Ajustes"
            className="relative w-full max-w-lg bg-crema rounded-t-[2rem] shadow-soft px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-5">
            <span className="w-10 h-1.5 rounded-full bg-menta mx-auto" />
            <div className="flex items-center gap-3">
              <h2 className="flex-1 text-2xl font-bold">Ajustes</h2>
              <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
            </div>
            <SelectorTema />
            <button onClick={cerrarSesion} className="btn-soft w-full text-coral">Cerrar sesión</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
