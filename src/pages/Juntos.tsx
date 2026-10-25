// "Juntos" agrupa lo que se planea entre los dos: planes (sueños), cupones, pelis, regalos y
// canciones, cada pestaña en su componente. Llega desde el menú y desde las notificaciones
// con ?tab=… (también acepta ?tab=vales, nombre viejo). Solo lee; los widgets guardan.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { DatosCancion, Recuerdo, Regalo, Sueno } from '../lib/tipos';
import { useAuth } from '../context/AuthContext';
import HeartRain from '../components/ui/HeartRain';
import Cancion from '../components/juntos/Cancion';
import { buscarCanciones, datosDelLink, type Sugerencia } from '../lib/media/musica';
import { Encabezado, Esqueleto, Segmented, Vacio, IconoCalendario, IconoCheck, Corazon, IconoCamara, IconoFlecha, IconoLapiz, IconoMusica, IconoRegalo, IconoPlan } from '../components/ui';
import { NOMBRE_PLAN } from '../lib/planes';
import Cupones from '../components/juntos/Cupones';
import Pelis from '../components/juntos/Pelis';
import RetoDelMes from '../components/inicio/RetoDelMes';
import { fechaBonita, fechaStr, hoy } from '../lib/utils';
import { useAvisos } from '../lib/avisos';

const EMOJIS_SUENO = ['✨', '✈️', '🏔️', '🌊', '🍽️', '🎭', '🏡', '🐋'];
// Para cuándo es un regalo; sin ocasión es "cuando quieras"
const OCASIONES = ['cumpleaños', 'aniversario', 'Navidad', 'porque sí'];

export default function Juntos() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  // 'vales' era el nombre anterior de cupones (llega desde notificaciones viejas)
  const tab = t === 'vales' ? 'cupones' : t === 'cupones' || t === 'pelis' || t === 'regalos' || t === 'canciones' ? t : 'suenos';
  const [pareja, setPareja] = useState('');

  useEffect(() => {
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single()
      .then(({ data }) => setPareja((perfil?.rol === 'admin' ? data?.nombre_ella : data?.nombre_el) ?? 'mi amor'));
  }, [perfil]);

  if (!perfil) return null;
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Planear juntos" titulo="Juntos" />
      {/* Cinco pestañas: más apretadas para que quepan en 360 px sin esconder la última */}
      <Segmented id="tabs-juntos" className="[&_.segmented-item]:px-1 [&_.segmented-item]:text-[0.8rem]" value={tab} onChange={(t) => setParams(t === 'suenos' ? {} : { tab: t }, { replace: true })}
        options={[['suenos', 'Planes'], ['cupones', 'Cupones'], ['pelis', 'Pelis'], ['regalos', 'Regalos'], ['canciones', 'Canciones']] as const} />
      {tab === 'suenos' && <Suenos yo={perfil.id} pareja={pareja} />}
      {tab === 'cupones' && <Cupones yo={perfil.id} pareja={pareja} />}
      {tab === 'pelis' && <Pelis yo={perfil.id} pareja={pareja} esAdmin={perfil.esAdmin} />}
      {tab === 'regalos' && <Regalos yo={perfil.id} pareja={pareja} />}
      {tab === 'canciones' && <Canciones yo={perfil.id} esAdmin={perfil.esAdmin} />}
    </div>
  );
}

