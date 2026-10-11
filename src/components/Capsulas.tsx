import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
import { comprimir } from '../lib/fotos';
import { subirAudio, type Audio } from '../lib/voz';
import { diasEntre, fechaBonita, fechaStr, hoy } from '../lib/utils';
import { Grabadora, NotaDeVoz } from './Voz';
import { Contador, Corazon, IconoCamara, IconoCandado, IconoCapsula, IconoCerrar, Segmented, Vacio } from './ui';

/* Cápsulas del tiempo: los dos guardan textos, fotos y notas de voz que el otro
   no puede ver hasta la fecha de apertura. Cada uno ve solo lo que guardó él. */

const EMOJIS = ['⏳', '💌', '🐋', '🌙', '🎁', '✨'];

const enMeses = (n: number) => { const d = hoy(); d.setMonth(d.getMonth() + n); return fechaStr(d); };

function proximoAniversario(inicio?: string) {
  if (!inicio) return null;
  const [a, m, d] = inicio.split('-').map(Number);
  const h = hoy();
  let f = new Date(h.getFullYear(), m - 1, d);
  if (f <= h) f = new Date(h.getFullYear() + 1, m - 1, d);
  return { fecha: fechaStr(f), anios: f.getFullYear() - a };
}

const vistaKey = (id: string) => `capsula-vista-${id}`;
const yaVista = (id: string) => { try { return localStorage.getItem(vistaKey(id)) === '1'; } catch { return false; } };
const marcarVista = (id: string) => { try { localStorage.setItem(vistaKey(id), '1'); } catch { /* sin almacenamiento: solo se repite la animación */ } };

