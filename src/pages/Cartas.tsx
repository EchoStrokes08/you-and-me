import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Encabezado, Segmented, Vacio, ColaBallena, Corazon, IconoCandado, IconoCarta, IconoCerrar, IconoFlecha, IconoLapiz, IconoMas, IconoMicro, SolapaSobre } from '../components/ui';
import { fechaBonita, fechaStr, hoy, diasEntre } from '../lib/utils';
import { useAvisos, sinConexion } from '../lib/avisos';
import { guardarAudioBorrador, leerAudioBorrador, subirAudio, type Audio } from '../lib/voz';
import { Grabadora, NotaDeVoz } from '../components/Voz';
import Capsulas from '../components/Capsulas';

const EMOJIS = ['💌', '💚', '🌙', '🌻', '🐋', '✨'];
const MOMENTOS = ['cuando estés triste', 'cuando me extrañes', 'cuando necesites reírte', 'cuando no puedas dormir', 'cuando estés feliz', 'después de una pelea'];

// Borrador en el teléfono: si el sistema cierra la app al cambiar de aplicación, la carta no se pierde
// (la nota de voz va aparte, en IndexedDB, con la misma clave). Al editar una carta, el borrador es de esa carta.
const BORRADOR = 'borrador-carta';
const claveBorrador = (id?: string) => (id ? `${BORRADOR}-${id}` : BORRADOR);
type Borrador = { abierta: boolean; emoji: string; titulo: string; contenido: string; tipo: 'fecha' | 'momento'; fecha: string; momento: string };
const leerBorrador = (clave = BORRADOR): Borrador | null => {
  try { return JSON.parse(localStorage.getItem(clave) ?? 'null'); } catch { return null; }
};
const guardarBorrador = (b: Borrador | null, clave = BORRADOR) => {
  try { if (b) localStorage.setItem(clave, JSON.stringify(b)); else localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
};

const cuandoSeAbre = (c: any) => {
  if (c.momento) return `Ábrela ${c.momento}`;
  const n = diasEntre(c.abrir_desde);
  if (n <= 0) return 'Ya se puede abrir';
  return `Se abre en ${n} ${n === 1 ? 'día' : 'días'} · ${fechaBonita(c.abrir_desde)}`;
};

export default function Cartas() {
  const { perfil } = useAuth();
  const { aviso, confirmar, revisar } = useAvisos();
  // ?tab=capsulas: desde las notificaciones de las cápsulas
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab = t === 'escritas' || t === 'capsulas' ? t : 'recibidas';
  const setTab = (v: 'recibidas' | 'escritas' | 'capsulas') => setParams(v === 'recibidas' ? {} : { tab: v }, { replace: true });
  const [recibidas, setRecibidas] = useState<any[]>([]);
  const [escritas, setEscritas] = useState<any[]>([]);
  const [pareja, setPareja] = useState<{ id: string; nombre: string } | null>(null);
  // Si la app se cerró con la carta a medias, se vuelve a abrir donde quedó
  const [escribiendo, setEscribiendo] = useState(() => leerBorrador()?.abierta ?? false);
  const [leyendo, setLeyendo] = useState<{ carta: any; primeraVez: boolean } | null>(null);
  // Carta propia que se está corrigiendo (solo mientras no la haya abierto)
  const [editando, setEditando] = useState<any>(null);

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
    if (c.abierta_en) { setLeyendo({ carta: c, primeraVez: false }); return; }
    const { data, error } = await supabase.rpc('abrir_carta', { p_id: c.id });
    if (error) { aviso(sinConexion() ? 'No hay conexión para abrir la carta 📡' : 'Esta carta todavía no se puede abrir 🔒', 'error'); return; }
    // La nota de voz solo llega en cartas_recibidas una vez abierta
    const { data: filas } = await supabase.rpc('cartas_recibidas');
    const abierta = (filas ?? []).find((x: any) => x.id === c.id);
    setLeyendo({ carta: { ...c, contenido: data, audio: abierta?.audio ?? null }, primeraVez: true });
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
      <Encabezado eyebrow="Para abrir después" titulo="Cartas">
        {tab !== 'capsulas' && <button onClick={() => setEscribiendo(true)} className="btn-icon" aria-label="Escribir carta"><IconoMas /></button>}
      </Encabezado>
      <Segmented id="tabs-cartas" value={tab} onChange={setTab}
        options={[['recibidas', porAbrir ? `Para mí (${porAbrir})` : 'Para mí'], ['escritas', 'Las que escribí'], ['capsulas', 'Cápsulas']] as const} />

      {tab === 'capsulas' ? (
        perfil && <Capsulas yo={perfil.id} />
      ) : tab === 'recibidas' ? (
        recibidas.length === 0 ? (
          <Vacio titulo="Aún no tienes cartas" texto={`Cuando ${pareja?.nombre ?? 'tu amor'} te escriba una, aparecerá aquí.`} />
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {recibidas.map((c) => <Sobre key={c.id} carta={c} onAbrir={() => abrir(c)} />)}
          </div>
        )
      ) : escritas.length === 0 ? (
        <Vacio titulo="No has escrito cartas" texto="Escribe una para un día especial o para un momento difícil.">
          <button onClick={() => setEscribiendo(true)} className="btn-primary mt-4">Escribir una carta</button>
        </Vacio>
      ) : (
        <div className="flex flex-col gap-3 stagger">
          {escritas.map((c) => (
            <div key={c.id} className="card p-0 flex items-center">
              {/* Las propias se pueden volver a leer siempre */}
              <button onClick={() => setLeyendo({ carta: c, primeraVez: false })} className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left">
                <span className="text-3xl" aria-hidden="true">{c.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-titulo text-lg font-semibold leading-tight">{c.titulo}{c.audio && <IconoMicro className="inline-block w-4 h-4 ml-1.5 -mt-0.5 text-salvia" />}</span>
                  <span className="block text-sm text-salvia first-letter:uppercase">
                    {c.abierta_en ? `Abierta el ${fechaBonita(fechaStr(new Date(c.abierta_en)))}` : cuandoSeAbre(c)}
                  </span>
                </span>
              </button>
              {!c.abierta_en && <button onClick={() => borrar(c)} className="chip px-3 text-sm text-coral shrink-0 mr-3">Borrar</button>}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {escribiendo && pareja && (
          <EscribirCarta para={pareja} onClose={() => setEscribiendo(false)} onSaved={() => { setEscribiendo(false); setTab('escritas'); cargar(); }} />
        )}
        {editando && pareja && (
          <EscribirCarta key={editando.id} para={pareja} editar={editando} onClose={() => setEditando(null)}
            onSaved={() => { setEditando(null); aviso('Carta actualizada 💌'); cargar(); }} />
        )}
        {leyendo && (
          <LeerCarta carta={leyendo.carta} primeraVez={leyendo.primeraVez} onClose={() => setLeyendo(null)}
            para={leyendo.carta.de === perfil?.id ? pareja?.nombre : undefined}
            onEditar={leyendo.carta.de === perfil?.id && !leyendo.carta.abierta_en ? () => { setEditando(leyendo.carta); setLeyendo(null); } : undefined} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Sobre({ carta: c, onAbrir }: { carta: any; onAbrir: () => void }) {
  const bloqueada = !c.disponible;
  const nueva = c.disponible && !c.abierta_en;
  // Ya leída: una fila tranquila. Sin abrir: un sobre con su sello (cerrado con candado si aún no es el día)
  if (c.abierta_en) {
    return (
      <motion.button whileTap={{ scale: 0.98 }} onClick={onAbrir} className="card p-4 flex items-center gap-3 text-left">
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-seleccion text-bosque flex items-center justify-center"><IconoCarta className="w-6 h-6" /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-titulo text-lg font-semibold leading-tight">{c.titulo}</span>
          <span className="block text-sm text-salvia">Toca para leerla otra vez</span>
        </span>
        <IconoFlecha className="w-4 h-4 text-salvia shrink-0" />
      </motion.button>
    );
  }
  return (
    <button onClick={bloqueada ? undefined : onAbrir} disabled={bloqueada} className="sobre" data-estado={nueva ? 'nueva' : 'bloqueada'}>
      <SolapaSobre estado={nueva ? 'nueva' : 'bloqueada'} />
      <span className="block font-titulo italic font-medium text-2xl leading-tight mt-4">{c.titulo}</span>
      <span className="flex items-center justify-between gap-3 mt-1">
        <span className="text-sm text-salvia first-letter:uppercase">{cuandoSeAbre(c)}</span>
        {nueva && <span className="btn-primary min-h-11 py-2 px-5 text-sm shrink-0">Abrir</span>}
      </span>
    </button>
  );
}

/* Escribir una carta nueva o, con `editar`, corregir una propia que todavía no se ha abierto */
function EscribirCarta({ para, editar, onClose, onSaved }: { para: { id: string; nombre: string }; editar?: any; onClose: () => void; onSaved: () => void }) {
  const { confirmar } = useAvisos();
  const clave = claveBorrador(editar?.id);
  const [inicial] = useState(() => leerBorrador(clave));
  // Al editar: lo que haya en el borrador de esa carta, si no, lo que ya estaba guardado
  const base = inicial ?? (editar ? {
    emoji: editar.emoji, titulo: editar.titulo, contenido: editar.contenido ?? '',
    tipo: editar.momento ? 'momento' : 'fecha', fecha: editar.abrir_desde ?? '', momento: editar.momento ?? MOMENTOS[0],
  } as Borrador : null);
  const [emoji, setEmoji] = useState(base?.emoji ?? EMOJIS[0]);
  const [titulo, setTitulo] = useState(base?.titulo ?? '');
  const [contenido, setContenido] = useState(base?.contenido ?? '');
  const [tipo, setTipo] = useState<'fecha' | 'momento'>(base?.tipo ?? 'fecha');
  const [fecha, setFecha] = useState(base?.fecha ?? '');
  const [momento, setMomento] = useState(base?.momento ?? MOMENTOS[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [audio, setAudio] = useState<Audio | null>(null);
  // La nota de voz que ya tenía la carta (al editar); null si se quitó
  const [audioGuardado, setAudioGuardado] = useState<string | null>(editar?.audio ?? null);
  // Cambia para reiniciar la grabadora al empezar de cero
  const [reinicio, setReinicio] = useState(0);

  // Se guarda con cada letra; solo si hay algo escrito o grabado (al editar, solo si algo cambió)
  useEffect(() => {
    const cambio = !editar || !!audio || audioGuardado !== (editar.audio ?? null) || emoji !== editar.emoji || titulo !== editar.titulo
      || contenido !== (editar.contenido ?? '') || tipo !== (editar.momento ? 'momento' : 'fecha')
      || (tipo === 'fecha' ? fecha !== (editar.abrir_desde ?? '') : momento !== editar.momento);
    if (editar && !cambio) guardarBorrador(null, clave);
    else if (titulo.trim() || contenido.trim() || audio) guardarBorrador({ abierta: !editar, emoji, titulo, contenido, tipo, fecha, momento }, clave);
  }, [emoji, titulo, contenido, tipo, fecha, momento, audio, audioGuardado, clave, editar]);

  // Al editar, si quedó una nota de voz nueva sin guardar, se muestra la grabadora para recuperarla
  useEffect(() => {
    if (editar) leerAudioBorrador(clave).then((a) => { if (a) setAudioGuardado(null); });
  }, [editar, clave]);

  // Al cerrar con la X el borrador se queda (por si fue sin querer), pero no se reabre solo
  const cerrar = () => {
    const b = leerBorrador(clave);
    if (b) guardarBorrador({ ...b, abierta: false }, clave);
    onClose();
  };

  const listo = titulo.trim() && (contenido.trim() || audio || audioGuardado) && (tipo === 'fecha' ? fecha : momento.trim());

  const guardar = async () => {
    setGuardando(true);
    setError('');
    // El id se crea aquí para guardar el audio en cartas/<id>/ antes de la carta
    const id = editar?.id ?? crypto.randomUUID();
    let ruta: string | null = null;
    if (audio) {
      ruta = await subirAudio(`cartas/${id}`, audio);
      if (!ruta) { setGuardando(false); setError('No pude subir la nota de voz 😢 Intenta de nuevo.'); return; }
    }
    const datos = {
      emoji, titulo: titulo.trim(), contenido: contenido.trim(), audio: ruta ?? audioGuardado,
      abrir_desde: tipo === 'fecha' ? fecha : null,
      momento: tipo === 'momento' ? momento.trim() : null,
    };
    let e: any = null;
    if (editar) {
      // Si cambia el día, el aviso de "ya puedes abrirla" se vuelve a mandar ese día
      const cambios = datos.abrir_desde !== editar.abrir_desde ? { ...datos, aviso_enviado: false } : datos;
      const r = await supabase.from('cartas').update(cambios).eq('id', id).select('id');
      e = r.error;
      // Sin filas: ella la abrió mientras tanto y ya no se puede cambiar
      if (!e && !r.data?.length) {
        if (ruta) await supabase.storage.from('adjuntos').remove([ruta]);
        setGuardando(false);
        setError(`${para.nombre} ya abrió esta carta: no se puede cambiar 💌`);
        return;
      }
    } else {
      e = (await supabase.from('cartas').insert({ id, para: para.id, ...datos })).error;
    }
    setGuardando(false);
    if (e) {
      if (ruta) await supabase.storage.from('adjuntos').remove([ruta]);
      setError(sinConexion() ? 'No hay conexión: la carta no se guardó 📡' : 'No pude guardar la carta 😢 Intenta de nuevo.');
      return;
    }
    // La nota de voz anterior ya no la usa nadie
    if (editar?.audio && editar.audio !== datos.audio) await supabase.storage.from('adjuntos').remove([editar.audio]);
    guardarBorrador(null, clave);
    await guardarAudioBorrador(clave, null);
    onSaved();
  };

  return (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4">
        <div className="sticky top-0 z-10 -mx-5 px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2 bg-crema flex items-center justify-between">
          <p className="font-bold text-salvia">Para {para.nombre}</p>
          <button onClick={cerrar} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <h2 className="text-[2.1rem] leading-[1.08] font-bold">{editar ? 'Corregir la carta' : 'Escribir una carta'}</h2>
        {editar && <p className="text-sm text-salvia -mt-2">{para.nombre} todavía no la abre: puedes cambiar lo que quieras</p>}
        {inicial && (titulo.trim() || contenido.trim() || audio) && (
          editar ? (
            <button onClick={async () => {
              if (!(await confirmar({ titulo: '¿Descartar los cambios?', texto: 'Vuelve a quedar como estaba guardada.', boton: 'Descartar', peligro: true }))) return;
              guardarBorrador(null, clave); await guardarAudioBorrador(clave, null);
              setEmoji(editar.emoji); setTitulo(editar.titulo); setContenido(editar.contenido ?? '');
              setTipo(editar.momento ? 'momento' : 'fecha'); setFecha(editar.abrir_desde ?? ''); setMomento(editar.momento ?? MOMENTOS[0]);
              setAudio(null); setAudioGuardado(editar.audio ?? null); setReinicio((n) => n + 1);
            }}
              className="min-h-11 text-sm text-salvia text-left -mt-2 underline underline-offset-4">Recuperé los cambios que no guardaste · descartarlos</button>
          ) : (
            <button onClick={async () => {
              if (!(await confirmar({ titulo: '¿Empezar de cero?', texto: 'Se borra lo que llevas escrito y grabado.', boton: 'Borrar', peligro: true }))) return;
              guardarBorrador(null); setTitulo(''); setContenido(''); setFecha('');
              await guardarAudioBorrador(BORRADOR, null); setAudio(null); setReinicio((n) => n + 1);
            }}
              className="min-h-11 text-sm text-salvia text-left -mt-2 underline underline-offset-4">Recuperé tu borrador · empezar de cero</button>
          )
        )}

        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Emoji de la carta">
          {EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} data-active={emoji === e} aria-pressed={emoji === e} className="chip text-2xl px-0">{e}</button>)}
        </div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (lo verá antes de abrirla)" aria-label="Título de la carta" className="input" />
        <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder={`Para ${para.nombre}…`} aria-label="Lo que le quieres decir" className="input min-h-56 font-titulo text-xl leading-relaxed" />
        {/* La nota de voz que ya tenía: se escucha y se puede quitar para grabar otra */}
        {audioGuardado && !audio ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-menta bg-tarjeta p-3">
            <p className="text-sm font-bold text-salvia flex items-center gap-1.5"><IconoMicro className="w-4 h-4" /> La nota de voz de la carta</p>
            <NotaDeVoz ruta={audioGuardado} />
            <button type="button" onClick={() => setAudioGuardado(null)} className="min-h-11 text-sm font-bold text-coral self-end">Quitar o grabar otra</button>
          </div>
        ) : (
          <Grabadora key={reinicio} borrador={clave} onCambio={setAudio} maxSegundos={180} etiqueta={editar?.audio ? 'Grabar una nota de voz nueva (opcional)' : 'Agregarle una nota de voz (opcional)'} />
        )}

        <p className="font-bold mt-1">¿Cuándo la puede abrir?</p>
        <Segmented id="tipo-carta" value={tipo} onChange={setTipo} options={[['fecha', 'Un día'], ['momento', 'Un momento']] as const} />
        {tipo === 'fecha' ? (
          <div className="flex flex-col gap-1">
            <input type="date" value={fecha} min={fechaStr(hoy())} onChange={(e) => setFecha(e.target.value)} aria-label="Día en que la puede abrir" className="input" />
            <p className="text-sm text-salvia flex items-start gap-2"><IconoCandado className="w-4 h-4 shrink-0 mt-0.5" /> No podrá leerla antes de ese día. Le llega un aviso esa mañana.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {MOMENTOS.map((m) => <button key={m} onClick={() => setMomento(m)} data-active={momento === m} className="chip">{m}</button>)}
            </div>
            <input value={momento} onChange={(e) => setMomento(e.target.value)} placeholder="o escribe el tuyo: cuando…" aria-label="Momento para abrirla" className="input" />
            <p className="text-sm text-salvia">La puede abrir cuando quiera; el título y el momento la invitan a esperar.</p>
          </div>
        )}

        {error && <p role="alert" className="text-sm font-bold text-coral">{error}</p>}
        <button onClick={guardar} disabled={!listo || guardando} className="btn-primary text-lg">{guardando ? 'Guardando…' : editar ? 'Guardar cambios' : 'Guardar carta'}</button>
      </div>
    </motion.div>
  );
}

/* Leer una carta. Con `para`, es una propia (se relee); con `onEditar`, todavía se puede corregir.
   La primera vez, el sello se suelta, la solapa se levanta y la hoja sale del sobre. */
function LeerCarta({ carta, primeraVez, para, onEditar, onClose }: { carta: any; primeraVez: boolean; para?: string; onEditar?: () => void; onClose: () => void }) {
  const sinMovimiento = useReducedMotion();
  const conApertura = primeraVez && !sinMovimiento;
  const suave = [0.16, 1, 0.3, 1] as const;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={carta.titulo}
      className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4 min-h-dvh">
        <div className="flex items-center justify-between min-h-12">
          <p className="font-bold text-salvia">{para ? `Tu carta para ${para}` : ''}</p>
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <div className="relative">
          {conApertura && (
            <motion.div aria-hidden="true" className="absolute inset-x-6 top-10 h-44 rounded-[1.75rem] bg-seleccion border-[1.5px] border-bosque overflow-hidden pointer-events-none"
              initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: 150 }} transition={{ duration: 0.7, delay: 1.05, ease: [0.7, 0, 0.84, 0] }}>
              <motion.svg viewBox="0 0 390 70" preserveAspectRatio="none" className="absolute inset-x-0 top-0 w-full h-[70px] text-bosque origin-top"
                initial={{ scaleY: 1 }} animate={{ scaleY: -0.5, opacity: 0 }} transition={{ duration: 0.45, delay: 0.55, ease: suave }}>
                <path d="M0 0C120 40 170 58 195 58S270 40 390 0" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </motion.svg>
              <motion.span className="absolute left-1/2 top-[30px] -ml-[25px] w-[50px] h-[50px] rounded-full bg-hondo text-lima flex items-center justify-center"
                initial={{ scale: 1, y: 0, rotate: 0 }} animate={{ scale: [1, 1.25, 0.6], y: [0, -6, 90], rotate: [0, -8, 50], opacity: [1, 1, 0] }} transition={{ duration: 0.75, delay: 0.15, ease: 'easeIn' }}>
                <ColaBallena className="w-6 h-6" />
              </motion.span>
            </motion.div>
          )}
          <motion.article initial={conApertura ? { y: 120, scale: 0.86, opacity: 0 } : false} animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, delay: conApertura ? 0.85 : 0, ease: suave }}
            className="card relative p-6">
            <p className="text-4xl" aria-hidden="true">{carta.emoji}</p>
            <h2 className="font-titulo italic font-medium text-[2.1rem] leading-[1.08] mt-3">{carta.titulo}</h2>
            <p className="text-sm text-salvia mt-2 first-letter:uppercase">
              {carta.momento ? `Para abrir ${carta.momento}` : `Para el ${fechaBonita(carta.abrir_desde)}`}
            </p>
            {carta.audio && <NotaDeVoz ruta={carta.audio} className="mt-5" />}
            {carta.contenido && <p className="font-titulo text-[1.2rem] leading-[1.65] whitespace-pre-wrap mt-5">{carta.contenido}</p>}
          </motion.article>
        </div>
        {para && (
          <p className="text-sm text-salvia flex items-center justify-center gap-1.5">
            {carta.abierta_en ? `${para} la abrió el ${fechaBonita(fechaStr(new Date(carta.abierta_en)))}` : <><IconoCandado className="w-4 h-4" /> {para} todavía no la abre</>}
          </p>
        )}
        <div className="flex flex-col gap-2 mt-auto">
          {onEditar && <button onClick={onEditar} className="btn-primary"><IconoLapiz className="w-4 h-4" /> Corregir la carta</button>}
          <button onClick={onClose} className="btn-soft">{para ? 'Cerrar' : <>Guardarla en mi corazón <Corazon className="w-5 h-5" /></>}</button>
        </div>
      </div>
    </motion.div>
  );
}