/* ---------- Cosas por hacer juntos ---------- */
function Suenos({ yo, pareja }: { yo: string; pareja: string }) {
  const { revisar, confirmar, pedirTexto } = useAvisos();
  const navigate = useNavigate();
  const [suenos, setSuenos] = useState<Sueno[]>([]);
  const [cargado, setCargado] = useState(false);
  // Un texto compartido desde otra app (share target) llega escrito como plan
  const [params] = useSearchParams();
  const [titulo, setTitulo] = useState(() => params.get('texto') ?? '');
  const [emoji, setEmoji] = useState(EMOJIS_SUENO[0]);
  const [celebrando, setCelebrando] = useState<Sueno | null>(null);

  const cargar = async () => {
    const { data } = await supabase.from('suenos').select('*').order('cumplido_en', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false });
    setSuenos(data ?? []);
    setCargado(true);
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!titulo.trim()) return;
    const { error } = revisar(await supabase.from('suenos').insert({ titulo: titulo.trim(), emoji }), 'No pude agregarlo');
    if (error) return;
    setTitulo('');
    cargar();
  };

  const cumplir = async (s: Sueno) => {
    const { error } = revisar(await supabase.from('suenos').update({ cumplido_en: fechaStr(hoy()) }).eq('id', s.id), 'No pude marcarlo');
    if (error) return;
    setCelebrando(s);
    cargar();
  };

  const deshacer = async (s: Sueno) => {
    revisar(await supabase.from('suenos').update({ cumplido_en: null }).eq('id', s.id), 'No pude deshacerlo');
    cargar();
  };

  const borrar = async (s: Sueno) => {
    if (!(await confirmar({ titulo: `¿Borrar «${s.titulo}»?`, boton: 'Borrar', peligro: true }))) return;
    revisar(await supabase.from('suenos').delete().eq('id', s.id), 'No pude borrarlo');
    cargar();
  };

  // Son de los dos: cualquiera corrige cómo quedó escrito
  const editar = async (s: Sueno) => {
    const nuevo = await pedirTexto({ titulo: 'Cambiar el plan', inicial: s.titulo, boton: 'Guardar' });
    if (nuevo === null || !nuevo.trim() || nuevo.trim() === s.titulo) return;
    revisar(await supabase.from('suenos').update({ titulo: nuevo.trim() }).eq('id', s.id), 'No pude cambiarlo');
    cargar();
  };

  // Abre el asistente de citas con este plan como idea
  const planear = (s: Sueno) => navigate('/citas', { state: { plan: { titulo: s.titulo, emoji: s.emoji } } });

  // Abre "Nuevo recuerdo" en Historia con el título listo
  const guardarRecuerdo = (s: Sueno) => navigate('/historia', { state: { sueno: { id: s.id, titulo: `${s.emoji} ${s.titulo}`, fecha: s.cumplido_en } } });

  const pendientes = suenos.filter((s) => !s.cumplido_en);
  const cumplidos = suenos.filter((s): s is Sueno & { cumplido_en: string } => !!s.cumplido_en);

  return (
    <div className="flex flex-col gap-4">
      <RetoDelMes />
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Tipo de plan">
          {EMOJIS_SUENO.map((e) => (
            <button key={e} onClick={() => setEmoji(e)} data-active={emoji === e} aria-pressed={emoji === e} aria-label={NOMBRE_PLAN[e]} title={NOMBRE_PLAN[e]} className="chip w-11 px-0">
              <IconoPlan emoji={e} className="w-5 h-5" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder="Ver nevar, ir a Cartagena…" aria-label="¿Qué quieren hacer juntos?" className="input flex-1 min-w-0" />
          <button onClick={agregar} disabled={!titulo.trim()} className="btn-primary px-4">Agregar</button>
        </div>
      </div>

      {!cargado && <Esqueleto className="h-24" />}
      {cargado && suenos.length === 0 && <Vacio titulo="Su lista está vacía" texto="Anoten todo lo que quieren vivir juntos algún día." />}

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2 stagger">
          <h2 className="text-2xl font-bold">Por cumplir · {pendientes.length}</h2>
          {pendientes.map((s) => (
            <div key={s.id} className="card p-3 flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => cumplir(s)} aria-label={`Marcar «${s.titulo}» como cumplido`}
                  className="w-11 h-11 shrink-0 rounded-full border-2 border-bosque flex items-center justify-center text-transparent active:text-bosque">
                  <IconoCheck />
                </motion.button>
                <span className="w-9 h-9 shrink-0 rounded-xl bg-seleccion text-bosque flex items-center justify-center"><IconoPlan emoji={s.emoji} className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-tight">{s.titulo}</p>
                  {/* Solo quien lo anotó lo puede borrar: así se entiende por qué a veces no sale "Borrar" */}
                  <p className="text-xs font-bold text-salvia mt-0.5">{s.creado_por === yo ? 'Lo anotaste tú' : `Lo anotó ${pareja}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 pl-14 text-sm font-bold">
                <button onClick={() => planear(s)} className="chip px-3 text-sm"><IconoCalendario className="w-4 h-4" /> Planear</button>
                <button onClick={() => editar(s)} className="min-h-11 px-2 text-bosque flex items-center gap-1.5 ml-auto"><IconoLapiz className="w-4 h-4" /> Editar</button>
                {s.creado_por === yo && <button onClick={() => borrar(s)} className="min-h-11 px-2 text-salvia">Borrar</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {cumplidos.length > 0 && (
        <div className="flex flex-col gap-2 stagger">
          <h2 className="text-2xl font-bold mt-2">Cumplidos · {cumplidos.length}</h2>
          {cumplidos.map((s) => (
            <div key={s.id} className="card p-3 flex items-center gap-3 bg-seleccion border-menta">
              <span className="w-9 h-9 shrink-0 rounded-full bg-esmeralda text-white flex items-center justify-center"><IconoCheck /></span>
              <span className="text-bosque shrink-0"><IconoPlan emoji={s.emoji} className="w-6 h-6" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{s.titulo}</p>
                <p className="text-sm text-salvia first-letter:uppercase">{fechaBonita(s.cumplido_en)}</p>
              </div>
              {s.recuerdo_id ? (
                <button onClick={() => navigate('/historia', { state: { abrir: s.recuerdo_id } })} className="chip px-3 text-sm shrink-0"><IconoCamara className="w-4 h-4" /> Ver</button>
              ) : (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => guardarRecuerdo(s)} className="chip px-3 text-sm"><IconoCamara className="w-4 h-4" /> Recuerdo</button>
                  <button onClick={() => deshacer(s)} className="min-h-11 px-2 text-sm text-salvia font-bold">Deshacer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {celebrando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-crema/95 z-50 flex items-center justify-center p-6">
            <HeartRain />
            <div className="max-w-sm w-full flex flex-col gap-3 text-center">
              <span className="w-20 h-20 mx-auto rounded-full bg-hondo text-lima flex items-center justify-center"><IconoPlan emoji={celebrando.emoji} className="w-10 h-10" /></span>
              <h2 className="text-3xl font-bold">¡Lo cumplimos!</h2>
              <p className="text-salvia font-semibold">{celebrando.titulo}</p>
              <button onClick={() => guardarRecuerdo({ ...celebrando, cumplido_en: fechaStr(hoy()) })} className="btn-primary mt-2">Guardarlo como recuerdo</button>
              <button onClick={() => setCelebrando(null)} className="btn-soft">Después</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Lista de regalos ---------- */
function Regalos({ yo, pareja }: { yo: string; pareja: string }) {
  const { revisar, confirmar } = useAvisos();
  const [vista, setVista] = useState<'mia' | 'suya'>('mia');
  const [regalos, setRegalos] = useState<Regalo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [comprados, setComprados] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState('');
  const [link, setLink] = useState('');
  const [nota, setNota] = useState('');
  const [ocasion, setOcasion] = useState('');

  const cargar = async () => {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('regalos').select('*').order('me_encanta', { ascending: false }).order('created_at', { ascending: false }),
      // Solo devuelve los que YO compré: nunca veo si me compraron algo
      supabase.from('regalos_comprados').select('regalo_id'),
    ]);
    setRegalos(r ?? []);
    setCargado(true);
    setComprados(new Set((c ?? []).map((x) => x.regalo_id)));
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nombre.trim()) return;
    const url = link.trim();
    const { error } = revisar(await supabase.from('regalos').insert({ nombre: nombre.trim(), link: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : null, nota: nota.trim(), ocasion: ocasion || null }), 'No pude agregarlo');
    if (error) return;
    setNombre(''); setLink(''); setNota(''); setOcasion('');
    cargar();
  };

  const alternarEncanta = async (g: Regalo) => {
    revisar(await supabase.from('regalos').update({ me_encanta: !g.me_encanta }).eq('id', g.id), 'No pude cambiarlo');
    cargar();
  };

  const borrar = async (g: Regalo) => {
    if (!(await confirmar({ titulo: `¿Quitar «${g.nombre}» de tu lista?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('regalos').delete().eq('id', g.id), 'No pude quitarlo');
    cargar();
  };

  const alternarComprado = async (g: Regalo) => {
    if (comprados.has(g.id)) revisar(await supabase.from('regalos_comprados').delete().eq('regalo_id', g.id), 'No pude cambiarlo');
    else revisar(await supabase.from('regalos_comprados').insert({ regalo_id: g.id }), 'No pude marcarlo');
    cargar();
  };

  const mios = regalos.filter((g) => g.de === yo);
  const suyos = regalos.filter((g) => g.de !== yo);

  return (
    <div className="flex flex-col gap-4">
      <Segmented id="vista-regalos" value={vista} onChange={setVista} options={[['mia', 'Mi lista'], ['suya', `Lista de ${pareja}`]] as const} />

      {vista === 'mia' ? (
        <>
          <div className="card p-4 flex flex-col gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="¿Qué te gustaría recibir?" className="input" />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (opcional)" className="input" inputMode="url" />
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Talla, color… (opcional)" className="input" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="¿Para cuándo?">
              {OCASIONES.map((o) => <button key={o} type="button" onClick={() => setOcasion(ocasion === o ? '' : o)} data-active={ocasion === o} aria-pressed={ocasion === o} className="chip text-sm">{o[0].toUpperCase() + o.slice(1)}</button>)}
            </div>
            <button onClick={agregar} disabled={!nombre.trim()} className="btn-primary">Agregar a mi lista</button>
            <p className="text-sm text-salvia">Nunca vas a saber si {pareja} ya te compró algo.</p>
          </div>
          {!cargado ? <Esqueleto className="h-20" /> : mios.length === 0 ? <Vacio titulo="Tu lista está vacía" texto={`Anota lo que te gustaría para que ${pareja} tenga ideas.`} /> : (
            <div className="flex flex-col gap-2 stagger">
              {mios.map((g) => (
                <div key={g.id} className="card p-3 flex items-center gap-3">
                  <button onClick={() => alternarEncanta(g)} aria-label="Me encanta" aria-pressed={!!g.me_encanta} className="w-11 h-11 flex items-center justify-center shrink-0 text-bosque"><Corazon className="w-7 h-7" lleno={!!g.me_encanta} /></button>
                  <ItemRegalo g={g} />
                  <button onClick={() => borrar(g)} className="min-h-11 min-w-11 px-2 text-sm text-salvia font-bold shrink-0">Quitar</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : !cargado ? (
        <Esqueleto className="h-20" />
      ) : suyos.length === 0 ? (
        <Vacio titulo={`${pareja} no ha anotado nada`} texto="Cuando agregue algo te llegará un aviso." />
      ) : (
        <div className="flex flex-col gap-2 stagger">
          {suyos.map((g) => {
            const comprado = comprados.has(g.id);
            return (
              <div key={g.id} className={`card p-3 flex items-center gap-3 ${comprado ? 'bg-seleccion border-menta' : ''}`}>
                <span className="w-11 h-11 shrink-0 rounded-2xl bg-seleccion text-bosque flex items-center justify-center">{g.me_encanta ? <Corazon className="w-6 h-6" /> : <IconoRegalo className="w-6 h-6" />}</span>
                <ItemRegalo g={g} />
                <button onClick={() => alternarComprado(g)} data-active={comprado} className="chip px-3 text-sm shrink-0">
                  {comprado ? 'Comprado' : 'Ya lo compré'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRegalo({ g }: { g: Regalo }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="font-bold leading-tight">{g.nombre}</p>
      {g.ocasion && <span className="badge bg-durazno/30 text-coral mt-1">{g.ocasion === 'porque sí' ? 'Porque sí' : g.ocasion === 'Navidad' ? 'Para Navidad' : `Para el ${g.ocasion}`}</span>}
      {g.nota && <p className="text-sm text-salvia">{g.nota}</p>}
      {g.link && <a href={g.link} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 text-sm font-bold text-bosque">Ver link <IconoFlecha className="w-4 h-4 ml-1" /></a>}
    </div>
  );
}

/* ---------- Nuestras canciones ---------- */
function Canciones({ yo, esAdmin }: { yo: string; esAdmin: boolean }) {
  const { revisar, confirmar } = useAvisos();
  const [canciones, setCanciones] = useState<DatosCancion[]>([]);
  const [cargado, setCargado] = useState(false);
  const [recuerdos, setRecuerdos] = useState<Pick<Recuerdo, 'id' | 'titulo' | 'fecha'>[]>([]);
  // Un link de música compartido desde otra app (share target) abre el formulario con el link puesto
  const [params] = useSearchParams();
  const compartido = params.get('link');
  const [abierto, setAbierto] = useState(!!compartido);
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [nota, setNota] = useState('');
  const [recuerdoId, setRecuerdoId] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const { data } = await supabase.from('canciones').select('*, recuerdos(titulo)').order('created_at', { ascending: false });
    setCanciones(data ?? []);
    setCargado(true);
  };
  useEffect(() => {
    cargar();
    supabase.from('recuerdos').select('id, titulo, fecha').order('fecha', { ascending: false }).then(({ data }) => setRecuerdos(data ?? []));
  }, []);

  // Al pegar el link, llenar solos el título y el artista (sin pisar lo que ya se escribió)
  const alPegarLink = async (v: string) => {
    setUrl(v);
    if ((titulo && artista) || !/^https?:\/\//.test(v)) return;
    const d = await datosDelLink(v);
    setElegida(true);
    if (d.titulo) setTitulo((actual) => actual || d.titulo!);
    if (d.artista) setArtista((actual) => actual || d.artista!);
  };

  // El link compartido se lee una sola vez, al llegar
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (compartido) alPegarLink(compartido); }, []);

  // Mientras se escribe el nombre, sugerencias de Spotify (como las notas de Instagram)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  // Después de elegir una sugerencia o pegar un link no se vuelve a buscar hasta que se escriba otra vez
  const [elegida, setElegida] = useState(false);
  useEffect(() => {
    const q = titulo.trim();
    if (elegida || q.length < 2) { setSugerencias([]); setBuscando(false); return; }
    const ctrl = new AbortController();
    setBuscando(true);
    const espera = setTimeout(async () => {
      const r = await buscarCanciones(q, ctrl.signal);
      if (!ctrl.signal.aborted) { setSugerencias(r); setBuscando(false); }
    }, 300);
    return () => { clearTimeout(espera); ctrl.abort(); };
  }, [titulo, elegida]);

  const elegir = (s: Sugerencia) => {
    setElegida(true);
    setTitulo(s.titulo); setArtista(s.artista); setUrl(s.url);
    setSugerencias([]);
  };

  const guardar = async () => {
    if (!titulo.trim()) return;
    setGuardando(true);
    const { error } = revisar(await supabase.from('canciones').insert({
      titulo: titulo.trim(), artista: artista.trim(), url: url.trim() || null, nota: nota.trim(), recuerdo_id: recuerdoId || null,
    }), 'No pude agregar la canción');
    setGuardando(false);
    if (error) return;
    setUrl(''); setTitulo(''); setArtista(''); setNota(''); setRecuerdoId(''); setAbierto(false); setElegida(false);
    cargar();
  };

  const borrar = async (c: DatosCancion) => {
    if (!(await confirmar({ titulo: `¿Quitar «${c.titulo}»?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('canciones').delete().eq('id', c.id), 'No pude quitarla');
    cargar();
  };

  return (
    <div className="flex flex-col gap-4">
      {abierto ? (
        <div className="card p-4 flex flex-col gap-2">
          <div className="relative">
            <input value={titulo} onChange={(e) => { setElegida(false); setTitulo(e.target.value); }} placeholder="Busca la canción…" aria-label="Busca la canción" className="input pr-10" autoComplete="off" />
            {buscando && <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-menta border-t-esmeralda animate-spin" aria-hidden="true" />}
          </div>
          {sugerencias.length > 0 && (
            <ul className="flex flex-col rounded-2xl border border-menta bg-tarjeta overflow-hidden divide-y divide-menta/70" aria-label="Sugerencias">
              {sugerencias.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => elegir(s)} className="w-full flex items-center gap-3 p-2 pr-3 text-left active:bg-seleccion">
                    {s.portada
                      ? <img src={s.portada} alt="" className="w-11 h-11 shrink-0 rounded-xl object-cover" loading="lazy" />
                      : <span className="w-11 h-11 shrink-0 rounded-xl bg-seleccion text-bosque flex items-center justify-center"><IconoMusica className="w-5 h-5" /></span>}
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-sm leading-tight truncate">{s.titulo}</span>
                      <span className="block text-sm text-salvia truncate">{s.artista}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Artista" className="input" />
          <input value={url} onChange={(e) => alPegarLink(e.target.value)} placeholder="Link de Spotify o YouTube (se llena solo al elegir)" className="input" inputMode="url" />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Por qué es nuestra? (opcional)" className="input" />
          <select value={recuerdoId} onChange={(e) => setRecuerdoId(e.target.value)} className="input">
            <option value="">Sin recuerdo</option>
            {recuerdos.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setAbierto(false)} className="btn-soft">Cancelar</button>
            <button onClick={guardar} disabled={!titulo.trim() || guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Agregar'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAbierto(true)} className="btn-primary"><IconoMusica className="w-5 h-5" /> Agregar una canción</button>
      )}

      {!cargado ? (
        <Esqueleto className="h-20" />
      ) : canciones.length === 0 ? (
        <Vacio titulo="Aún no tienen canciones" texto="La de su primera cita, la que siempre cantan en el carro…" />
      ) : (
        <div className="flex flex-col gap-2 stagger">
          {canciones.map((c) => (
            <Cancion key={c.id} c={c} acciones={(c.agregada_por === yo || esAdmin) && (
              <button onClick={() => borrar(c)} className="min-h-11 min-w-11 px-2 text-sm text-salvia font-bold shrink-0">Quitar</button>
            )} />
          ))}
        </div>
      )}
    </div>
  );
}
