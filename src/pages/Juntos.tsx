import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import HeartRain from '../components/HeartRain';
import Cancion from '../components/Cancion';
import { tituloDelLink } from '../lib/musica';
import { Encabezado, Segmented, Vacio, IconoCheck } from '../components/ui';
import { fechaBonita, fechaStr, hoy } from '../lib/utils';
import { useAvisos } from '../lib/avisos';

const EMOJIS_SUENO = ['✨', '✈️', '🏔️', '🌊', '🍽️', '🎭', '🏡', '🐋'];

export default function Juntos() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab = t === 'regalos' || t === 'canciones' ? t : 'suenos';
  const [pareja, setPareja] = useState('');

  useEffect(() => {
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single()
      .then(({ data }) => setPareja((perfil?.rol === 'admin' ? data?.nombre_ella : data?.nombre_el) ?? 'mi amor'));
  }, [perfil]);

  if (!perfil) return null;
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Planear juntos" titulo="Juntos ✨" />
      <Segmented id="tabs-juntos" value={tab} onChange={(t) => setParams(t === 'suenos' ? {} : { tab: t }, { replace: true })}
        options={[['suenos', 'Planes'], ['regalos', 'Regalos'], ['canciones', 'Canciones']] as const} />
      {tab === 'suenos' && <Suenos yo={perfil.id} />}
      {tab === 'regalos' && <Regalos yo={perfil.id} pareja={pareja} />}
      {tab === 'canciones' && <Canciones yo={perfil.id} esAdmin={perfil.rol === 'admin'} />}
    </div>
  );
}

