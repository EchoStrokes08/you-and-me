// La historia de los dos: recuerdos con fotos, videos, notas y canciones, con búsqueda, vistas por
// fecha ("un día como hoy") y copia de seguridad. Se llega desde el menú inferior y también recibe
// fotos compartidas desde la galería (share target). Solo lee; el formulario de recuerdos guarda.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr } from '../lib/utils';
import { borrarFotos, urlsFirmadas, type Foto } from '../lib/media/fotos';
import { MascotaPrimaria, Acompanantes, Mar } from '../components/mascotas/MascotaDinamica';
import CopiaSeguridad from '../components/historia/CopiaSeguridad';
import { useAvisos, sinConexion } from '../lib/avisos';
import { CAMBIO, descartarPendiente, leerPendientes, subirPendientes, type RecuerdoPendiente } from '../lib/recuerdosPendientes';
import { Contador, Corazon, Encabezado, Esqueleto, IconoBuscar, IconoCamara, IconoDestello, IconoMapa, IconoMas, IconoMedalla, IconoPlay, Vacio, VisorFotos } from '../components/ui';
import { leerCompartidos } from '../lib/media/compartir';
import RecuerdoCard from './historia/RecuerdoCard';
import FormRecuerdo from './historia/FormRecuerdo';
import type { CitaVivible, Configuracion, EstadisticasCitas, EstadoHistoria, FotoSinUrl, Recuerdo } from './historia/tipos';

const POR_PAGINA = 20;