export default function Capsulas({ yo }: { yo: string }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const [capsulas, setCapsulas] = useState<any[]>([]);
  const [conteo, setConteo] = useState<any[]>([]);
  const [mios, setMios] = useState<any[]>([]);
  const [nombres, setNombres] = useState<{ yo: string; pareja: string; inicio?: string }>({ yo: 'Tú', pareja: 'tu amor' });
  const [creando, setCreando] = useState(false);
  const [agregando, setAgregando] = useState<any>(null);
  const [abierta, setAbierta] = useState<any>(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: k }, { data: c }, { data: i }] = await Promise.all([
      supabase.from('capsulas').select('*').order('abrir_en'),
      supabase.rpc('capsulas_conteo'),
      supabase.from('capsula_items').select('*').eq('de', yo).order('created_at'),
    ]);
    setCapsulas(k ?? []);
    setConteo(c ?? []);
    setMios(i ?? []);
    setCargado(true);
  }, [yo]);

  useEffect(() => {
    cargar();
    Promise.all([
      supabase.from('perfiles').select('id, rol'),
      supabase.from('configuracion').select('nombre_ella, nombre_el, fecha_inicio').eq('id', 1).single(),
    ]).then(([{ data: ps }, { data: cfg }]) => {
      const rolYo = ps?.find((p) => p.id === yo)?.rol;
      setNombres({
        yo: (rolYo === 'admin' ? cfg?.nombre_el : cfg?.nombre_ella) ?? 'Tú',
        pareja: (rolYo === 'admin' ? cfg?.nombre_ella : cfg?.nombre_el) ?? 'tu amor',
        inicio: cfg?.fecha_inicio,
      });
    });
  }, [cargar, yo]);

  const cuantos = (id: string, mio: boolean) => conteo.filter((c) => c.capsula_id === id && (c.de === yo) === mio).reduce((n, c) => n + c.cantidad, 0);

  const borrarCapsula = async (k: any) => {
    if (!(await confirmar({ titulo: `¿Borrar «${k.titulo}»?`, texto: 'Se borra con todo lo que guardaste. No se puede deshacer.', boton: 'Borrar', peligro: true }))) return;
    const rutas = mios.filter((i) => i.capsula_id === k.id && i.ruta).map((i) => i.ruta);
    const { data, error } = revisar(await supabase.from('capsulas').delete().eq('id', k.id).select('id'), 'No pude borrar la cápsula');
    if (error) return;
    if (!data?.length) { aviso(`${nombres.pareja} ya guardó algo: la cápsula ya no se puede borrar 💚`, 'error'); return; }
    if (rutas.length) await supabase.storage.from('adjuntos').remove(rutas);
    aviso('Cápsula borrada');
    cargar();
  };

  const borrarItem = async (i: any) => {
    if (!(await confirmar({ titulo: '¿Sacar esto de la cápsula?', boton: 'Sacar', peligro: true }))) return;
    const { error } = revisar(await supabase.from('capsula_items').delete().eq('id', i.id), 'No pude sacarlo');
    if (error) return;
    if (i.ruta) await supabase.storage.from('adjuntos').remove([i.ruta]);
    cargar();
  };

  const selladas = capsulas.filter((k) => diasEntre(k.abrir_en) > 0);
  const abiertas = capsulas.filter((k) => diasEntre(k.abrir_en) <= 0).reverse();

  return (
    <div className="flex flex-col gap-4">
      {creando ? (
        <NuevaCapsula inicio={nombres.inicio} onCancelar={() => setCreando(false)} onCreada={(k) => { setCreando(false); cargar(); setAgregando(k); }} />
      ) : (
        <button onClick={() => setCreando(true)} className="btn-primary"><IconoCapsula className="w-5 h-5" /> Crear una cápsula del tiempo</button>
      )}

      {cargado && capsulas.length === 0 && !creando && (
        <Vacio titulo="Aún no tienen cápsulas" texto={`Guarden fotos, mensajes y notas de voz para abrirlos juntos en el futuro. ${nombres.pareja} no verá lo tuyo hasta ese día.`} />
      )}

      {abiertas.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Ya se pueden abrir</h2>
          {abiertas.map((k) => (
            <motion.button key={k.id} whileTap={{ scale: 0.97 }} onClick={() => setAbierta(k)}
              className={`card p-4 flex items-center gap-3 text-left ${yaVista(k.id) ? '' : 'border-[1.5px] border-bosque bg-seleccion'}`}>
              <span className="w-14 h-14 shrink-0 rounded-full bg-crema border border-menta flex items-center justify-center text-3xl" aria-hidden="true">{k.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-titulo text-lg font-semibold leading-tight">{k.titulo}</p>
                <p className="text-sm text-salvia first-letter:uppercase">Se abrió el {fechaBonita(k.abrir_en)} · {cuantos(k.id, true) + cuantos(k.id, false)} cosas</p>
              </div>
              {!yaVista(k.id) && <span className="btn-primary min-h-11 py-2 px-5 text-sm shrink-0">Abrir</span>}
            </motion.button>
          ))}
        </div>
      )}

      {selladas.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Selladas</h2>
          {selladas.map((k) => {
            const faltan = diasEntre(k.abrir_en);
            const misItems = mios.filter((i) => i.capsula_id === k.id);
            return (
              <div key={k.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-14 h-14 shrink-0 rounded-full bg-crema border border-menta flex items-center justify-center text-3xl relative" aria-hidden="true">
                    {k.emoji}<span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-hondo text-white flex items-center justify-center"><IconoCandado className="w-3.5 h-3.5" /></span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-titulo text-lg font-semibold leading-tight">{k.titulo}</p>
                    <p className="text-sm text-salvia first-letter:uppercase">Se abre el {fechaBonita(k.abrir_en)}</p>
                    <p className="text-sm font-bold text-bosque">Faltan {faltan} {faltan === 1 ? 'día' : 'días'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-seleccion border border-menta py-2"><p className="font-titulo text-2xl font-bold text-bosque">{cuantos(k.id, true)}</p><p className="text-xs font-bold text-salvia">guardaste tú</p></div>
                  <div className="rounded-2xl bg-crema border border-menta py-2"><p className="font-titulo text-2xl font-bold text-bosque">{cuantos(k.id, false)}</p><p className="text-xs font-bold text-salvia">guardó {nombres.pareja}</p></div>
                </div>
                <button onClick={() => setAgregando(k)} className="btn-soft"><IconoCandado className="w-4 h-4" /> Guardar algo</button>
                {misItems.length > 0 && (
                  <details className="text-sm">
                    <summary className="font-bold text-bosque cursor-pointer min-h-11 flex items-center">Ver lo que guardé ({misItems.length})</summary>
                    <div className="flex flex-col gap-2 mt-2">
                      {misItems.map((i) => (
                        <div key={i.id} className="flex items-start gap-2 rounded-2xl bg-seleccion border border-menta p-2">
                          <div className="flex-1 min-w-0"><Item item={i} compacto /></div>
                          <button onClick={() => borrarItem(i)} className="min-h-11 min-w-11 text-sm font-bold text-coral shrink-0 px-2">Sacar</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {k.creada_por === yo && cuantos(k.id, false) === 0 && (
                  <button onClick={() => borrarCapsula(k)} className="min-h-11 px-2 -mr-2 text-sm font-bold text-salvia self-end">Borrar cápsula</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {agregando && <AgregarItem capsula={agregando} pareja={nombres.pareja} onClose={() => setAgregando(null)} onGuardado={cargar} />}
        {abierta && <AbrirCapsula capsula={abierta} yo={yo} nombres={nombres} onClose={() => { marcarVista(abierta.id); setAbierta(null); }} />}
      </AnimatePresence>
    </div>
  );
}

function NuevaCapsula({ inicio, onCancelar, onCreada }: { inicio?: string; onCancelar: () => void; onCreada: (k: any) => void }) {
  const { revisar } = useAvisos();
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const aniv = useMemo(() => proximoAniversario(inicio), [inicio]);
  const manana = useMemo(() => { const d = hoy(); d.setDate(d.getDate() + 1); return fechaStr(d); }, []);

  const opciones: [string, string][] = [
    ['En 6 meses', enMeses(6)],
    ['En 1 año', enMeses(12)],
    ...(aniv ? [[`Aniversario #${aniv.anios}`, aniv.fecha] as [string, string]] : []),
    ['En 5 años', enMeses(60)],
  ];

  const crear = async () => {
    if (!titulo.trim() || !fecha) return;
    setGuardando(true);
    const { data, error } = revisar(await supabase.from('capsulas').insert({ titulo: titulo.trim(), emoji, abrir_en: fecha }).select().single(), 'No pude crear la cápsula');
    setGuardando(false);
    if (!error && data) onCreada(data);
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-titulo text-xl font-semibold">Nueva cápsula</p>
        <button onClick={onCancelar} className="btn-icon" aria-label="Cerrar"><IconoCerrar className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-6 gap-2" role="group" aria-label="Emoji de la cápsula">
        {EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} data-active={emoji === e} aria-pressed={emoji === e} className="chip text-xl px-0">{e}</button>)}
      </div>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Para nosotros en un año…" aria-label="Nombre de la cápsula" className="input" />
      <p className="font-bold mt-1">¿Cuándo se abre?</p>
      <div className="flex flex-wrap gap-2">
        {opciones.map(([l, f]) => <button key={l} onClick={() => setFecha(f)} data-active={fecha === f} className="chip text-sm">{l}</button>)}
      </div>
      <input type="date" value={fecha} min={manana} onChange={(e) => setFecha(e.target.value)} aria-label="Día en que se abre" className="input" />
      {fecha && <p className="text-sm text-salvia">Nadie podrá ver lo del otro hasta el {fechaBonita(fecha)}. Ese día les llega un aviso a los dos.</p>}
      <button onClick={crear} disabled={!titulo.trim() || !fecha || guardando} className="btn-primary">{guardando ? 'Creando…' : 'Crear cápsula'}</button>
    </div>
  );
}

function AgregarItem({ capsula, pareja, onClose, onGuardado }: { capsula: any; pareja: string; onClose: () => void; onGuardado: () => void }) {
  const { revisar, aviso } = useAvisos();
  const [tipo, setTipo] = useState<'texto' | 'foto' | 'audio'>('texto');
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [audio, setAudio] = useState<Audio | null>(null);
  const [guardando, setGuardando] = useState(false);

  const listo = tipo === 'texto' ? !!texto.trim() : tipo === 'foto' ? fotos.length > 0 : !!audio;

  const guardar = async () => {
    setGuardando(true);
    const carpeta = `capsulas/${capsula.id}`;
    let ok = true;
    if (tipo === 'texto') {
      ok = !revisar(await supabase.from('capsula_items').insert({ capsula_id: capsula.id, tipo: 'texto', texto: texto.trim() }), 'No pude guardarlo').error;
    } else if (tipo === 'audio' && audio) {
      const ruta = await subirAudio(carpeta, audio);
      ok = !!ruta && !revisar(await supabase.from('capsula_items').insert({ capsula_id: capsula.id, tipo: 'audio', ruta }), 'No pude guardar la nota de voz').error;
      if (!ruta) aviso('No pude subir la nota de voz 😢', 'error');
    } else {
      let fallidas = 0;
      for (const f of fotos.slice(0, 10)) {
        const blob = await comprimir(f);
        const ruta = `${carpeta}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from('adjuntos').upload(ruta, blob, { contentType: blob.type || 'image/jpeg' });
        const ins = up.error ? up : await supabase.from('capsula_items').insert({ capsula_id: capsula.id, tipo: 'foto', ruta });
        if (ins.error) { fallidas++; if (!up.error) await supabase.storage.from('adjuntos').remove([ruta]); }
      }
      if (fallidas) aviso(`${fallidas} ${fallidas === 1 ? 'foto no se guardó' : 'fotos no se guardaron'} 😢`, 'error');
      ok = fallidas < fotos.length;
    }
    setGuardando(false);
    if (!ok) return;
    aviso(`Guardado en la cápsula 🔒 ${pareja} no lo verá hasta el ${fechaBonita(capsula.abrir_en)}`);
    onGuardado();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-pino/55" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-crema rounded-t-[2rem] shadow-soft p-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Guardar algo</h2>
            <p className="text-sm text-salvia">{capsula.emoji} {capsula.titulo}</p>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <Segmented id="tipo-item" value={tipo} onChange={setTipo} options={[['texto', 'Mensaje'], ['foto', 'Fotos'], ['audio', 'Voz']] as const} />
        {tipo === 'texto' && (
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Algo para nosotros del futuro…" aria-label="Mensaje para la cápsula" className="input min-h-40 font-titulo text-lg leading-relaxed" />
        )}
        {tipo === 'foto' && (
          <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-menta bg-seleccion/60 p-4 cursor-pointer">
            <IconoCamara className="w-6 h-6 text-bosque shrink-0" />
            <span className="flex-1">
              <span className="block font-bold text-bosque">{fotos.length ? `${fotos.length} foto${fotos.length > 1 ? 's' : ''} lista${fotos.length > 1 ? 's' : ''}` : 'Escoger fotos'}</span>
              <span className="block text-sm text-salvia">Hasta 10 a la vez</span>
            </span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFotos(Array.from(e.target.files ?? []))} />
          </label>
        )}
        {tipo === 'audio' && <Grabadora onCambio={setAudio} maxSegundos={180} etiqueta="Grabar un mensaje para el futuro" />}
        <p className="text-sm text-salvia first-letter:uppercase">{pareja} sabrá que guardaste algo, pero no qué, hasta el {fechaBonita(capsula.abrir_en)}.</p>
        <button onClick={guardar} disabled={!listo || guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar en la cápsula'}</button>
      </motion.div>
    </div>,
    document.body,
  );
}

function Item({ item, url, compacto = false }: { item: any; url?: string; compacto?: boolean }) {
  const [src, setSrc] = useState<string | null>(url ?? null);
  useEffect(() => {
    if (item.tipo !== 'foto' || url) return;
    supabase.storage.from('adjuntos').createSignedUrl(item.ruta, 3600).then(({ data }) => setSrc(data?.signedUrl ?? null));
  }, [item, url]);
  if (item.tipo === 'texto') return <p className={`whitespace-pre-wrap ${compacto ? 'text-sm line-clamp-3' : 'font-titulo text-lg leading-relaxed'}`}>{item.texto}</p>;
  if (item.tipo === 'audio') return <NotaDeVoz ruta={item.ruta} />;
  return src ? <img src={src} alt="" className={`rounded-2xl object-cover ${compacto ? 'w-20 h-20' : 'w-full max-h-[70vh]'}`} /> : <div className={`esqueleto ${compacto ? 'w-20 h-20' : 'w-full h-64'}`} />;
}

function AbrirCapsula({ capsula, yo, nombres, onClose }: { capsula: any; yo: string; nombres: { yo: string; pareja: string }; onClose: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [primeraVez] = useState(() => !yaVista(capsula.id));

  useEffect(() => {
    supabase.from('capsula_items').select('*').eq('capsula_id', capsula.id).order('created_at').then(async ({ data }) => {
      const lista = data ?? [];
      const rutas = lista.filter((i) => i.tipo === 'foto').map((i) => i.ruta);
      if (rutas.length) {
        const { data: firmadas } = await supabase.storage.from('adjuntos').createSignedUrls(rutas, 3600);
        setUrls(Object.fromEntries((firmadas ?? []).filter((f) => f.signedUrl).map((f) => [f.path, f.signedUrl])));
      }
      setItems(lista);
    });
  }, [capsula.id]);

  const sinMovimiento = useReducedMotion();
  const conApertura = primeraVez && !sinMovimiento;
  const [esperados] = useState(() => Math.max(0, Math.round((Date.now() - new Date(capsula.created_at).getTime()) / 86400000)));
  const suave = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={capsula.titulo} className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4 min-h-dvh">
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>
        <div>
          {/* El tiempo se cumplió: el reloj de arena se voltea */}
          <motion.span className="w-16 h-16 rounded-full bg-hondo text-lima flex items-center justify-center"
            initial={conApertura ? { rotate: 0 } : false} animate={{ rotate: 180 }} transition={{ duration: 1.1, delay: 0.2, ease: [0.7, 0, 0.3, 1] }}>
            <IconoCapsula className="w-8 h-8" />
          </motion.span>
          <h2 className="text-[2.1rem] leading-[1.08] font-bold mt-4">{capsula.emoji} {capsula.titulo}</h2>
          <p className="text-salvia mt-2">
            Esperó <b className="font-titulo text-2xl text-bosque tabular-nums">{conApertura ? <Contador valor={esperados} duracion={1400} /> : esperados.toLocaleString('es-CO')}</b> {esperados === 1 ? 'día' : 'días'}, desde el {fechaBonita(fechaStr(new Date(capsula.created_at)))}.
          </p>
        </div>
        {!items ? <div className="flex flex-col gap-3" aria-label="Abriendo la cápsula"><div className="esqueleto h-28" /><div className="esqueleto h-40" /></div> : items.length === 0 ? (
          <Vacio titulo="Estaba vacía" texto="Nadie alcanzó a guardar nada esta vez." />
        ) : items.map((i, n) => (
          // Lo tuyo a la izquierda, lo del otro a la derecha: se ve de quién es cada cosa
          <motion.div key={i.id} initial={conApertura ? { opacity: 0, y: 40, scale: 0.94 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: conApertura ? 1.5 + n * 0.22 : 0, ease: suave }}
            className={`card p-4 flex flex-col gap-2 w-[92%] ${i.de === yo ? 'self-start bg-seleccion' : 'self-end'}`}>
            <Item item={i} url={urls[i.ruta]} />
            <p className="text-sm font-bold text-salvia">{i.de === yo ? `${nombres.yo} (tú)` : nombres.pareja}, el {fechaBonita(fechaStr(new Date(i.created_at)))}</p>
          </motion.div>
        ))}
        <button onClick={onClose} className="btn-soft mt-auto">Guardarla en el corazón <Corazon className="w-5 h-5" /></button>
      </div>
    </motion.div>
  );
}
