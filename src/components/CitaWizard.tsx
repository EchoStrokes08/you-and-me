// El asistente de citas en pasos: qué hacer, cuándo, dónde y qué llevar; también registra citas que ya pasaron.
// Toma ventaja de ideas ya escritas: un plan guardado en Juntos o un lugar "por conocer" del mapa, que no tiene id en el catálogo.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import HeartsProgress from './HeartsProgress';
import { DesfileMascotas, FamiliaMascotas } from './MascotaDinamica';
import MapaLugar, { type LugarMapa } from './MapaLugar';
import { IconoAtras, IconoAdelante, IconoCalendario, IconoCerrar, IconoCheck, IconoDado, IconoDestello, IconoMapa, IconoMas, IconoPercha, IconoPin, IconoRegalo } from './ui';
import { Calendario } from './Calendario';
import IdeaPropia, { Ruleta, PRESUPUESTOS } from './IdeaPropia';
import { useAvisos } from '../lib/avisos';
import { fechaStr, hoy, diasLabel, precioStr, fechaBonita } from '../lib/utils';
import { cargarPorConocer, type PorConocer } from '../lib/porConocer';
import { ideasPara } from '../lib/ideasDeCita';

import type { Tables } from '../lib/database.types';
import type { Actividad as Act, CategoriaCita as Cat, Configuracion, Franja, Lugar as LugarDelCatalogo } from '../lib/tipos';

type Opcion = Tables<'opciones_llevar'>;
// Un lugar escogido: uno del catálogo o uno marcado en el mapa. Los del mapa no tienen id propio
// ni lo que el catálogo sabe de cada lugar (precio, si es escapada…)
type LugarDelMapa = ReturnType<typeof lugarDeMapa>;
type Lugar = (LugarDelCatalogo & { es_mapa?: undefined; direccion?: undefined }) | LugarDelMapa;

// Con `pasada`, registra una cita que ya ocurrió: admite fechas anteriores, no pide qué llevar
// y queda de una vez como vivida (sin invitación ni aviso al otro).
// Con `plan` (viene de Juntos) la idea ya llega escrita en el paso de qué hacer;
// con `lugarInicial` (viene de un lugar por conocer del mapa) el lugar ya llega escogido.
export type PlanCita = { titulo: string; emoji: string };
export type LugarInicial = LugarMapa & { categoria_slug?: string | null };
// Si es un lugar por conocer, trae el tipo de plan que se le anotó: con eso se sabe qué ideas le van
const lugarDeMapa = (l: LugarInicial) => ({
  id: 'mapa', emoji: '📍', es_mapa: true as const, nombre: l.nombre, direccion: l.direccion, lat: l.lat, lng: l.lng,
  categorias: l.categoria_slug ? [l.categoria_slug] : [],
  es_sorpresa: undefined, es_escapada: undefined, precio: undefined,
});
// El lugar del mapa no tiene id propio: se distingue por dónde queda
const mismoLugar = (a: Lugar | null, b: Lugar | null) => !!a && !!b && a.id === b.id && (!a.es_mapa || (a.lat === b.lat && a.lng === b.lng));

