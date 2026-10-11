import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import HeartsProgress from './HeartsProgress';
import { FamiliaBallenas } from './Ballena';
import MapaLugar, { type LugarMapa } from './MapaLugar';
import { IconoAtras, IconoAdelante, IconoCalendario, IconoCerrar, IconoCheck, IconoDado, IconoDestello, IconoMapa, IconoPercha, IconoPin, IconoRegalo } from './ui';
import { useAvisos } from '../lib/avisos';
import { fechaStr, hoy, diasLabel, precioStr, fechaBonita } from '../lib/utils';

type Cat = any; type Lugar = any; type Act = any; type Franja = any; type Opcion = any;

export default function CitaWizard({ onClose }: { onClose: () => void }) {
  const { perfil } = useAuth();
  const { revisar } = useAvisos();
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<Cat[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [actividades, setActividades] = useState<Act[]>([]);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [detalles, setDetalles] = useState<Opcion[]>([]);
  const [vestimentas, setVestimentas] = useState<Opcion[]>([]);
  const [bloqueadas, setBloqueadas] = useState<Set<string>>(new Set());
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  const [categoria, setCategoria] = useState<Cat | null>(null);
  const [esSorpresaCita, setEsSorpresaCita] = useState(false);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [actividad, setActividad] = useState<Act | null>(null);
  const [sorpresaLugar, setSorpresaLugar] = useState(false);
  const [sorpresaActividad, setSorpresaActividad] = useState(false);
  const [fecha, setFecha] = useState<string>('');
  const [franjaId, setFranjaId] = useState<string>('');
  const [vestimentaId, setVestimaId] = useState<string>('');
  const [detallesSel, setDetallesSel] = useState<Opcion[]>([]);
  const [nota, setNota] = useState('');
  const [guardado, setGuardado] = useState<any>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  useEffect(() => {
    supabase.from('categorias_cita').select('*').eq('activo', true).order('orden').then(({ data }) => setCats(data ?? []));
    supabase.from('lugares').select('*').eq('activo', true).order('orden').then(({ data }) => setLugares(data ?? []));
    supabase.from('actividades').select('*').eq('activo', true).order('orden').then(({ data }) => setActividades(data ?? []));
    supabase.from('franjas').select('*').eq('activo', true).order('orden').then(({ data }) => setFranjas(data ?? []));
    supabase.from('opciones_llevar').select('*').eq('activo', true).order('orden').then(({ data }) => {
      const all = data ?? [];
      setDetalles(all.filter((o) => o.tipo === 'detalle'));
      setVestimentas(all.filter((o) => o.tipo === 'vestimenta'));
    });
    supabase.from('fechas_no_disponibles').select('fecha').then(({ data }) => setBloqueadas(new Set((data ?? []).map((d) => d.fecha))));
    supabase.from('lugar_actividad').select('*').then(({ data }) => setVinculos(data ?? []));
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
  }, []);

  const lugaresFiltrados = useMemo(() => categoria && !categoria.slug.includes('sorpresa')
    ? lugares.filter((l) => l.es_sorpresa || l.categorias?.includes(categoria.slug))
    : lugares, [lugares, categoria]);

  const actividadesFiltradas = useMemo(() => {
    if (!lugar) return actividades.filter((a) => a.es_comodin);
    // Lugar elegido en el mapa: no tiene vínculos en el catálogo, se ofrecen todas
    if (lugar.es_mapa) return actividades;
    const vinc = new Set(vinculos.filter((v) => v.lugar_id === lugar.id).map((v) => v.actividad_id));
    return actividades.filter((a) => a.es_comodin || a.es_sorpresa || vinc.has(a.id));
  }, [lugar, actividades, vinculos]);

  const totalPasos = esSorpresaCita ? 4 : (sorpresaLugar ? 5 : 6);
  const pasosVisibles: number[] = esSorpresaCita ? [1, 4, 5, 6] : sorpresaLugar ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const indicePaso = pasosVisibles.indexOf(step) + 1;

  const sigue = () => {
    const i = pasosVisibles.indexOf(step);
    setStep(pasosVisibles[i + 1]);
  };
  const atras = () => {
    const i = pasosVisibles.indexOf(step);
    if (i <= 0) { onClose(); return; }
    setStep(pasosVisibles[i - 1]);
  };

  const fechaBloqueada = (d: Date) => {
    const s = fechaStr(d);
    if (d < hoy()) return 'Ese día ya pasó 😢';
    if (d > new Date(hoy().getTime() + 60 * 86400000)) return 'Muy lejos 🌿';
    if (bloqueadas.has(s)) return 'Ese día no puedo 😢';
    if (actividad?.dias_permitidos && !actividad.dias_permitidos.includes(d.getDay()))
      return `Solo se puede ${diasLabel(actividad.dias_permitidos)} 🗓️`;
    return null;
  };

  const [enviando, setEnviando] = useState(false);
  const guardar = async () => {
    // Evita que un doble toque (o la red lenta) cree la cita dos veces
    if (!perfil || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase.from('citas').insert({
      creada_por: perfil.id,
      categoria_slug: esSorpresaCita ? null : categoria?.slug,
      lugar_id: esSorpresaCita || sorpresaLugar || lugar?.es_mapa ? null : lugar?.id,
      lugar_personalizado: !esSorpresaCita && lugar?.es_mapa ? lugar.nombre : null,
      lugar_direccion: !esSorpresaCita && lugar?.es_mapa ? lugar.direccion : null,
      lugar_lat: !esSorpresaCita && lugar?.es_mapa ? lugar.lat : null,
      lugar_lng: !esSorpresaCita && lugar?.es_mapa ? lugar.lng : null,
      actividad_id: esSorpresaCita || sorpresaActividad ? null : actividad?.id,
      fecha, franja_id: franjaId,
      vestimenta_id: vestimentaId || null,
      es_cita_sorpresa: esSorpresaCita,
      nota_ella: nota || null,
      estado: 'pendiente',
    }).select().single();
    revisar({ error }, 'No pude enviar la cita');
    if (!error && data) {
      if (detallesSel.length) revisar(await supabase.from('cita_detalles').insert(detallesSel.map((d) => ({ cita_id: data.id, opcion_id: d.id }))), 'La cita quedó, pero no pude guardar los detalles');
      setGuardado(data);
      setStep(7);
    } else setEnviando(false);
  };

  const resumenTxt = () => {
    const f = fechaBonita(fecha);
    const fr = franjas.find((x) => x.id === franjaId)?.nombre;
    const v = vestimentas.find((x) => x.id === vestimentaId)?.nombre;
    return `¡Tenemos cita! 💚\n${esSorpresaCita ? '🎁 Cita sorpresa' : `${categoria?.nombre} en ${lugar?.nombre}`}\n${!esSorpresaCita && lugar?.es_mapa ? `📍 https://www.google.com/maps/search/?api=1&query=${lugar.lat},${lugar.lng}\n` : ''}${actividad ? actividad.nombre + '\n' : ''}${f} · ${fr}${v ? '\nVestimenta: ' + v : ''}${nota ? '\nNota: ' + nota : ''}`;
  };

  const encabezado = (t: string, sub?: string) => (
    <div>
      <h2 className="text-[2.1rem] leading-[1.08] font-bold">{t}</h2>
      {sub && <p className="text-salvia mt-1">{sub}</p>}
    </div>
  );
  const subtitulo = (t: string) => <p className="eyebrow mt-1">{t}</p>;

  if (guardado && step === 7) {
    return (
      <div className="fixed inset-0 bg-crema z-50 overflow-y-auto">
        <div className="p-6 max-w-lg mx-auto flex flex-col gap-4 text-center min-h-dvh justify-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} className="w-56 mx-auto mb-2">
            <FamiliaBallenas />
          </motion.div>
          <h2 className="text-4xl font-bold">¡Cita agendada!</h2>
          <p className="text-salvia">Tu cita quedó <b className="text-bosque">pendiente</b>. {perfil?.rol === 'admin' ? 'Ella la acepta desde Citas 💚' : 'Yo la confirmo desde mi panel 💚'}</p>
          <a href={`https://wa.me/${perfil?.rol === 'admin' ? config?.whatsapp_ella : config?.whatsapp}?text=${encodeURIComponent(resumenTxt())}`} target="_blank" rel="noreferrer" className="btn-primary mt-2">Avisarle por WhatsApp</a>
          <button onClick={onClose} className="btn-soft">Volver</button>
        </div>
      </div>
    );
  }

  const deshabilitado = (step === 1 && !categoria && !esSorpresaCita) || (step === 2 && !lugar) || (step === 3 && !actividad && !sorpresaActividad) || (step === 4 && (!fecha || !franjaId));

  return (
    <div className="fixed inset-0 bg-crema z-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pb-5 flex flex-col gap-5 min-h-dvh">
        <div className="sticky top-0 z-10 -mx-5 px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2 bg-crema flex items-center gap-2">
          <button onClick={atras} className="btn-icon" aria-label="Atrás"><IconoAtras /></button>
          <div className="flex-1"><HeartsProgress paso={indicePaso} total={totalPasos} /></div>
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="flex flex-col gap-4">
            {step === 1 && (
              <>
                {encabezado('¿Qué plan te provoca?', 'Escoge el tipo de cita')}
                <div className="grid grid-cols-2 gap-3">
                  {cats.map((c) => <Tarjeta key={c.slug} item={c} selected={categoria?.slug === c.slug && !esSorpresaCita} onClick={() => { setCategoria(c); setEsSorpresaCita(false); setSorpresaLugar(false); setSorpresaActividad(false); }} />)}
                  <Tarjeta item={{ emoji: '🎁', nombre: 'Cita sorpresa', descripcion: 'Tú solo dime cuándo; yo me encargo del resto' }} selected={esSorpresaCita} onClick={() => { setEsSorpresaCita(true); setCategoria(null); }} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {encabezado("¿A dónde nos vamos ma vie?")}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setMapaAbierto(true)}
                  className={`text-left rounded-3xl p-4 border-2 flex items-center gap-3 transition-all ${lugar?.es_mapa ? 'border-esmeralda bg-seleccion' : 'border-dashed border-esmeralda/50 bg-tarjeta shadow-soft'}`}>
                  <span className="w-12 h-12 shrink-0 rounded-2xl bg-hondo text-white flex items-center justify-center"><IconoMapa className="w-6 h-6" /></span>
                  <span className="flex-1 min-w-0">
                    {lugar?.es_mapa ? (
                      <>
                        <span className="block font-extrabold truncate">{lugar.nombre}</span>
                        <span className="block text-sm text-salvia truncate">{lugar.direccion}</span>
                        <span className="block text-sm font-bold text-bosque">En el mapa · toca para cambiar</span>
                      </>
                    ) : (
                      <>
                        <span className="block font-extrabold">¿No está en la lista?</span>
                        <span className="block text-sm text-salvia">Búscalo o márcalo en el mapa</span>
                      </>
                    )}
                  </span>
                  {lugar?.es_mapa && <span className="w-6 h-6 shrink-0 rounded-full bg-esmeralda text-white flex items-center justify-center"><IconoCheck className="w-3.5 h-3.5" /></span>}
                </motion.button>
                <Ruleta opciones={lugaresFiltrados} onPick={(l) => { setLugar(l); if (l.es_sorpresa) { setSorpresaLugar(true); setSorpresaActividad(true); } else setSorpresaLugar(false); }} />
                <div className="grid grid-cols-2 gap-3">
                  {lugaresFiltrados.map((l) => (
                    <Tarjeta key={l.id} item={l} selected={lugar?.id === l.id} onClick={() => { setLugar(l); if (l.es_sorpresa) { setSorpresaLugar(true); setSorpresaActividad(true); } else { setSorpresaLugar(false); if (l.es_escapada) { const dc = franjas.find((f) => f.nombre === 'Día completo'); if (dc) setFranjaId(dc.id); } } }}
                      sub={<span className="text-xs font-semibold text-salvia block mt-1.5">{[l.zona, precioStr(l.precio), l.duracion].filter(Boolean).join(' · ')}</span>}
                      mapa={l.link_maps} />
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                {encabezado('¿Y qué hacemos allá?')}
                <Ruleta opciones={actividadesFiltradas} onPick={(a) => { setActividad(a); if (a.es_sorpresa) setSorpresaActividad(true); }} />
                <div className="grid grid-cols-2 gap-3">
                  {actividadesFiltradas.map((a) => (
                    <Tarjeta key={a.id} item={a} selected={actividad?.id === a.id} onClick={() => { setActividad(a); setSorpresaActividad(!!a.es_sorpresa); }}
                      sub={<span className="text-xs font-semibold text-salvia block mt-1.5">{precioStr(a.precio)}{a.dias_permitidos ? ` · ${diasLabel(a.dias_permitidos)}` : ''}{a.nota ? ` · ${a.nota}` : ''}</span>} />
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                {encabezado('¿Cuándo nos vemos?')}
                <Calendario onPick={(s: string) => setFecha(s)} fecha={fecha} fechaBloqueada={fechaBloqueada} />
                {subtitulo('Momento del día')}
                <div className="flex flex-wrap gap-2">
                  {franjas.map((f) => (
                    <button key={f.id} onClick={() => setFranjaId(f.id)} data-active={franjaId === f.id} className="chip">{f.emoji} {f.nombre} <span className="text-xs opacity-70">{f.horario}</span></button>
                  ))}
                </div>
              </>
            )}

            {step === 5 && (
              <>
                {encabezado('¿Qué te llevo?')}
                <div className="flex items-center justify-between">
                  {subtitulo('Un detalle para ti')}
                  <span className="badge bg-seleccion text-bosque">{detallesSel.length}/2</span>
                </div>
                <Ruleta opciones={detalles} onPick={(d) => setDetallesSel((prev) => prev.find((x) => x.id === d.id) ? prev : prev.length < 2 ? [...prev, d] : prev)} />
                <div className="grid grid-cols-2 gap-3">
                  {detalles.map((d) => {
                    const sel = detallesSel.some((x) => x.id === d.id);
                    return <Tarjeta key={d.id} item={d} selected={sel} onClick={() => setDetallesSel((prev) => sel ? prev.filter((x) => x.id !== d.id) : prev.length < 2 ? [...prev, d] : prev)} />;
                  })}
                </div>
                {subtitulo('¿Cómo nos vestimos?')}
                <div className="grid grid-cols-2 gap-3">
                  {vestimentas.map((v) => <Tarjeta key={v.id} item={v} selected={vestimentaId === v.id} onClick={() => setVestimaId(v.id)} />)}
                </div>
              </>
            )}

            {step === 6 && (
              <>
                {encabezado('Resumen', 'Toca cualquier línea para cambiarla')}
                <div className="card p-0 overflow-hidden">
                  <div className="card-hero rounded-none p-5">
                    <p className="font-titulo text-2xl font-bold">{esSorpresaCita ? 'Cita sorpresa' : `${categoria?.emoji} ${categoria?.nombre}`}</p>
                    <p className="text-sm font-bold">Nuestra cita</p>
                  </div>
                  <div className="divide-y divide-menta">
                    {([
                      [IconoPin, 'Lugar', sorpresaLugar ? 'Sorpresa' : lugar?.nombre, 2],
                      [IconoDestello, 'Actividad', sorpresaActividad ? 'Sorpresa' : actividad?.nombre, 3],
                      [IconoCalendario, 'Cuándo', `${fecha ? fechaBonita(fecha) : '—'} · ${franjas.find((f) => f.id === franjaId)?.nombre ?? '—'}`, 4],
                      [IconoPercha, 'Vestimenta', vestimentas.find((v) => v.id === vestimentaId)?.nombre ?? '—', 5],
                      [IconoRegalo, 'Detalles', detallesSel.map((d) => d.nombre).join(' · ') || '—', 5],
                    ] as const).map(([Icono, etiqueta, valor, paso]) => (
                      <button key={etiqueta} className="flex items-center gap-3 text-left w-full min-h-14 px-5 py-3 active:bg-seleccion transition-colors" onClick={() => setStep(paso)}>
                        <Icono className="w-5 h-5 text-bosque shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-salvia">{etiqueta}</span>
                          <span className="block font-semibold first-letter:uppercase truncate">{valor ?? '—'}</span>
                        </span>
                        <IconoAdelante className="w-4 h-4 text-salvia" />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Algo más que deba saber?" className="input min-h-24" />
                <button onClick={guardar} disabled={!fecha || !franjaId || enviando} className="btn-primary text-lg">{enviando ? 'Agendando…' : '¡Agendar cita!'}</button>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {mapaAbierto && (
            <MapaLugar
              inicial={lugar?.es_mapa ? (lugar as LugarMapa) : null}
              onClose={() => setMapaAbierto(false)}
              onPick={(l) => { setLugar({ id: 'mapa', emoji: '📍', es_mapa: true, ...l }); setSorpresaLugar(false); setSorpresaActividad(false); setActividad(null); setMapaAbierto(false); }}
            />
          )}
        </AnimatePresence>

        {step < 6 && (
          <div className="sticky bottom-0 mt-auto -mx-5 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-crema via-crema to-crema/0">
            <button onClick={sigue} disabled={deshabilitado} className="btn-primary w-full text-lg">Siguiente <IconoAdelante /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tarjeta({ item, selected, onClick, sub, mapa }: any) {
  return (
    <div className="relative flex">
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick} aria-pressed={selected}
      className={`relative flex-1 text-left rounded-3xl p-3 border-2 transition-colors duration-200 ${selected ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'}`}>
      {item.imagen_url
        ? <img src={item.imagen_url} alt="" className="w-full h-24 object-cover rounded-2xl mb-2" />
        : <div className="w-12 h-12 rounded-2xl bg-crema flex items-center justify-center text-2xl mb-2" aria-hidden="true">{item.emoji}</div>}
      <p className="font-extrabold leading-tight text-bosque-oscuro">{item.nombre}</p>
      {item.descripcion && <p className="text-sm text-salvia line-clamp-2 mt-0.5">{item.descripcion}</p>}
      {sub}
      <AnimatePresence>
        {selected && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-hondo text-white flex items-center justify-center">
            <IconoCheck className="w-3.5 h-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
    {/* Enlace al mapa del lugar: fuera del botón para que tenga su propia zona táctil */}
    {mapa && !selected && <a href={mapa} target="_blank" rel="noreferrer" aria-label={`Ver ${item.nombre} en el mapa`} className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center text-bosque"><IconoPin className="w-5 h-5" /></a>}
    </div>
  );
}

function Ruleta({ opciones, onPick }: { opciones: any[]; onPick: (o: any) => void }) {
  const [aleatorio, setAleatorio] = useState<any>(null);
  const [girando, setGirando] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <button disabled={girando} onClick={() => { setGirando(true); setTimeout(() => { const r = opciones[Math.floor(Math.random() * opciones.length)]; setAleatorio(r); onPick(r); setGirando(false); }, 900); }}
        className="chip bg-durazno/40 border-durazno text-bosque-oscuro font-extrabold px-5 active:scale-95">
        <motion.span animate={girando ? { rotate: 360 } : { rotate: 0 }} transition={girando ? { repeat: Infinity, duration: 0.5, ease: 'linear' } : {}}><IconoDado className="w-5 h-5" /></motion.span>
        {girando ? 'Girando…' : '¿No sabes? Ruleta'}
      </button>
      {aleatorio && <p className="text-sm text-center text-salvia">Salió <b className="text-bosque">{aleatorio.emoji} {aleatorio.nombre}</b>: tócala para aceptarla o gira de nuevo</p>}
    </div>
  );
}

export function Calendario({ onPick, fecha, fechaBloqueada, mesInicial }: { onPick: (s: string) => void; fecha: string; fechaBloqueada: (d: Date) => string | null; mesInicial?: string }) {
  const [base, setBase] = useState(() => { const h = mesInicial ? new Date(mesInicial + 'T00:00:00') : hoy(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const diasMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const inicioSemana = base.getDay();
  const hoyS = fechaStr(hoy());
  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-3">
        <button className="btn-icon" aria-label="Mes anterior" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))}><IconoAtras className="w-4 h-4" /></button>
        <p className="font-titulo text-lg font-semibold first-letter:uppercase">{base.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</p>
        <button className="btn-icon" aria-label="Mes siguiente" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))}><IconoAdelante className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-extrabold text-salvia mb-1">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center gap-y-1">
        {Array.from({ length: inicioSemana }).map((_, i) => <span key={'v' + i} />)}
        {Array.from({ length: diasMes }).map((_, i) => {
          const d = new Date(base.getFullYear(), base.getMonth(), i + 1);
          const s = fechaStr(d);
          const bloqueo = fechaBloqueada(d);
          const elegido = fecha === s;
          return (
            <button key={s} disabled={!!bloqueo} title={bloqueo ?? ''} aria-pressed={elegido} onClick={() => onPick(s)}
              className={`relative mx-auto w-full max-w-11 aspect-square rounded-full font-bold transition-colors ${elegido
                ? 'bg-hondo text-white'
                : bloqueo ? 'text-salvia/60 line-through' : 'bg-seleccion text-bosque active:bg-menta'}`}>
              {i + 1}
              {s === hoyS && !elegido && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-alerta" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
