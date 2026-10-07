import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import HeartRain from '../components/HeartRain';
import { Encabezado, Segmented, Vacio, IconoCerrar, IconoMas } from '../components/ui';
import { fechaBonita, fechaStr, hoy, diasEntre } from '../lib/utils';
import { useAvisos, sinConexion } from '../lib/avisos';

const EMOJIS = ['💌', '💚', '🌙', '🌻', '🐋', '✨'];
const MOMENTOS = ['cuando estés triste', 'cuando me extrañes', 'cuando necesites reírte', 'cuando no puedas dormir', 'cuando estés feliz', 'después de una pelea'];

const cuandoSeAbre = (c: any) => {
  if (c.momento) return `Ábrela ${c.momento}`;
  const n = diasEntre(c.abrir_desde);
  if (n <= 0) return 'Ya se puede abrir';
  return `Se abre en ${n} ${n === 1 ? 'día' : 'días'} · ${fechaBonita(c.abrir_desde)}`;
};

export default function Cartas() {
  const { perfil } = useAuth();
  const { aviso, confirmar, revisar } = useAvisos();
  const [tab, setTab] = useState<'recibidas' | 'escritas'>('recibidas');
  const [recibidas, setRecibidas] = useState<any[]>([]);
  const [escritas, setEscritas] = useState<any[]>([]);
  const [pareja, setPareja] = useState<{ id: string; nombre: string } | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [leyendo, setLeyendo] = useState<{ carta: any; primeraVez: boolean } | null>(null);

  const cargar = async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.rpc('cartas_recibidas'),
      supabase.from('cartas').select('*').order('created_at', { ascending: false }),
    ]);
    setRecibidas(r ?? []);
    setEscritas(e ?? []);
  };

  useEffect(() => {
    if (!perfil) return;
    cargar();
    Promise.all([
      supabase.from('perfiles').select('id').neq('id', perfil.id).limit(1).maybeSingle(),
      supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single(),
    ]).then(([{ data: p }, { data: c }]) => {
      if (p) setPareja({ id: p.id, nombre: (perfil.rol === 'admin' ? c?.nombre_ella : c?.nombre_el) ?? 'mi amor' });
    });
  }, [perfil]);

  const abrir = async (c: any) => {
    if (c.contenido) { setLeyendo({ carta: c, primeraVez: false }); return; }
    const { data, error } = await supabase.rpc('abrir_carta', { p_id: c.id });
    if (error) { aviso(sinConexion() ? 'No hay conexión para abrir la carta 📡' : 'Esta carta todavía no se puede abrir 🔒', 'error'); return; }
    setLeyendo({ carta: { ...c, contenido: data }, primeraVez: true });
    cargar();
  };

  const borrar = async (c: any) => {
    if (!(await confirmar({ titulo: `¿Borrar la carta «${c.titulo}»?`, texto: 'No se puede deshacer.', boton: 'Borrar', peligro: true }))) return;
    revisar(await supabase.from('cartas').delete().eq('id', c.id), 'No pude borrar la carta');
    cargar();
  };

  const porAbrir = recibidas.filter((c) => !c.abierta_en && c.disponible).length;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Para abrir después" titulo="Cartas 💌">
        <button onClick={() => setEscribiendo(true)} className="btn-icon" aria-label="Escribir carta"><IconoMas /></button>
      </Encabezado>
      <Segmented id="tabs-cartas" value={tab} onChange={setTab}
        options={[['recibidas', porAbrir ? `Para mí (${porAbrir})` : 'Para mí'], ['escritas', 'Las que escribí']] as const} />

      {tab === 'recibidas' ? (
        recibidas.length === 0 ? (
          <Vacio titulo="Aún no tienes cartas" texto={`Cuando ${pareja?.nombre ?? 'tu amor'} te escriba una, aparecerá aquí.`} />
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {recibidas.map((c) => <Sobre key={c.id} carta={c} onAbrir={() => abrir(c)} />)}
          </div>
        )
      ) : escritas.length === 0 ? (
        <Vacio titulo="No has escrito cartas" texto="Escribe una para un día especial o para un momento difícil.">
          <button onClick={() => setEscribiendo(true)} className="btn-primary mt-4">Escribir una carta 💌</button>
        </Vacio>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {escritas.map((c) => (
            <div key={c.id} className="card p-4 flex items-center gap-3">
              <span className="text-3xl">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{c.titulo}</p>
                <p className="text-xs text-salvia first-letter:uppercase">
                  {c.abierta_en ? `💚 Abierta el ${fechaBonita(fechaStr(new Date(c.abierta_en)))}` : cuandoSeAbre(c)}
                </p>
              </div>
              {!c.abierta_en && <button onClick={() => borrar(c)} className="chip py-1 px-3 text-xs shrink-0">Borrar</button>}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {escribiendo && pareja && (
          <EscribirCarta para={pareja} onClose={() => setEscribiendo(false)} onSaved={() => { setEscribiendo(false); setTab('escritas'); cargar(); }} />
        )}
        {leyendo && <LeerCarta carta={leyendo.carta} primeraVez={leyendo.primeraVez} onClose={() => setLeyendo(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Sobre({ carta: c, onAbrir }: { carta: any; onAbrir: () => void }) {
  const bloqueada = !c.disponible;
  const nueva = c.disponible && !c.abierta_en;
  return (
    <motion.button whileTap={bloqueada ? undefined : { scale: 0.97 }} onClick={bloqueada ? undefined : onAbrir} disabled={bloqueada}
      className={`card p-4 flex items-center gap-3 text-left border-2 ${nueva ? 'border-esmeralda bg-seleccion' : 'border-menta'} ${bloqueada ? 'opacity-80' : ''}`}>
      <motion.span className="w-14 h-14 shrink-0 rounded-2xl bg-crema border border-menta flex items-center justify-center text-3xl"
        animate={nueva ? { rotate: [0, -8, 8, -4, 0] } : {}} transition={nueva ? { repeat: Infinity, repeatDelay: 2.5, duration: 0.6 } : {}}>
        {bloqueada ? '🔒' : c.emoji}
      </motion.span>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{c.titulo}</p>
        <p className="text-xs text-salvia first-letter:uppercase">{c.abierta_en ? 'Toca para leerla otra vez' : cuandoSeAbre(c)}</p>
      </div>
      {nueva && <span className="badge bg-esmeralda text-white shrink-0">Abrir ✨</span>}
    </motion.button>
  );
}

function EscribirCarta({ para, onClose, onSaved }: { para: { id: string; nombre: string }; onClose: () => void; onSaved: () => void }) {
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState<'fecha' | 'momento'>('fecha');
  const [fecha, setFecha] = useState('');
  const [momento, setMomento] = useState(MOMENTOS[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const listo = titulo.trim() && contenido.trim() && (tipo === 'fecha' ? fecha : momento.trim());

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const { error: e } = await supabase.from('cartas').insert({
      para: para.id, emoji, titulo: titulo.trim(), contenido: contenido.trim(),
      abrir_desde: tipo === 'fecha' ? fecha : null,
      momento: tipo === 'momento' ? momento.trim() : null,
    });
    setGuardando(false);
    if (e) { setError('No pude guardar la carta 😢 Intenta de nuevo.'); return; }
    onSaved();
  };

  return (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4">
        <div className="sticky top-0 z-10 -mx-5 px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2 bg-crema/85 backdrop-blur-md flex items-center justify-between">
          <p className="eyebrow">Para {para.nombre}</p>
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <h2 className="text-[1.9rem] leading-tight font-bold text-center">Escribir una carta 💌</h2>

        <div className="flex justify-center gap-2">
          {EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} data-active={emoji === e} className="chip text-2xl px-3">{e}</button>)}
        </div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (lo verá antes de abrirla)" className="input" />
        <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder={`Para ${para.nombre}…`} className="input min-h-56 font-titulo text-lg leading-relaxed" />

        <p className="eyebrow mt-1">¿Cuándo la puede abrir?</p>
        <Segmented id="tipo-carta" value={tipo} onChange={setTipo} options={[['fecha', 'Un día'], ['momento', 'Un momento']] as const} />
        {tipo === 'fecha' ? (
          <div className="flex flex-col gap-1">
            <input type="date" value={fecha} min={fechaStr(hoy())} onChange={(e) => setFecha(e.target.value)} className="input" />
            <p className="text-xs text-salvia">🔒 No podrá leerla antes de ese día. Le llega un aviso esa mañana.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {MOMENTOS.map((m) => <button key={m} onClick={() => setMomento(m)} data-active={momento === m} className="chip">{m}</button>)}
            </div>
            <input value={momento} onChange={(e) => setMomento(e.target.value)} placeholder="o escribe el tuyo: cuando…" className="input" />
            <p className="text-xs text-salvia">La puede abrir cuando quiera; el título y el momento la invitan a esperar.</p>
          </div>
        )}

        {error && <p className="text-sm text-coral text-center">{error}</p>}
        <button onClick={guardar} disabled={!listo || guardando} className="btn-primary text-lg">{guardando ? 'Guardando…' : 'Guardar carta 💌'}</button>
      </div>
    </motion.div>
  );
}

function LeerCarta({ carta, primeraVez, onClose }: { carta: any; primeraVez: boolean; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      {primeraVez && <HeartRain />}
      <div className="max-w-lg mx-auto px-5 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4 min-h-dvh">
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <motion.div initial={{ y: 60, scale: 0.9, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18, delay: primeraVez ? 0.3 : 0 }}
          className="card p-6 border-2 border-menta">
          <p className="text-4xl text-center">{carta.emoji}</p>
          <h2 className="font-titulo text-2xl font-bold text-center mt-2">{carta.titulo}</h2>
          <p className="text-xs text-salvia text-center mt-1 first-letter:uppercase">
            {carta.momento ? `Para abrir ${carta.momento}` : `Para el ${fechaBonita(carta.abrir_desde)}`}
          </p>
          <p className="font-titulo text-lg leading-relaxed whitespace-pre-wrap mt-5">{carta.contenido}</p>
        </motion.div>
        <button onClick={onClose} className="btn-soft mt-auto">Guardarla en mi corazón 💚</button>
      </div>
    </motion.div>
  );
}
