import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AvisosCtx, sinConexion, type OpcionesDialogo, type OpcionesTexto } from '../lib/avisos';

/* Avisos cortos (toasts), diálogos de confirmación y de texto, y la franja de "sin conexión".
   Reemplazan alert/confirm/prompt, que en la app instalada se ven fuera de lugar. */

type Toast = { id: number; texto: string; tipo: 'ok' | 'error' };
type Dialogo = OpcionesTexto & { conTexto: boolean; resolver: (v: string | null) => void };
type Resultado = { error: { message?: string; code?: string } | null };

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [enLinea, setEnLinea] = useState(() => !sinConexion());
  const sig = useRef(0);

  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const aviso = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
    const id = ++sig.current;
    setToasts((t) => [...t.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'error' ? 4500 : 2600);
  }, []);

  const revisar = useCallback(<T extends Resultado>(res: T, mensaje: string): T => {
    if (res.error) {
      console.error(mensaje, res.error);
      aviso(sinConexion() ? `${mensaje}: no hay conexión 📡` : `${mensaje} 😢 Intenta de nuevo.`, 'error');
    }
    return res;
  }, [aviso]);

  const abrir = useCallback((o: OpcionesTexto, conTexto: boolean) =>
    new Promise<string | null>((resolver) => setDialogo({ ...o, conTexto, resolver })), []);

  const confirmar = useCallback(async (o: OpcionesDialogo) => (await abrir(o, false)) !== null, [abrir]);
  const pedirTexto = useCallback((o: OpcionesTexto) => abrir(o, true), [abrir]);

  const cerrar = (v: string | null) => { dialogo?.resolver(v); setDialogo(null); };

  return (
    <AvisosCtx.Provider value={{ aviso, confirmar, pedirTexto, revisar }}>
      {children}
      {createPortal(
        <>
          <AnimatePresence>
            {!enLinea && (
              <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
                className="fixed top-0 inset-x-0 z-[70] flex justify-center px-4 pt-[max(env(safe-area-inset-top),8px)] pointer-events-none">
                <p className="badge bg-pino text-white shadow-soft py-2 px-4">📡 Sin conexión: lo que hagas no se guardará</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.p key={t.id} layout initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  role={t.tipo === 'error' ? 'alert' : 'status'}
                  className={`max-w-sm rounded-2xl px-4 py-3 text-sm font-bold shadow-soft text-center ${t.tipo === 'error' ? 'bg-alerta text-white' : 'bg-hondo text-white'}`}>
                  {t.texto}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {dialogo && <DialogoUI key="dialogo" d={dialogo} onCerrar={cerrar} />}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </AvisosCtx.Provider>
  );
}

function DialogoUI({ d, onCerrar }: { d: Dialogo; onCerrar: (v: string | null) => void }) {
  const [texto, setTexto] = useState(d.inicial ?? '');
  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-4 pb-[max(env(safe-area-inset-bottom),16px)]" role="dialog" aria-modal="true" aria-label={d.titulo}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => onCerrar(null)} className="absolute inset-0 bg-pino/40 backdrop-blur-[2px]" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full max-w-sm bg-crema rounded-[1.75rem] shadow-soft p-5 flex flex-col gap-3">
        <p className="font-titulo text-xl font-semibold leading-snug">{d.titulo}</p>
        {d.texto && <p className="text-sm text-salvia">{d.texto}</p>}
        {d.conTexto && (
          <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={d.placeholder} className="input min-h-20" />
        )}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={() => onCerrar(null)} className="btn-soft py-2.5">Volver</button>
          <button onClick={() => onCerrar(d.conTexto ? texto : '')}
            className={`btn-primary py-2.5 ${d.peligro ? 'bg-none bg-alerta shadow-none' : ''}`}>
            {d.boton ?? 'Aceptar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