export default function CitaWizard({ onClose, pasada = false, plan, lugarInicial }: { onClose: () => void; pasada?: boolean; plan?: PlanCita | null; lugarInicial?: LugarInicial | null }) {
  const { perfil } = useAuth();
  const { revisar, confirmar, aviso } = useAvisos();
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<Cat[]>([]);
  const [lugares, setLugares] = useState<LugarDelCatalogo[]>([]);
  const [actividades, setActividades] = useState<Act[]>([]);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [detalles, setDetalles] = useState<Opcion[]>([]);
  const [vestimentas, setVestimentas] = useState<Opcion[]>([]);
  const [bloqueos, setBloqueos] = useState<{ fecha: string; creado_por: string }[]>([]);
  const [ideando, setIdeando] = useState(!!plan);
  const [porConocer, setPorConocer] = useState<PorConocer[]>([]);
  const [vinculos, setVinculos] = useState<Tables<'lugar_actividad'>[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);

  const [categoria, setCategoria] = useState<Cat | null>(null);
  const [esSorpresaCita, setEsSorpresaCita] = useState(false);
  const [lugar, setLugar] = useState<Lugar | null>(lugarInicial ? lugarDeMapa(lugarInicial) : null);
  const [actividad, setActividad] = useState<Act | null>(null);
  const [sorpresaLugar, setSorpresaLugar] = useState(false);
  const [sorpresaActividad, setSorpresaActividad] = useState(false);
  const [fecha, setFecha] = useState<string>('');
  const [franjaId, setFranjaId] = useState<string>('');
  const [vestimentaId, setVestimaId] = useState<string>('');
  const [detallesSel, setDetallesSel] = useState<Opcion[]>([]);
  const [nota, setNota] = useState('');
  const [guardado, setGuardado] = useState<Tables<'citas'> | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  useEffect(() => {
    supabase.from('categorias_cita').select('*').eq('activo', true).order('orden').then(({ data }) => {
      setCats(data ?? []);
      // El lugar por conocer ya dice qué tipo de plan es: queda escogido (se puede cambiar)
      const suPlan = lugarInicial?.categoria_slug && (data ?? []).find((c) => c.slug === lugarInicial.categoria_slug);
      if (suPlan) setCategoria((actual: Cat | null) => actual ?? suPlan);
    });
    supabase.from('lugares').select('*').eq('activo', true).order('orden').then(({ data }) => setLugares(data ?? []));
    supabase.from('actividades').select('*').eq('activo', true).order('orden').then(({ data }) => {
      setActividades(data ?? []);
      // Si el plan ya se había anotado como idea de cita, se escoge esa en vez de crear otra igual
      const ya = plan && (data ?? []).find((a) => !a.es_sorpresa && a.nombre.trim().toLowerCase() === plan.titulo.trim().toLowerCase());
      if (ya) { setActividad(ya); setIdeando(false); }
    });
    if (!pasada) cargarPorConocer().then(setPorConocer);
    supabase.from('franjas').select('*').eq('activo', true).order('orden').then(({ data }) => setFranjas(data ?? []));
    supabase.from('opciones_llevar').select('*').eq('activo', true).order('orden').then(({ data }) => {
      const all = data ?? [];
      setDetalles(all.filter((o) => o.tipo === 'detalle'));
      setVestimentas(all.filter((o) => o.tipo === 'vestimenta'));
    });
    supabase.from('fechas_no_disponibles').select('fecha, creado_por').then(({ data }) => setBloqueos(data ?? []));
    supabase.from('lugar_actividad').select('*').then(({ data }) => setVinculos(data ?? []));
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    // Solo al abrir: `plan` y `pasada` no cambian mientras el asistente está abierto
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lugaresFiltrados = useMemo(() => (categoria && !categoria.slug.includes('sorpresa')
    ? lugares.filter((l) => l.es_sorpresa || l.categorias?.includes(categoria.slug))
    : lugares).filter((l) => !pasada || !l.es_sorpresa), [lugares, categoria, pasada]);

  // Las ideas del paso 3, en dos grupos: las que van con el lugar y las demás que también caben
  const ideas = useMemo(() => {
    const { propias, otras } = ideasPara(lugar, actividades, vinculos);
    // Una cita que ya pasó no puede ser sorpresa
    const sorpresas = pasada ? [] : actividades.filter((a) => a.es_sorpresa);
    // La que ya está escogida no se pierde de vista aunque no sea de este lugar
    const suelta = actividad && !actividad.es_sorpresa && ![...propias, ...otras].some((a) => a.id === actividad.id) ? [actividad] : [];
    return propias.length ? { propias: [...propias, ...sorpresas], otras: [...otras, ...suelta] } : { propias: [], otras: [...otras, ...suelta, ...sorpresas] };
  }, [lugar, actividades, vinculos, pasada, actividad]);

  const pasosVisibles: number[] = pasada ? [1, 2, 3, 4, 6] : esSorpresaCita ? [1, 4, 5, 6] : sorpresaLugar ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const totalPasos = pasosVisibles.length;
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
    if (pasada) return d > hoy() ? 'Ese día todavía no llega' : null;
    if (d < hoy()) return 'Ese día ya pasó 😢';
    if (d > new Date(hoy().getTime() + 60 * 86400000)) return 'Muy lejos 🌿';
    // Los días que marcó cada uno en "Días que no puedo"
    if (bloqueos.some((b) => b.fecha === s && b.creado_por === perfil?.id)) return 'Ese día dijiste que no puedes';
    if (bloqueos.some((b) => b.fecha === s)) return 'Ese día no puedo 😢';
    if (actividad?.dias_permitidos && !actividad.dias_permitidos.includes(d.getDay()))
      return `Solo se puede ${diasLabel(actividad.dias_permitidos)} 🗓️`;
    return null;
  };

  // "Ármame una cita": la app escoge plan, lugar, actividad, día y momento, y deja todo en el resumen
  // para cambiar lo que no guste. Respeta el presupuesto, los días que alguno no puede y los días de cada actividad.
  const [tope, setTope] = useState(0); // 0 = sin límite
  const [alAzar, setAlAzar] = useState(false);
  const armarAlAzar = () => {
    const azar = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    const cabe = (x: { precio?: number }) => !tope || (x.precio ?? 1) <= tope;
    // Las tres semanas que vienen, desde mañana
    const dias = Array.from({ length: 21 }, (_, i) => { const d = hoy(); d.setDate(d.getDate() + i + 1); return d; })
      .filter((d) => !bloqueos.some((b) => b.fecha === fechaStr(d)));
    const planes = cats.filter((c) => !c.slug.includes('sorpresa'));

    const sePuede = (a: Act) => cabe(a) && dias.some((d) => !a.dias_permitidos || a.dias_permitidos.includes(d.getDay()));
    // Cada lugar con lo que se hace allá: las ideas que tiene anotadas y, solo si no tiene ninguna,
    // las generales de su tipo de plan. Se descartan los que no dejan armar nada.
    let candidatos: { l: Lugar; planes: Cat[]; acts: Act[] }[] = lugares.filter((l) => !l.es_sorpresa && cabe(l)).map((l) => {
      const { propias, otras } = ideasPara(l, actividades, vinculos);
      return { l, planes: planes.filter((c) => l.categorias?.includes(c.slug)), acts: (propias.length ? propias : otras).filter(sePuede) };
    });
    // Los lugares por conocer también entran, con el tipo de plan que se les anotó (los que no lo tienen
    // se quedan por fuera: no se adivina) y solo con las ideas generales de ese tipo.
    for (const d of porConocer) {
      const l = lugarDeMapa(d);
      candidatos.push({ l, planes: planes.filter((c) => c.slug === d.categoria_slug), acts: ideasPara(l, actividades, vinculos).propias.filter(sePuede) });
    }
    candidatos = candidatos.filter((x) => x.planes.length && x.acts.length);
    // Que no repita el lugar que acaba de salir, si hay más de dónde escoger
    const otros = candidatos.filter((x) => !mismoLugar(x.l, lugar));
    const elegido = azar(otros.length ? otros : candidatos);
    if (!elegido) { aviso(tope ? 'No encontré un plan con ese presupuesto 😢 Prueba con uno más alto.' : 'No encontré con qué armar una cita 😢', 'error'); return; }

    const a = azar(elegido.acts);
    const dia = azar(dias.filter((d) => !a.dias_permitidos || a.dias_permitidos.includes(d.getDay())));
    const diaCompleto = franjas.find((f) => f.nombre === 'Día completo');
    // El momento del día sale de los que le sirven a la idea (un atardecer no se ve por la mañana)
    const momentos = franjas.filter((f) => f.id !== diaCompleto?.id);
    const suyos = momentos.filter((f) => a.franjas_permitidas?.includes(f.id));
    const franja = elegido.l.es_escapada && diaCompleto ? diaCompleto : azar(suyos.length ? suyos : momentos) ?? franjas[0];
    // Y el tipo de plan, de los que comparten el lugar y la idea
    const comunes = elegido.planes.filter((c) => a.categorias?.includes(c.slug));

    setCategoria(azar(comunes.length ? comunes : elegido.planes)); setEsSorpresaCita(false);
    setLugar(elegido.l); setSorpresaLugar(false);
    setActividad(a); setSorpresaActividad(false);
    setFecha(fechaStr(dia)); setFranjaId(franja?.id ?? '');
    setAlAzar(true);
    setStep(6);
  };

  // Salir a medias pregunta primero: son hasta seis pasos escogidos
  const cerrar = async () => {
    const hayAvance = step > 1 || !!categoria || esSorpresaCita;
    if (hayAvance && !(await confirmar({ titulo: '¿Salir sin agendar la cita?', texto: 'Se pierde lo que llevas escogido.', boton: 'Salir', peligro: true }))) return;
    onClose();
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
      estado: pasada ? 'vivida' : 'pendiente',
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
        <DesfileMascotas />
        <div className="p-6 max-w-lg mx-auto flex flex-col gap-4 text-center min-h-dvh justify-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} className="w-56 mx-auto mb-2">
            <FamiliaMascotas />
          </motion.div>
          <h2 className="text-4xl font-bold">{pasada ? '¡Cita guardada!' : '¡Cita agendada!'}</h2>
          {pasada ? (
            <>
              <p className="text-salvia">Quedó en <b className="text-bosque">Vividas</b>. Si quieres, guárdala también como recuerdo, con fotos y todo.</p>
              <Link to="/historia" state={{ cita: guardado.id }} className="btn-primary mt-2">Guardarla como recuerdo</Link>
            </>
          ) : (
            <>
              <p className="text-salvia">Tu cita quedó <b className="text-bosque">pendiente</b>. {perfil?.rol === 'admin' ? 'Ella la acepta desde Citas 💚' : 'Yo la confirmo desde mi panel 💚'}</p>
              <a href={`https://wa.me/${perfil?.rol === 'admin' ? config?.whatsapp_ella : config?.whatsapp}?text=${encodeURIComponent(resumenTxt())}`} target="_blank" rel="noreferrer" className="btn-primary mt-2">Avisarle por WhatsApp</a>
            </>
          )}
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
          <button onClick={cerrar} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="flex flex-col gap-4">
            {step === 1 && (
              <>
                {pasada ? encabezado('¿Qué plan fue?', 'Una cita que ya tuvimos') : encabezado('¿Qué plan te provoca?', 'Escoge el tipo de cita')}
                {(plan || lugarInicial) && (
                  <p className="rounded-2xl bg-seleccion border border-menta px-4 py-3 text-sm">
                    {plan
                      ? <>Vamos a planear <b className="text-bosque">{plan.emoji} {plan.titulo}</b>. La idea ya queda puesta cuando llegues a qué hacer.</>
                      : <>Vamos a conocer <b className="text-bosque">{lugarInicial!.nombre}</b>. El lugar ya queda escogido; lo puedes cambiar en el siguiente paso.</>}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {cats.map((c) => <Tarjeta key={c.slug} item={c} selected={categoria?.slug === c.slug && !esSorpresaCita} onClick={() => { setCategoria(c); setEsSorpresaCita(false); setSorpresaLugar(false); setSorpresaActividad(false); }} />)}
                  {!pasada && <Tarjeta item={{ emoji: '🎁', nombre: 'Cita sorpresa', descripcion: 'Tú solo dime cuándo; yo me encargo del resto' }} selected={esSorpresaCita} onClick={() => { setEsSorpresaCita(true); setCategoria(null); }} />}
                </div>
                {!pasada && (
                  <section className="rounded-3xl border-2 border-dashed border-menta bg-tarjeta p-4 flex flex-col gap-3" aria-label="Ármame una cita">
                    <div>
                      <p className="font-extrabold text-bosque-oscuro">¿Ninguno sabe qué proponer?</p>
                      <p className="text-sm text-salvia">Te armo una cita completa al azar, en un día que los dos puedan. Después cambias lo que quieras.</p>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Presupuesto máximo">
                      <button type="button" onClick={() => setTope(0)} data-active={tope === 0} aria-pressed={tope === 0} className="chip text-sm">Cualquiera</button>
                      {PRESUPUESTOS.slice(0, 3).map(([n, etiqueta]) => (
                        <button key={n} type="button" onClick={() => setTope(n)} data-active={tope === n} aria-pressed={tope === n} className="chip text-sm">
                          <span className="font-extrabold">{precioStr(n)}</span> {n === 1 ? etiqueta : `Hasta ${etiqueta.toLowerCase()}`}
                        </button>
                      ))}
                    </div>
                    <button onClick={armarAlAzar} disabled={!lugares.length || !actividades.length || !franjas.length} className="btn-soft">
                      <IconoDado className="w-5 h-5" /> Ármame una cita
                    </button>
                  </section>
                )}
              </>
            )}

            {step === 2 && (
              <>
                {encabezado(pasada ? '¿A dónde fuimos?' : '¿A dónde nos vamos ma vie?')}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setMapaAbierto(true)}
                  className={`text-left rounded-3xl p-4 border-2 flex items-center gap-3 transition-colors ${lugar?.es_mapa ? 'border-esmeralda bg-seleccion' : 'border-dashed border-esmeralda/50 bg-tarjeta shadow-soft'}`}>
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
                {porConocer.length > 0 && (
                  <>
                    {subtitulo('Lugares que queremos conocer')}
                    <div className="grid grid-cols-2 gap-3">
                      {porConocer.map((d) => {
                        const l = lugarDeMapa(d);
                        return <Tarjeta key={d.id} item={{ emoji: '📍', nombre: d.nombre, descripcion: d.nota || d.direccion }} selected={mismoLugar(l, lugar)}
                          onClick={() => { setLugar(l); setSorpresaLugar(false); if (actividad?.es_sorpresa) setActividad(null); setSorpresaActividad(false); }} />;
                      })}
                    </div>
                    {subtitulo('Los de siempre')}
                  </>
                )}
                {!pasada && <Ruleta opciones={lugaresFiltrados} onPick={(l) => { setLugar(l); if (l.es_sorpresa) { setSorpresaLugar(true); setSorpresaActividad(true); } else setSorpresaLugar(false); }} />}
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
                {encabezado(pasada ? '¿Y qué hicimos?' : '¿Y qué hacemos allá?')}
                {!pasada && <Ruleta opciones={ideas.propias.length ? ideas.propias : ideas.otras} onPick={(a) => { setActividad(a); setSorpresaActividad(!!a.es_sorpresa); }} />}
                {ideando ? (
                  <IdeaPropia inicial={plan} tipos={cats.filter((c) => !c.slug.includes('sorpresa'))} tipoInicial={categoria?.slug} onCancelar={() => setIdeando(false)} onCreada={(a) => { setActividades((prev) => [...prev, a]); setActividad(a); setSorpresaActividad(false); setIdeando(false); }} />
                ) : (
                  <button onClick={() => setIdeando(true)} className="text-left rounded-3xl p-4 border-2 border-dashed border-menta bg-tarjeta flex items-center gap-3">
                    <span className="w-12 h-12 shrink-0 rounded-2xl bg-hondo text-white flex items-center justify-center"><IconoMas className="w-6 h-6" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-extrabold">¿Se te ocurre otra idea?</span>
                      <span className="block text-sm text-salvia">Anótala con su presupuesto y queda en la lista</span>
                    </span>
                  </button>
                )}
                {([[ideas.propias, lugar?.es_mapa ? 'Van con este lugar' : 'Para hacer allá'], [ideas.otras, 'Otras ideas']] as const).map(([grupo, titulo]) => grupo.length > 0 && (
                  <div key={titulo} className="flex flex-col gap-3">
                    {ideas.propias.length > 0 && subtitulo(titulo)}
                    <div className="grid grid-cols-2 gap-3">
                      {grupo.map((a) => (
                        <Tarjeta key={a.id} item={a} selected={actividad?.id === a.id} onClick={() => { setActividad(a); setSorpresaActividad(!!a.es_sorpresa); }}
                          sub={<span className="text-xs font-semibold text-salvia block mt-1.5">{precioStr(a.precio)}{a.dias_permitidos ? ` · ${diasLabel(a.dias_permitidos)}` : ''}{a.nota ? ` · ${a.nota}` : ''}</span>} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 4 && (
              <>
                {encabezado(pasada ? '¿Cuándo fue?' : '¿Cuándo nos vemos?')}
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
                {encabezado(alAzar ? 'Mira lo que salió' : 'Resumen', 'Toca cualquier línea para cambiarla')}
                {alAzar && (
                  <button onClick={armarAlAzar} className="chip self-start bg-durazno/40 border-durazno text-bosque-oscuro font-extrabold px-5">
                    <IconoDado className="w-5 h-5" /> No me convence, dame otra
                  </button>
                )}
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
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder={pasada ? '¿Algo que quieras anotar de ese día?' : '¿Algo más que deba saber?'} aria-label="Nota" className="input min-h-24" />
                <button onClick={guardar} disabled={!fecha || !franjaId || enviando} className="btn-primary text-lg">{enviando ? 'Guardando…' : pasada ? 'Guardar cita' : '¡Agendar cita!'}</button>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {mapaAbierto && (
            <MapaLugar
              inicial={lugar?.es_mapa ? (lugar as LugarMapa) : null}
              onClose={() => setMapaAbierto(false)}
              onPick={(l) => { setLugar(lugarDeMapa(l)); setSorpresaLugar(false); setSorpresaActividad(false); if (actividad?.es_sorpresa) setActividad(null); setMapaAbierto(false); }}
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

type ItemTarjeta = { nombre: string; emoji?: string; descripcion?: string | null; imagen_url?: string | null };

function Tarjeta({ item, selected, onClick, sub, mapa }: { item: ItemTarjeta; selected: boolean; onClick: () => void; sub?: React.ReactNode; mapa?: string | null }) {
  return (
    <div className="relative flex">
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick} aria-pressed={selected}
      className={`relative flex-1 flex flex-col items-start text-left rounded-3xl p-3 border-2 transition-colors duration-200 ${selected ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'}`}>
      {item.imagen_url
        ? <img src={item.imagen_url} alt="" loading="lazy" decoding="async" className="w-full h-24 object-cover rounded-2xl mb-2 bg-seleccion" />
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