/* ---------- Cosas por hacer juntos ---------- */
function Suenos({ yo }: { yo: string }) {
  const { revisar, confirmar } = useAvisos();
  const navigate = useNavigate();
  const [suenos, setSuenos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS_SUENO[0]);
  const [celebrando, setCelebrando] = useState<any>(null);

  const cargar = async () => {
    const { data } = await supabase.from('suenos').select('*').order('cumplido_en', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false });
    setSuenos(data ?? []);
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!titulo.trim()) return;
    const { error } = revisar(await supabase.from('suenos').insert({ titulo: titulo.trim(), emoji }), 'No pude agregarlo');
    if (error) return;
    setTitulo('');
    cargar();
  };

  const cumplir = async (s: any) => {
    const { error } = revisar(await supabase.from('suenos').update({ cumplido_en: fechaStr(hoy()) }).eq('id', s.id), 'No pude marcarlo');
    if (error) return;
    setCelebrando(s);
    cargar();
  };

  const deshacer = async (s: any) => {
    revisar(await supabase.from('suenos').update({ cumplido_en: null }).eq('id', s.id), 'No pude deshacerlo');
    cargar();
  };

  const borrar = async (s: any) => {
    if (!(await confirmar({ titulo: `¿Borrar «${s.titulo}»?`, boton: 'Borrar', peligro: true }))) return;
    revisar(await supabase.from('suenos').delete().eq('id', s.id), 'No pude borrarlo');
    cargar();
  };

  // Abre "Nuevo recuerdo" en Historia con el título listo
  const guardarRecuerdo = (s: any) => navigate('/historia', { state: { sueno: { id: s.id, titulo: `${s.emoji} ${s.titulo}`, fecha: s.cumplido_en } } });

  const pendientes = suenos.filter((s) => !s.cumplido_en);
  const cumplidos = suenos.filter((s) => s.cumplido_en);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS_SUENO.map((e) => <button key={e} onClick={() => setEmoji(e)} data-active={emoji === e} className="chip text-xl px-2.5">{e}</button>)}
        </div>
        <div className="flex gap-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()}
            placeholder="Ver nevar, ir a Cartagena…" className="input flex-1" />
          <button onClick={agregar} disabled={!titulo.trim()} className="btn-primary px-4">Agregar</button>
        </div>
      </div>

      {suenos.length === 0 && <Vacio titulo="Su lista está vacía" texto="Anoten todo lo que quieren vivir juntos algún día." />}

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2 stagger">
          <p className="eyebrow">Por cumplir · {pendientes.length}</p>
          {pendientes.map((s) => (
            <div key={s.id} className="card p-3 flex items-center gap-3">
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => cumplir(s)} aria-label="Marcar como cumplido"
                className="w-9 h-9 shrink-0 rounded-full border-2 border-esmeralda/60 flex items-center justify-center text-transparent hover:text-esmeralda">
                <IconoCheck />
              </motion.button>
              <span className="text-2xl">{s.emoji}</span>
              <p className="flex-1 font-bold leading-tight">{s.titulo}</p>
              {s.creado_por === yo && <button onClick={() => borrar(s)} className="text-xs text-salvia font-bold">Borrar</button>}
            </div>
          ))}
        </div>
      )}

      {cumplidos.length > 0 && (
        <div className="flex flex-col gap-2 stagger">
          <p className="eyebrow mt-2">¡Cumplidos! · {cumplidos.length} 🎉</p>
          {cumplidos.map((s) => (
            <div key={s.id} className="card p-3 flex items-center gap-3 bg-seleccion border-menta">
              <span className="w-9 h-9 shrink-0 rounded-full bg-esmeralda text-white flex items-center justify-center"><IconoCheck /></span>
              <span className="text-2xl">{s.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{s.titulo}</p>
                <p className="text-xs text-salvia first-letter:uppercase">{fechaBonita(s.cumplido_en)}</p>
              </div>
              {s.recuerdo_id ? (
                <button onClick={() => navigate('/historia')} className="chip py-1 px-3 text-xs shrink-0">📸 Ver</button>
              ) : (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => guardarRecuerdo(s)} className="chip py-1 px-3 text-xs">📸 Recuerdo</button>
                  <button onClick={() => deshacer(s)} className="text-[11px] text-salvia font-bold">Deshacer</button>
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
              <p className="text-6xl">{celebrando.emoji}</p>
              <h2 className="text-3xl font-bold">¡Lo cumplimos! 🎉</h2>
              <p className="text-salvia font-semibold">{celebrando.titulo}</p>
              <button onClick={() => guardarRecuerdo({ ...celebrando, cumplido_en: fechaStr(hoy()) })} className="btn-primary mt-2">Guardarlo como recuerdo 📸</button>
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
  const [regalos, setRegalos] = useState<any[]>([]);
  const [comprados, setComprados] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState('');
  const [link, setLink] = useState('');
  const [nota, setNota] = useState('');

  const cargar = async () => {
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('regalos').select('*').order('me_encanta', { ascending: false }).order('created_at', { ascending: false }),
      // Solo devuelve los que YO compré: nunca veo si me compraron algo
      supabase.from('regalos_comprados').select('regalo_id'),
    ]);
    setRegalos(r ?? []);
    setComprados(new Set((c ?? []).map((x) => x.regalo_id)));
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nombre.trim()) return;
    const url = link.trim();
    const { error } = revisar(await supabase.from('regalos').insert({ nombre: nombre.trim(), link: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : null, nota: nota.trim() }), 'No pude agregarlo');
    if (error) return;
    setNombre(''); setLink(''); setNota('');
    cargar();
  };

  const alternarEncanta = async (g: any) => {
    revisar(await supabase.from('regalos').update({ me_encanta: !g.me_encanta }).eq('id', g.id), 'No pude cambiarlo');
    cargar();
  };

  const borrar = async (g: any) => {
    if (!(await confirmar({ titulo: `¿Quitar «${g.nombre}» de tu lista?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('regalos').delete().eq('id', g.id), 'No pude quitarlo');
    cargar();
  };

  const alternarComprado = async (g: any) => {
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
            <button onClick={agregar} disabled={!nombre.trim()} className="btn-primary">Agregar a mi lista 🎁</button>
            <p className="text-xs text-salvia text-center">🤫 Nunca vas a saber si {pareja} ya te compró algo.</p>
          </div>
          {mios.length === 0 ? <Vacio titulo="Tu lista está vacía" texto={`Anota lo que te gustaría para que ${pareja} tenga ideas.`} /> : (
            <div className="flex flex-col gap-2 stagger">
              {mios.map((g) => (
                <div key={g.id} className="card p-3 flex items-center gap-3">
                  <button onClick={() => alternarEncanta(g)} aria-label="Me encanta" className="text-2xl shrink-0">{g.me_encanta ? '💚' : '🤍'}</button>
                  <ItemRegalo g={g} />
                  <button onClick={() => borrar(g)} className="text-xs text-salvia font-bold shrink-0">Quitar</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : suyos.length === 0 ? (
        <Vacio titulo={`${pareja} no ha anotado nada`} texto="Cuando agregue algo te llegará un aviso 🎁" />
      ) : (
        <div className="flex flex-col gap-2 stagger">
          {suyos.map((g) => {
            const comprado = comprados.has(g.id);
            return (
              <div key={g.id} className={`card p-3 flex items-center gap-3 ${comprado ? 'bg-seleccion border-menta' : ''}`}>
                <span className="text-2xl shrink-0">{g.me_encanta ? '💚' : '🎁'}</span>
                <ItemRegalo g={g} />
                <button onClick={() => alternarComprado(g)} data-active={comprado} className="chip py-1 px-3 text-xs shrink-0">
                  {comprado ? '✓ Comprado 🤫' : 'Ya lo compré'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRegalo({ g }: { g: any }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="font-bold leading-tight">{g.nombre}</p>
      {g.nota && <p className="text-xs text-salvia">{g.nota}</p>}
      {g.link && <a href={g.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-bosque">Ver link →</a>}
    </div>
  );
}

/* ---------- Nuestras canciones ---------- */
function Canciones({ yo, esAdmin }: { yo: string; esAdmin: boolean }) {
  const { revisar, confirmar } = useAvisos();
  const [canciones, setCanciones] = useState<any[]>([]);
  const [recuerdos, setRecuerdos] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [nota, setNota] = useState('');
  const [recuerdoId, setRecuerdoId] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const { data } = await supabase.from('canciones').select('*, recuerdos(titulo)').order('created_at', { ascending: false });
    setCanciones(data ?? []);
  };
  useEffect(() => {
    cargar();
    supabase.from('recuerdos').select('id, titulo, fecha').order('fecha', { ascending: false }).then(({ data }) => setRecuerdos(data ?? []));
  }, []);

  // Al pegar el link, intentar llenar el título solo
  const alPegarLink = async (v: string) => {
    setUrl(v);
    if (titulo || !/^https?:\/\//.test(v)) return;
    const t = await tituloDelLink(v);
    if (t) setTitulo((actual) => actual || t);
  };

  const guardar = async () => {
    if (!titulo.trim()) return;
    setGuardando(true);
    const { error } = revisar(await supabase.from('canciones').insert({
      titulo: titulo.trim(), artista: artista.trim(), url: url.trim() || null, nota: nota.trim(), recuerdo_id: recuerdoId || null,
    }), 'No pude agregar la canción');
    setGuardando(false);
    if (error) return;
    setUrl(''); setTitulo(''); setArtista(''); setNota(''); setRecuerdoId(''); setAbierto(false);
    cargar();
  };

  const borrar = async (c: any) => {
    if (!(await confirmar({ titulo: `¿Quitar «${c.titulo}»?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('canciones').delete().eq('id', c.id), 'No pude quitarla');
    cargar();
  };

  return (
    <div className="flex flex-col gap-4">
      {abierto ? (
        <div className="card p-4 flex flex-col gap-2">
          <input value={url} onChange={(e) => alPegarLink(e.target.value)} placeholder="Link de Spotify o YouTube" className="input" inputMode="url" />
          <div className="grid grid-cols-2 gap-2">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Canción" className="input" />
            <input value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Artista" className="input" />
          </div>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Por qué es nuestra? (opcional)" className="input" />
          <select value={recuerdoId} onChange={(e) => setRecuerdoId(e.target.value)} className="input">
            <option value="">Sin recuerdo</option>
            {recuerdos.map((r) => <option key={r.id} value={r.id}>📸 {r.titulo}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setAbierto(false)} className="btn-soft">Cancelar</button>
            <button onClick={guardar} disabled={!titulo.trim() || guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Agregar 🎵'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAbierto(true)} className="btn-primary">Agregar una canción 🎵</button>
      )}

      {canciones.length === 0 ? (
        <Vacio titulo="Aún no tienen canciones" texto="La de su primera cita, la que siempre cantan en el carro… 🎶" />
      ) : (
        <div className="flex flex-col gap-2 stagger">
          {canciones.map((c) => (
            <Cancion key={c.id} c={c} acciones={(c.agregada_por === yo || esAdmin) && (
              <button onClick={() => borrar(c)} className="text-xs text-salvia font-bold shrink-0">Quitar</button>
            )} />
          ))}
        </div>
      )}
    </div>
  );
}