export default function Historia() {
  const { perfil } = useAuth();
  const { confirmar, revisar, aviso } = useAvisos();
  // Viene de Juntos (sueno/reto), de una cita vivida, de "Un día como hoy" o del aviso de copias
  const estado = (useLocation().state ?? null) as EstadoHistoria | null;
  const sueno = estado?.sueno ?? estado?.reto ?? null;
  const citaDesde: string | null = estado?.cita ?? null;
  const abrir: string | null = estado?.abrir ?? null;
  const navigate = useNavigate();
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [recuerdos, setRecuerdos] = useState<Recuerdo[]>([]);
  const [cargado, setCargado] = useState(false);
  // Las fotos de todos los recuerdos, sin dirección: las direcciones firmadas se piden solo para lo que se ve
  const [meta, setMeta] = useState<Record<string, FotoSinUrl[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const pedidas = useRef(new Set<string>());
  const fotos = useMemo(() => Object.fromEntries(Object.entries(meta).map(([id, fs]) => [id, fs.map((f) => ({ ...f, url: urls[f.ruta] ?? '' }))])) as Record<string, Foto[]>, [meta, urls]);
  const [creando, setCreando] = useState(!!sueno || !!citaDesde);
  // Fotos compartidas desde la galería (share target) o el atajo "Nuevo recuerdo" del ícono
  const [params, setParams] = useSearchParams();
  const [compartidos, setCompartidos] = useState<File[] | null>(null);
  useEffect(() => {
    if (params.get('nuevo')) { setCreando(true); setParams({}, { replace: true }); }
    if (!params.get('compartido')) return;
    leerCompartidos().then((archivos) => {
      setParams({}, { replace: true });
      if (!archivos.length) return;
      setCompartidos(archivos);
      setCreando(true);
    });
    // Solo al llegar
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // El recuerdo que se acaba de guardar: aparece revelándose en la lista
  const [recien, setRecien] = useState<string | null>(null);
  const [citasVivibles, setCitasVivibles] = useState<CitaVivible[]>([]);
  const [stats, setStats] = useState<EstadisticasCitas | null>(null);
  const [filtro, setFiltroEstado] = useState<Filtro>(SIN_FILTRO);
  const [limite, setLimite] = useState(POR_PAGINA);
  // Al buscar o filtrar se vuelve a empezar desde los primeros
  const setFiltro = (f: Filtro) => { setFiltroEstado(f); setLimite(POR_PAGINA); };

  const visibles = useMemo(() => {
    const q = normalizar(filtro.texto.trim());
    return recuerdos.filter((r) =>
      (!q || normalizar(`${r.titulo} ${r.descripcion} ${r.lugar_texto}`).includes(q))
      && (!filtro.anio || r.fecha.startsWith(filtro.anio))
      && r.calificacion >= filtro.corazones
      && (!filtro.conFotos || (meta[r.id]?.length ?? 0) > 0));
  }, [recuerdos, meta, filtro]);

  // Si se viene a abrir un recuerdo viejo ("Un día como hoy", Resumen), mostrar hasta él
  const mostrados = useMemo(() => {
    const iAbrir = abrir ? visibles.findIndex((r) => r.id === abrir) : -1;
    return visibles.slice(0, Math.max(limite, iAbrir + 1));
  }, [visibles, abrir, limite]);
  const faltan = visibles.length - mostrados.length;

  // Álbum de favoritas: las fotos con corazón de los recuerdos que pasan los demás filtros
  const favoritas = useMemo(() => visibles.flatMap((r) => (fotos[r.id] ?? []).filter((f) => f.favorita).map((f) => ({ ...f, titulo: r.titulo, recuerdoId: r.id }))), [visibles, fotos]);

  // Se firman las direcciones de lo que está a la vista (o del álbum), no las de toda la historia
  useEffect(() => {
    const aLaVista = filtro.favoritas
      ? visibles.flatMap((r) => (meta[r.id] ?? []).filter((f) => f.favorita))
      : mostrados.flatMap((r) => meta[r.id] ?? []);
    const rutas = aLaVista.map((f) => f.ruta).filter((r) => !pedidas.current.has(r));
    if (!rutas.length) return;
    rutas.forEach((r) => pedidas.current.add(r));
    urlsFirmadas(rutas).then((nuevas) => {
      // Las que no llegaron (sin señal) se vuelven a pedir la próxima vez
      rutas.filter((r) => !nuevas[r]).forEach((r) => pedidas.current.delete(r));
      setUrls((antes) => ({ ...antes, ...nuevas }));
    });
  }, [mostrados, visibles, meta, filtro.favoritas]);

  // El corazón responde al toque; si no se pudo guardar, vuelve a como estaba
  const alternarFavorita = async (f: { id: string; favorita: boolean }, recuerdoId: string) => {
    const poner = (valor: boolean) => setMeta((m) => ({ ...m, [recuerdoId]: (m[recuerdoId] ?? []).map((x) => (x.id === f.id ? { ...x, favorita: valor } : x)) }));
    poner(!f.favorita);
    const { error } = revisar(await supabase.rpc('marcar_favorita', { p_id: f.id, p_favorita: !f.favorita }), 'No pude guardar la favorita');
    if (error) poner(f.favorita);
  };

  const cargar = async () => {
    try {
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    const { data } = await supabase.from('recuerdos').select('*').order('fecha', { ascending: false });
    setRecuerdos(data ?? []);
    setCargado(true);
    const { data: fs } = await supabase.from('fotos_recuerdo').select('*').order('orden');
    const map: Record<string, FotoSinUrl[]> = {};
    for (const f of fs ?? []) (map[f.recuerdo_id] ??= []).push({ id: f.id, ruta: f.ruta, orden: f.orden, tipo: f.tipo === 'video' ? 'video' : 'foto', favorita: !!f.favorita });
    setMeta(map);
    const { data: cv } = await supabase.from('citas').select('id, fecha, lugar_personalizado, lugar_direccion, lugar_lat, lugar_lng, lugares(nombre, lat, lng), actividades(nombre), recuerdos(id)').in('estado', ['confirmada', 'vivida']).lte('fecha', hoyStr()).order('fecha', { ascending: false });
    setCitasVivibles(((cv as CitaVivible[]) ?? []).filter((c) => !c.recuerdos?.length));
    const { data: viv } = await supabase.from('citas').select('categoria_slug, lugar_personalizado, lugares(nombre)').eq('estado', 'vivida');
    const conteo: Record<string, number> = {}; const lugaresC: Record<string, number> = {};
    for (const c of viv ?? []) {
      if (c.categoria_slug) conteo[c.categoria_slug] = (conteo[c.categoria_slug] ?? 0) + 1;
      const ln = c.lugares?.nombre ?? c.lugar_personalizado;
      if (ln) lugaresC[ln] = (lugaresC[ln] ?? 0) + 1;
    }
    const topCat = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0];
    // "Más repetido" solo si de verdad se repitió
    const topLugar = Object.entries(lugaresC).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0]?.[0];
    setStats({ total: viv?.length ?? 0, topCat, topLugar });
    } catch (e) {
      // Sin señal al llegar: la historia no queda para siempre cargando, y un aviso enseña qué pasa
      console.error('historia: no cargó', e);
      setCargado(true);
      aviso('No pude cargar la historia 😢 Revisa tu señal e intenta de nuevo.', 'error');
    }
  };
  useEffect(() => { cargar(); }, []);
  // Viene del aviso de "hace días no guardas una copia": baja hasta el botón
  useEffect(() => {
    if (!estado?.copia || !cargado) return;
    const t = setTimeout(() => document.getElementById('copia')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    return () => clearTimeout(t);
  }, [estado?.copia, cargado]);

  // Recuerdos guardados sin señal que siguen en este celular
  const [porSubir, setPorSubir] = useState<RecuerdoPendiente[]>([]);
  useEffect(() => {
    const alCambiar = (e: Event) => {
      leerPendientes().then(setPorSubir);
      // Uno acaba de quedar arriba: aparece en la lista
      const subido = (e as CustomEvent).detail?.subido;
      if (subido) { setRecien(subido); cargar(); }
    };
    leerPendientes().then(setPorSubir);
    window.addEventListener(CAMBIO, alCambiar);
    return () => window.removeEventListener(CAMBIO, alCambiar);
  }, []);

  const borrar = async (r: Recuerdo) => {
    const n = meta[r.id]?.length ?? 0;
    const ok = await confirmar({
      titulo: `¿Borrar «${r.titulo}»?`,
      texto: `Se borran ${n ? `sus ${n} ${n === 1 ? 'foto' : 'fotos'} y ` : ''}las notas. No se puede deshacer.`,
      boton: 'Borrar recuerdo', peligro: true,
    });
    if (!ok) return;
    // Primero las fotos: después de borrar el recuerdo ya no se sabría de quién eran
    if (!(await borrarFotos(fotos[r.id] ?? []))) { aviso('No pude borrar las fotos 😢 El recuerdo sigue igual.', 'error'); cargar(); return; }
    const { error } = revisar(await supabase.from('recuerdos').delete().eq('id', r.id), 'No pude borrar el recuerdo');
    if (!error) aviso('Recuerdo borrado');
    cargar();
  };

  const diasJuntos = config ? -diasEntre(config.fecha_inicio) : 0;
  const hitos = [100, 180, 365, 500, 730, 1000, 1095, 1500, 2000];
  const proximo = hitos.find((h) => h > diasJuntos);
  const anterior = [...hitos].reverse().find((h) => h <= diasJuntos) ?? 0;
  const progreso = proximo ? (diasJuntos - anterior) / (proximo - anterior) : 1;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Lo que hemos vivido" titulo="Nuestra historia" />
      <nav className="grid grid-cols-3 gap-2 -mt-1" aria-label="Más de nuestra historia">
        <Link to="/lugares" className="chip flex-col gap-1 rounded-3xl py-2.5 text-sm leading-tight text-center"><IconoMapa className="w-5 h-5" /> Lugares</Link>
        <Link to="/resumen" className="chip flex-col gap-1 rounded-3xl py-2.5 text-sm leading-tight text-center"><IconoDestello className="w-5 h-5" /> Resumen</Link>
        <Link to="/logros" className="chip flex-col gap-1 rounded-3xl py-2.5 text-sm leading-tight text-center"><IconoMedalla className="w-5 h-5" /> Logros</Link>
      </nav>

      <Mar>
        <div className="relative flex items-end justify-between">
          <p>
            <span className="block font-titulo text-6xl font-bold leading-none tabular-nums"><Contador valor={diasJuntos} /></span>
            <span className="block font-bold mt-1">días juntos</span>
          </p>
          <div className="relative w-40 -mr-2" aria-hidden="true">
            <MascotaPrimaria className="w-full" />
            <Acompanantes className="absolute w-16 -top-4 -left-11" />
          </div>
        </div>
        {proximo && (
          <div className="mt-5 relative">
            <div className="flex justify-between text-sm font-bold mb-1.5">
              <span>Próximo hito: {proximo} días</span>
              <span>faltan {proximo - diasJuntos}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)} aria-label={`Camino al hito de ${proximo} días`}>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.04, progreso) }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="h-full w-full origin-left rounded-full bg-lima" />
            </div>
          </div>
        )}
      </Mar>

      {/* Sin citas vividas los números no dicen nada; con pocas, se cuenta que apenas empiezan */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 stagger">
          {[
            [stats.total === 1 ? 'Cita vivida' : 'Citas vividas', stats.total],
            ['Plan favorito', stats.topCat ?? 'Por descubrir'],
            ['Lugar más repetido', stats.topLugar ?? 'Todos nuevos'],
          ].map(([l, v]) => (
            // El rótulo arriba y el dato abajo: las tres quedan alineadas aunque el dato ocupe uno o dos renglones
            <div key={l} className="card p-3 flex flex-col justify-between gap-2">
              <p className="text-xs font-bold text-salvia leading-tight">{l}</p>
              <p className={`font-titulo font-bold text-bosque leading-tight break-words first-letter:uppercase ${typeof v === 'number' ? 'text-[1.75rem] leading-none tabular-nums' : 'text-base'}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Con al menos un recuerdo ya hay película */}
      {recuerdos.length > 0 && (
        <Link to="/pelicula" className="card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
          <span className="w-12 h-12 shrink-0 rounded-full bg-hondo text-lima flex items-center justify-center"><IconoPlay className="w-5 h-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-titulo text-lg font-semibold leading-tight">Nuestra película</span>
            <span className="block text-sm text-salvia">Sus recuerdos en un video, con música del mar</span>
          </span>
        </Link>
      )}

      <button onClick={() => setCreando(!creando)} className={creando ? 'btn-soft' : 'btn-primary'}>
        <motion.span animate={{ rotate: creando ? 45 : 0 }}><IconoMas /></motion.span>
        {creando ? 'Cerrar' : 'Nuevo recuerdo'}
      </button>
      <AnimatePresence>
        {creando && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <FormRecuerdo perfil={perfil} citas={citasVivibles} inicial={compartidos ? { archivos: compartidos } : sueno} citaInicial={citaDesde} onDone={(id) => { setCreando(false); setRecien(id ?? null); setCompartidos(null); if (sueno || citaDesde) navigate('/historia', { replace: true, state: null }); cargar(); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {porSubir.length > 0 && perfil && <PorSubir pendientes={porSubir} usuario={perfil.id} />}

      {/* Con pocos recuerdos no hace falta buscar, pero el álbum de favoritas sí debe poder abrirse */}
      {(recuerdos.length > 2 || filtro.favoritas || Object.values(meta).some((fs) => fs.some((f) => f.favorita))) && (
        <Filtros recuerdos={recuerdos} filtro={filtro} setFiltro={setFiltro} visibles={visibles.length} />
      )}

      {!cargado ? (
        <div className="ml-3 pl-6" aria-label="Cargando los recuerdos"><Esqueleto className="h-72" /></div>
      ) : recuerdos.length === 0 ? (
        <Vacio titulo="Aún no hay recuerdos" texto="¡Creen el primero! Cada cita vivida puede quedarse aquí para siempre." />
      ) : filtro.favoritas ? (
        <AlbumFavoritas fotos={favoritas} onFavorita={(f) => alternarFavorita(f, f.recuerdoId)} />
      ) : visibles.length === 0 ? (
        <Vacio titulo="No encontré recuerdos así" texto="Prueba con otra palabra o quita algún filtro.">
          <button onClick={() => setFiltro(SIN_FILTRO)} className="btn-soft mt-4">Quitar filtros</button>
        </Vacio>
      ) : (
        <div className="relative ml-3 pl-6 flex flex-col gap-4 stagger before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-menta">
          {mostrados.map((r) => (
            <RecuerdoCard key={r.id} r={r} fotos={fotos[r.id] ?? []} perfil={perfil} destacado={r.id === abrir} recien={r.id === recien}
              puedeEditar={!!perfil && (r.creado_por === perfil.id || perfil.esAdmin)}
              pareja={(perfil?.rol === 'admin' ? config?.nombre_ella : config?.nombre_el) ?? 'mi amor'}
              onCambio={cargar} onBorrar={() => borrar(r)} onFavorita={(f) => alternarFavorita(f, r.id)} />
          ))}
        </div>
      )}
      {faltan > 0 && !filtro.favoritas && (
        <button onClick={() => setLimite(mostrados.length + POR_PAGINA)} className="btn-soft">
          Ver más recuerdos ({faltan})
        </button>
      )}

      <CopiaSeguridad />
    </div>
  );
}

// Recuerdos que se guardaron sin señal: siguen en este celular hasta que se puedan subir
function PorSubir({ pendientes, usuario }: { pendientes: RecuerdoPendiente[]; usuario: string }) {
  const { confirmar, aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);

  const subir = async () => {
    if (sinConexion()) { aviso('Todavía no hay señal 📡', 'error'); return; }
    setSubiendo(true);
    await subirPendientes(usuario);
    setSubiendo(false);
    // Puede que la subida la hubiera empezado la app sola: se mira qué quedó, no quién subió
    const quedan = (await leerPendientes()).length;
    if (quedan < pendientes.length) aviso(pendientes.length - quedan === 1 ? 'Recuerdo subido 📸' : `${pendientes.length - quedan} recuerdos subidos 📸`);
    else aviso('No pude subirlo todavía 😢 Intenta en un rato.', 'error');
  };
  const descartar = async (p: RecuerdoPendiente) => {
    const empezado = p.subidos > 0;
    const ok = await confirmar({
      titulo: `¿Descartar «${p.campos.titulo}»?`,
      texto: empezado ? 'El recuerdo ya quedó guardado; solo se pierden las fotos que faltaban por subir.' : 'Solo está en este celular: se pierde con sus fotos. No se puede deshacer.',
      boton: 'Descartar', peligro: true,
    });
    if (ok) descartarPendiente(p.id);
  };

  return (
    <section className="card p-4 flex flex-col gap-3 border-dashed" aria-label="Recuerdos por subir">
      <div>
        <p className="font-titulo text-xl font-semibold leading-tight">{pendientes.length === 1 ? 'Un recuerdo por subir' : `${pendientes.length} recuerdos por subir`}</p>
        <p className="text-sm text-salvia mt-0.5">Se guardaron en este celular porque no había señal. Se suben solos cuando vuelva; no borres la app mientras tanto.</p>
      </div>
      {pendientes.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-seleccion border border-menta px-3 py-2">
          <IconoCamara className="w-5 h-5 text-bosque shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight truncate">{p.campos.titulo}</p>
            <p className="text-sm text-salvia truncate first-letter:uppercase">
              {fechaBonita(p.campos.fecha)}{p.archivos.length > 0 && ` · ${p.archivos.length} ${p.archivos.length === 1 ? 'archivo' : 'archivos'}${p.subidos > 0 ? ' por terminar' : ''}`}
            </p>
          </div>
          <button onClick={() => descartar(p)} disabled={subiendo} className="text-sm font-bold text-coral min-h-11 px-2 -mr-2">Descartar</button>
        </div>
      ))}
      <button onClick={subir} disabled={subiendo} className="btn-soft">{subiendo ? 'Subiendo…' : 'Subir ahora'}</button>
    </section>
  );
}

type Filtro = { texto: string; anio: string; corazones: number; conFotos: boolean; favoritas: boolean };
const SIN_FILTRO: Filtro = { texto: '', anio: '', corazones: 0, conFotos: false, favoritas: false };

// Sin tildes ni mayúsculas: "medellin" encuentra "Medellín"
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Filtros({ recuerdos, filtro, setFiltro, visibles }: { recuerdos: Recuerdo[]; filtro: Filtro; setFiltro: (f: Filtro) => void; visibles: number }) {
  const anios = useMemo(() => [...new Set(recuerdos.map((r) => r.fecha.slice(0, 4)))].sort().reverse(), [recuerdos]);
  const activo = filtro.texto.trim() || filtro.anio || filtro.corazones || filtro.conFotos || filtro.favoritas;
  const cambiar = (c: Partial<Filtro>) => setFiltro({ ...filtro, ...c });
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <IconoBuscar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-salvia" />
        <input value={filtro.texto} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="Buscar un recuerdo, un lugar…" className="input pl-11" type="search" aria-label="Buscar recuerdos" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => cambiar({ favoritas: !filtro.favoritas })} data-active={filtro.favoritas} aria-pressed={filtro.favoritas} className="chip shrink-0"><IconoDestello className="w-4 h-4" /> Fotos favoritas</button>
        {anios.length > 1 && anios.map((a) => (
          <button key={a} onClick={() => cambiar({ anio: filtro.anio === a ? '' : a })} data-active={filtro.anio === a} className="chip shrink-0">{a}</button>
        ))}
        <button onClick={() => cambiar({ corazones: filtro.corazones === 5 ? 0 : 5 })} data-active={filtro.corazones === 5} className="chip shrink-0"><Corazon className="w-4 h-4" /> 5 corazones</button>
        <button onClick={() => cambiar({ conFotos: !filtro.conFotos })} data-active={filtro.conFotos} className="chip shrink-0"><IconoCamara className="w-4 h-4" /> Con fotos</button>
      </div>
      {activo && (
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="text-salvia">{visibles} de {recuerdos.length} recuerdos</span>
          <button onClick={() => setFiltro(SIN_FILTRO)} className="text-bosque min-h-11 px-2 -mr-2">Quitar filtros</button>
        </div>
      )}
    </div>
  );
}

// Las fotos con corazón, juntas: se tocan para verlas en grande y desde ahí se les quita el corazón
function AlbumFavoritas({ fotos, onFavorita }: { fotos: (Foto & { titulo: string; recuerdoId: string })[]; onFavorita: (f: Foto & { recuerdoId: string }) => void }) {
  const [viendo, setViendo] = useState<number | null>(null);
  const visor = useMemo(() => fotos.map((f) => ({ url: f.url, alt: `${f.tipo === 'video' ? 'Video' : 'Foto'} de ${f.titulo}`, video: f.tipo === 'video', favorita: f.favorita })), [fotos]);
  // Al quitarle el corazón a la última, el visor se queda sin qué mostrar
  useEffect(() => { if (viendo != null && viendo >= fotos.length) setViendo(fotos.length ? fotos.length - 1 : null); }, [viendo, fotos.length]);
  if (!fotos.length) return <Vacio titulo="Aún no hay fotos favoritas" texto="Abre un recuerdo, mira una foto en grande y tócale el corazón: aquí quedan todas juntas." />;
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 stagger" aria-label="Fotos favoritas">
        {fotos.map((f, i) => (
          <button key={f.id} onClick={() => setViendo(i)} aria-label={`Ver en grande: ${f.titulo}`} className="relative aspect-square overflow-hidden rounded-2xl bg-seleccion cursor-zoom-in">
            {f.tipo === 'video'
              ? <span className="absolute inset-0 bg-pino text-white flex items-center justify-center"><IconoPlay className="w-8 h-8" /></span>
              : f.url && <img src={f.url} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover" />}
          </button>
        ))}
      </div>
      <VisorFotos fotos={visor} indice={viendo} onCambio={setViendo} onFavorita={(i) => onFavorita(fotos[i])} />
    </>
  );
}
