// Pelis y series por ver juntos, con dónde salen (Netflix, Max, cine…); al verlas, cada uno califica por su lado.
// El dado escoge al azar entre las pendientes para resolver el "no sé qué ver hoy".
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { CalificacionPeli, Peli } from '../../lib/tipos';
import { useAvisos } from '../../lib/avisos';
import { fechaStr, hoy } from '../../lib/utils';
import { ChipsConMas, Esqueleto, IconoCerrar, IconoDado, IconoEstrella, IconoPeli, Segmented, Vacio } from '../ui';

const DONDE = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Cine', 'YouTube', 'Apple TV+', 'Crunchyroll', 'Paramount+'];

// Pelis y series por ver juntos. Al verla, cada uno la califica por su lado.
export default function Pelis({ yo, pareja, esAdmin }: { yo: string; pareja: string; esAdmin: boolean }) {
  const { revisar, confirmar } = useAvisos();
  const [pelis, setPelis] = useState<Peli[]>([]);
  const [notas, setNotas] = useState<CalificacionPeli[]>([]);
  const [cargado, setCargado] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'peli' | 'serie'>('peli');
  const [donde, setDonde] = useState('');
  const [sorteada, setSorteada] = useState<Peli | null>(null);

  const cargar = async () => {
    const [{ data: p }, { data: n }] = await Promise.all([
      supabase.from('pelis').select('*').order('vista_en', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }),
      supabase.from('pelis_calificacion').select('*'),
    ]);
    setPelis(p ?? []);
    setNotas(n ?? []);
    setCargado(true);
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!titulo.trim()) return;
    const { error } = revisar(await supabase.from('pelis').insert({ titulo: titulo.trim(), tipo, donde }), 'No pude agregarla');
    if (error) return;
    setTitulo(''); setDonde('');
    cargar();
  };

  const vista = async (p: Peli, si: boolean) => {
    revisar(await supabase.from('pelis').update({ vista_en: si ? fechaStr(hoy()) : null }).eq('id', p.id), 'No pude cambiarla');
    setSorteada(null);
    cargar();
  };

  const calificar = async (p: Peli, estrellas: number) => {
    revisar(await supabase.from('pelis_calificacion').upsert({ peli_id: p.id, usuario_id: yo, estrellas }), 'No pude guardar tu calificación');
    cargar();
  };

  const quitar = async (p: Peli) => {
    if (!(await confirmar({ titulo: `¿Quitar «${p.titulo}»?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('pelis').delete().eq('id', p.id), 'No pude quitarla');
    cargar();
  };

  const porVer = pelis.filter((p) => !p.vista_en);
  const vistas = pelis.filter((p) => p.vista_en);
  const nota = useMemo(() => (id: string, de: 'mia' | 'suya') => notas.find((n) => n.peli_id === id && (de === 'mia' ? n.usuario_id === yo : n.usuario_id !== yo))?.estrellas ?? 0, [notas, yo]);

  // Sin poder decidir: una al azar de las que faltan
  const sortear = () => setSorteada(porVer[Math.floor(Math.random() * porVer.length)]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-3">
        <Segmented id="tipo-peli" value={tipo} onChange={setTipo} options={[['peli', 'Peli'], ['serie', 'Serie']] as const} />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} maxLength={100}
          placeholder={tipo === 'peli' ? '¿Qué peli quieres ver?' : '¿Qué serie quieres ver?'} aria-label="Título" className="input" />
        <ChipsConMas opciones={DONDE} elegida={donde} onElegir={setDonde} visibles={5} etiqueta="¿Dónde está?" />
        <button onClick={agregar} disabled={!titulo.trim()} className="btn-primary">Agregar a la lista</button>
      </div>

      {porVer.length > 1 && (
        <button onClick={sortear} className="btn-soft"><IconoDado className="w-5 h-5" /> ¿Cuál vemos hoy?</button>
      )}

      {!cargado ? <Esqueleto className="h-24" /> : pelis.length === 0 ? (
        <Vacio titulo="Su lista de pelis está vacía" texto={`Anoten lo que quieren ver juntos y cuando no sepan qué poner, la app escoge.`} />
      ) : (
        <>
          {porVer.length > 0 && (
            <div className="flex flex-col gap-2 stagger">
              <h2 className="text-2xl font-bold">Por ver · {porVer.length}</h2>
              {porVer.map((p) => (
                <div key={p.id} className="card p-3 flex items-center gap-3">
                  <span className="w-11 h-11 shrink-0 rounded-2xl bg-seleccion text-bosque flex items-center justify-center"><IconoPeli className="w-6 h-6" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{p.titulo}</p>
                    <p className="text-sm text-salvia">{[p.tipo === 'serie' ? 'Serie' : 'Peli', p.donde, p.agregada_por === yo ? 'la anotaste tú' : `la anotó ${pareja}`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <button onClick={() => vista(p, true)} className="chip px-3 text-sm">La vimos</button>
                    {(p.agregada_por === yo || esAdmin) && <button onClick={() => quitar(p)} className="min-h-11 px-2 text-sm text-salvia font-bold">Quitar</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {vistas.length > 0 && (
            <div className="flex flex-col gap-2 stagger">
              <h2 className="text-2xl font-bold mt-2">Ya las vimos · {vistas.length}</h2>
              {vistas.map((p) => (
                <div key={p.id} className="card p-3 flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold leading-tight">{p.titulo}</p>
                      <p className="text-sm text-salvia">{[p.tipo === 'serie' ? 'Serie' : 'Peli', p.donde].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button onClick={() => vista(p, false)} className="min-h-11 px-2 text-sm text-salvia font-bold shrink-0">Deshacer</button>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Estrellas valor={nota(p.id, 'mia')} onCambio={(n) => calificar(p, n)} etiqueta="Tu nota" />
                    <p className="text-sm text-salvia flex items-center gap-1">
                      {pareja}: {nota(p.id, 'suya') ? <><b className="text-bosque">{nota(p.id, 'suya')}</b><IconoEstrella className="w-4 h-4 text-bosque" /></> : 'sin nota'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {sorteada && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-crema/95 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="La de hoy">
            <div className="max-w-sm w-full flex flex-col gap-3 text-center items-center">
              <motion.span initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="w-20 h-20 rounded-full bg-hondo text-lima flex items-center justify-center"><IconoPeli className="w-10 h-10" /></motion.span>
              <p className="eyebrow mt-2">Hoy vemos</p>
              <h2 className="text-3xl font-bold">{sorteada.titulo}</h2>
              {sorteada.donde && <p className="text-salvia font-semibold">En {sorteada.donde}</p>}
              <button onClick={() => vista(sorteada, true)} className="btn-primary w-full mt-2">¡Esa! Ya la vimos</button>
              <button onClick={sortear} className="btn-soft w-full"><IconoDado className="w-5 h-5" /> Otra</button>
              <button onClick={() => setSorteada(null)} className="btn-icon mt-1" aria-label="Cerrar"><IconoCerrar /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Estrellas({ valor, onCambio, etiqueta }: { valor: number; onCambio: (n: number) => void; etiqueta: string }) {
  return (
    <div className="flex items-center" role="group" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onCambio(n)} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`} aria-pressed={valor === n}
          className={`w-11 h-11 -mx-0.5 flex items-center justify-center ${n <= valor ? 'text-esmeralda' : 'text-menta'}`}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="currentColor" /></svg>
        </button>
      ))}
    </div>
  );
}
