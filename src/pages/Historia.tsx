import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr, nombreLugar } from '../lib/utils';
import { borrarFotos, esVideo, subirFotos, urlsFirmadas, MAX_FOTOS, MAX_MB_VIDEO, MAX_VIDEOS, type Foto } from '../lib/fotos';
import { MascotaPrimaria, Acompanantes, Mar } from '../components/MascotaDinamica';
import MapaLugar, { type LugarMapa } from '../components/MapaLugar';
import Cancion from '../components/Cancion';
import CopiaSeguridad from '../components/CopiaSeguridad';
import { sinConexion, useAvisos } from '../lib/avisos';
import { CAMBIO, descartarPendiente, esFallaDeRed, guardarPendiente, leerPendientes, subirPendientes, type RecuerdoPendiente } from '../lib/recuerdosPendientes';
import { Contador, Corazon, Encabezado, Esqueleto, IconoAmpliar, IconoBuscar, IconoCamara, IconoCerrar, IconoCheck, IconoDestello, IconoLapiz, IconoMapa, IconoMas, IconoMedalla, IconoPin, IconoPlay, Vacio, VisorFotos } from '../components/ui';
import { leerCompartidos } from '../lib/compartir';

type FotoSinUrl = Omit<Foto, 'url'>;

export default function Historia() {
  const { perfil } = useAuth();
  const { confirmar, revisar, aviso } = useAvisos();
  // Viene de Juntos → "Guardarlo como recuerdo"
  const estado = useLocation().state as any;
  // Viene de Juntos → "Guardarlo como recuerdo" (un plan cumplido o el reto del mes)
  const sueno = estado?.sueno ?? estado?.reto ?? null;
  // Viene de una cita que ya pasó (Inicio, Citas, el mapa): el formulario se abre con esa cita escogida
  const citaDesde: string | null = estado?.cita ?? null;
  // Viene de "Un día como hoy": abrir ese recuerdo
  const abrir: string | null = estado?.abrir ?? null;
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [recuerdos, setRecuerdos] = useState<any[]>([]);
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
  const [citasVivibles, setCitasVivibles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
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
  const favoritas = useMemo(() => visibles.flatMap((r) => (fotos[r.id] ?? []).filter((f) => f.favorita).map((f) => ({ ...f, titulo: r.titulo as string, recuerdoId: r.id as string }))), [visibles, fotos]);

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
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    const { data } = await supabase.from('recuerdos').select('*').order('fecha', { ascending: false });
    setRecuerdos(data ?? []);
    setCargado(true);
    const { data: fs } = await supabase.from('fotos_recuerdo').select('*').order('orden');
    const map: Record<string, FotoSinUrl[]> = {};
    for (const f of fs ?? []) (map[f.recuerdo_id] ??= []).push({ id: f.id, ruta: f.ruta, orden: f.orden, tipo: f.tipo ?? 'foto', favorita: !!f.favorita });
    setMeta(map);
    const { data: cv } = await supabase.from('citas').select('id, fecha, lugar_personalizado, lugar_direccion, lugar_lat, lugar_lng, lugares(nombre, lat, lng), actividades(nombre), recuerdos(id)').in('estado', ['confirmada', 'vivida']).lte('fecha', hoyStr()).order('fecha', { ascending: false });
    setCitasVivibles(((cv as any[]) ?? []).filter((c) => !c.recuerdos?.length));
    const { data: viv } = await supabase.from('citas').select('categoria_slug, lugar_personalizado, lugares(nombre)').eq('estado', 'vivida');
    const conteo: any = {}; const lugaresC: any = {};
    for (const c of (viv as any[]) ?? []) {
      if (c.categoria_slug) conteo[c.categoria_slug] = (conteo[c.categoria_slug] ?? 0) + 1;
      const ln = (c.lugares as any)?.nombre ?? c.lugar_personalizado;
      if (ln) lugaresC[ln] = (lugaresC[ln] ?? 0) + 1;
    }
    const topCat = Object.entries(conteo).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
    // "Más repetido" solo si de verdad se repitió
    const topLugar = Object.entries(lugaresC).filter(([, n]: any) => n > 1).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
    setStats({ total: viv?.length ?? 0, topCat, topLugar });
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

  const borrar = async (r: any) => {
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

const POR_PAGINA = 20;

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

function Filtros({ recuerdos, filtro, setFiltro, visibles }: { recuerdos: any[]; filtro: Filtro; setFiltro: (f: Filtro) => void; visibles: number }) {
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

function RecuerdoCard({ r, fotos, perfil, pareja, destacado = false, recien = false, puedeEditar, onCambio, onBorrar, onFavorita }: {
  r: any; fotos: Foto[]; perfil: any; pareja: string; destacado?: boolean; recien?: boolean; puedeEditar: boolean; onCambio: () => void; onBorrar: () => void; onFavorita: (f: Foto) => void;
}) {
  const { revisar, confirmar, pedirTexto } = useAvisos();
  const [open, setOpen] = useState(destacado);
  const [editando, setEditando] = useState(false);
  const [notas, setNotas] = useState<any[]>([]);
  const [canciones, setCanciones] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  // La portada es la primera foto favorita o, si no hay, la primera; los videos se ven al abrir el recuerdo
  const portada = fotos.find((f) => f.tipo !== 'video' && f.favorita) ?? fotos.find((f) => f.tipo !== 'video');
  const nVideos = fotos.filter((f) => f.tipo === 'video').length;
  const nFotos = fotos.length - nVideos;
  // Lo que se puede ver en grande, y cuál se está viendo
  const visor = useMemo(() => fotos.map((f, i) => ({ url: f.url, alt: `${f.tipo === 'video' ? 'Video' : 'Foto'} ${i + 1} de ${r.titulo}`, video: f.tipo === 'video', favorita: f.favorita })), [fotos, r.titulo]);
  const [viendo, setViendo] = useState<number | null>(null);
  useEffect(() => {
    if (destacado || recien) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [destacado, recien]);
  const cargarNotas = useCallback(() => supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).order('created_at').then(({ data }) => setNotas(data ?? [])), [r.id]);
  useEffect(() => {
    if (!open) return;
    cargarNotas();
    supabase.from('canciones').select('*').eq('recuerdo_id', r.id).then(({ data }) => setCanciones(data ?? []));
  }, [open, r.id, cargarNotas]);
  const guardarNota = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('notas_recuerdo').insert({ recuerdo_id: r.id, usuario_id: perfil.id, texto: texto.trim() }), 'No pude guardar la nota');
    if (error) return;
    setTexto('');
    cargarNotas();
  };
  // Cada uno corrige o borra solo lo que escribió
  const editarNota = async (n: any) => {
    const nuevo = await pedirTexto({ titulo: 'Lo mejor para mí fue…', inicial: n.texto, boton: 'Guardar' });
    if (nuevo === null || !nuevo.trim() || nuevo.trim() === n.texto) return;
    revisar(await supabase.from('notas_recuerdo').update({ texto: nuevo.trim() }).eq('id', n.id), 'No pude guardar la nota');
    cargarNotas();
  };
  const borrarNota = async (n: any) => {
    if (!(await confirmar({ titulo: '¿Borrar tu nota?', texto: `«${n.texto}»`, boton: 'Borrar', peligro: true }))) return;
    revisar(await supabase.from('notas_recuerdo').delete().eq('id', n.id), 'No pude borrar la nota');
    cargarNotas();
  };

  if (editando) {
    return (
      <div ref={ref} className="relative">
        <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda shadow" />
        <FormRecuerdo perfil={perfil} existente={r} fotosExistentes={fotos}
          onCancelar={() => setEditando(false)} onDone={() => { setEditando(false); onCambio(); }} />
      </div>
    );
  }

  return (
    // Recién guardado: la tarjeta se posa y la foto se revela, de lavada y borrosa a nítida
    <motion.div ref={ref} initial={recien ? { opacity: 0, y: -14, scale: 0.96 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative card p-0 overflow-visible ${destacado || recien ? 'ring-2 ring-esmeralda' : ''}`}>
      <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda" />
      {/* La portada abre el recuerdo; ya abierto, se ve en grande */}
      {portada && (
        <button onClick={() => (open ? setViendo(fotos.indexOf(portada)) : setOpen(true))} aria-label={open ? `Ver en grande la foto de ${r.titulo}` : `Abrir ${r.titulo}`}
          className={`block w-full relative overflow-hidden rounded-t-[1.75rem] ${open ? 'cursor-zoom-in' : ''}`}>
          <motion.img src={portada.url || undefined} loading="lazy" decoding="async" alt={`Foto de ${r.titulo}`} className="w-full h-52 object-cover bg-seleccion"
            initial={recien ? { filter: 'blur(16px) saturate(0) brightness(1.6)' } : false} animate={{ filter: 'blur(0px) saturate(1) brightness(1)' }} transition={{ duration: 1.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
          {fotos.length > 1 && <span className="absolute top-3 right-3 badge bg-pino/80 text-white text-sm"><IconoCamara className="w-4 h-4" /> {nFotos}{nVideos > 0 && <><IconoPlay className="w-3.5 h-3.5 ml-1.5" /> {nVideos}</>}</span>}
        </button>
      )}
      <button onClick={() => setOpen(!open)} className="text-left w-full" aria-expanded={open}>
        <div className="p-4">
          <p className="font-titulo text-2xl font-semibold leading-tight">{r.titulo}</p>
          <p className="text-sm text-salvia mt-1 first-letter:uppercase">{fechaBonita(r.fecha)}</p>
          {r.lugar_texto && <p className="text-sm text-salvia flex items-center gap-1"><IconoPin className="w-4 h-4 shrink-0" /> {r.lugar_texto}</p>}
          <div className="flex gap-0.5 mt-2 text-bosque" role="img" aria-label={`${r.calificacion} de 5 corazones`}>{[1, 2, 3, 4, 5].map((n) => <Corazon key={n} className="w-5 h-5" lleno={n <= r.calificacion} />)}</div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 flex flex-col gap-3">
              {(fotos.length > 1 || nVideos > 0) && (
                <div className="flex overflow-x-auto gap-2 snap-x -mx-4 px-4">
                  {fotos.map((f, i) => f.tipo === 'video'
                    ? (
                      <div key={f.id} className="relative flex-shrink-0 snap-start">
                        <video src={f.url || undefined} controls playsInline preload="metadata" aria-label={`Video ${i + 1} de ${r.titulo}`} className="rounded-2xl h-40 max-w-[16rem] bg-pino" />
                        {/* Se pausa el chiquito para que no suenen los dos */}
                        <button onClick={(e) => { e.currentTarget.parentElement?.querySelector('video')?.pause(); setViendo(i); }} aria-label={`Ver en grande el video ${i + 1} de ${r.titulo}`}
                          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-pino/80 text-white flex items-center justify-center active:scale-90 transition"><IconoAmpliar /></button>
                      </div>
                    )
                    : (
                      <button key={f.id} onClick={() => setViendo(i)} aria-label={`Ver en grande la foto ${i + 1} de ${r.titulo}`} className="flex-shrink-0 snap-start cursor-zoom-in">
                        <img src={f.url || undefined} loading="lazy" decoding="async" alt="" className="rounded-2xl w-40 h-40 object-cover bg-seleccion" />
                      </button>
                    ))}
                </div>
              )}
              {r.descripcion && <p className="leading-relaxed whitespace-pre-wrap">{r.descripcion}</p>}
              {canciones.map((c) => <Cancion key={c.id} c={c} />)}
              {notas.map((n) => {
                const mia = n.usuario_id === perfil?.id;
                return (
                  <div key={n.id} className={`border border-menta rounded-2xl px-3 py-2 ${mia ? 'bg-seleccion' : 'bg-crema'}`}>
                    <p className="text-sm font-bold text-salvia">Lo mejor para {mia ? 'mí' : pareja}</p>
                    <p className="font-titulo italic text-lg leading-snug whitespace-pre-wrap">{n.texto}</p>
                    {mia && (
                      <div className="flex gap-4 text-sm font-bold -mb-1.5">
                        <button onClick={() => editarNota(n)} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoLapiz className="w-4 h-4" /> Editar</button>
                        <button onClick={() => borrarNota(n)} className="text-coral min-h-11">Borrar</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Lo mejor para mí fue…" aria-label="Lo mejor para mí fue" className="input py-2" />
                <button onClick={guardarNota} className="btn-primary min-w-12 px-3 py-2" aria-label="Guardar nota"><IconoCheck /></button>
              </div>
              {puedeEditar && (
                <div className="flex items-center gap-4 text-sm font-bold">
                  <button onClick={() => setEditando(true)} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoLapiz className="w-4 h-4" /> Editar o cambiar fotos</button>
                  <button onClick={onBorrar} className="text-coral ml-auto min-h-11 px-2 -mr-2">Borrar</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <VisorFotos fotos={visor} indice={viendo} onCambio={setViendo} onFavorita={(i) => onFavorita(fotos[i])} />
    </motion.div>
  );
}

// Crea un recuerdo nuevo o, con `existente`, edita uno (datos y fotos)
function FormRecuerdo({ perfil, citas = [], inicial, citaInicial, existente, fotosExistentes = [], onDone, onCancelar }: {
  perfil: any; citas?: any[]; inicial?: any; citaInicial?: string | null; existente?: any; fotosExistentes?: Foto[]; onDone: (idNuevo?: string | null) => void; onCancelar?: () => void;
}) {
  const { revisar, aviso } = useAvisos();
  const [citaId, setCitaId] = useState('');
  const [titulo, setTitulo] = useState(existente?.titulo ?? inicial?.titulo ?? '');
  const [fecha, setFecha] = useState(existente?.fecha ?? inicial?.fecha ?? '');
  const [lugar, setLugar] = useState(existente?.lugar_texto ?? '');
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? '');
  const [calificacion, setCalificacion] = useState(existente?.calificacion ?? 5);
  const [archivos, setArchivos] = useState<File[]>(inicial?.archivos ?? []);
  const [quitar, setQuitar] = useState<Set<string>>(new Set());
  const [ubicacion, setUbicacion] = useState<LugarMapa | null>(
    existente?.lat != null && existente?.lng != null ? { nombre: existente.lugar_texto ?? '', direccion: '', lat: existente.lat, lng: existente.lng } : null,
  );
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const quedan = fotosExistentes.filter((f) => !quitar.has(f.id));
  const cupo = Math.max(0, MAX_FOTOS - quedan.filter((f) => f.tipo !== 'video').length);
  const cupoVideos = Math.max(0, MAX_VIDEOS - quedan.filter((f) => f.tipo === 'video').length);
  // Lo escogido, ya recortado a lo que cabe: fotos por un lado y videos por el otro
  const nuevasFotos = useMemo(() => archivos.filter((a) => !esVideo(a)).slice(0, cupo), [archivos, cupo]);
  const videosPesados = useMemo(() => archivos.filter((a) => esVideo(a) && a.size > MAX_MB_VIDEO * 1024 * 1024).length, [archivos]);
  const nuevosVideos = useMemo(() => archivos.filter((a) => esVideo(a) && a.size <= MAX_MB_VIDEO * 1024 * 1024).slice(0, cupoVideos), [archivos, cupoVideos]);
  const sobran = archivos.length - nuevasFotos.length - nuevosVideos.length - videosPesados;
  // Miniaturas de las fotos escogidas, para verlas antes de guardar
  const vistas = useMemo(() => nuevasFotos.map((a) => URL.createObjectURL(a)), [nuevasFotos]);
  useEffect(() => () => vistas.forEach((v) => URL.revokeObjectURL(v)), [vistas]);

  const elegirCita = (id: string) => {
    setCitaId(id);
    const c = citas.find((x: any) => x.id === id);
    if (c) { setFecha(c.fecha); setLugar(nombreLugar(c) ?? ''); setTitulo(c.actividades?.nombre ?? 'Nuestra cita'); }
    // La ubicación de la cita (mapa o catálogo) pasa al recuerdo
    const lat = c?.lugar_lat ?? c?.lugares?.lat, lng = c?.lugar_lng ?? c?.lugares?.lng;
    setUbicacion(c && lat != null && lng != null ? { nombre: nombreLugar(c) ?? '', direccion: c.lugar_direccion ?? '', lat, lng } : null);
  };

  // Se viene a guardar una cita en particular: queda escogida apenas llega la lista de citas
  const pendienteDeElegir = !!citaInicial && !citaId && citas.some((c: any) => c.id === citaInicial);
  useEffect(() => {
    if (pendienteDeElegir) elegirCita(citaInicial!);
    // elegirCita se crea en cada render; lo que importa es cuándo aparece la cita en la lista
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pendienteDeElegir]);

  const alternarQuitar = (id: string) => {
    const s = new Set(quitar);
    if (s.has(id)) s.delete(id); else s.add(id);
    setQuitar(s);
  };

  const guardar = async () => {
    if (!titulo || !fecha) return;
    setGuardando(true);
    const campos = { titulo, fecha, lugar_texto: lugar, descripcion, calificacion, lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null };
    let id: string | null = existente?.id ?? null;

    if (existente) {
      const { error } = revisar(await supabase.from('recuerdos').update(campos).eq('id', existente.id), 'No pude guardar los cambios');
      if (error) { setGuardando(false); return; }
      if (quitar.size && !(await borrarFotos(fotosExistentes.filter((f) => quitar.has(f.id))))) {
        aviso('Guardé los cambios, pero no pude quitar alguna foto 😢', 'error');
      }
    } else {
      // Sin señal (pasa mucho al salir de la cita): queda en el teléfono y se sube solo después
      const alTelefono = async () => {
        const ok = await guardarPendiente({ campos, citaId: citaId || null, suenoId: inicial?.id ?? null, archivos: [...nuevasFotos, ...nuevosVideos] });
        setGuardando(false);
        if (!ok) { aviso('No hay señal y no pude guardarlo en el teléfono 😢 No cierres esta pantalla e intenta de nuevo.', 'error'); return; }
        aviso('No hay señal: lo guardé en este celular y lo subo apenas vuelva 📡');
        onDone(null);
      };
      if (sinConexion()) return alTelefono();
      const res = await supabase.from('recuerdos').insert({ ...campos, cita_id: citaId || null, creado_por: perfil.id }).select().single();
      if (esFallaDeRed(res.error)) return alTelefono();
      const { data, error } = revisar(res, 'No pude guardar el recuerdo');
      if (error || !data) { setGuardando(false); return; }
      id = data.id;
      if (citaId) revisar(await supabase.from('citas').update({ estado: 'vivida' }).eq('id', citaId), 'No pude marcar la cita como vivida');
      if (inicial?.id) revisar(await supabase.from('suenos').update({ recuerdo_id: data.id }).eq('id', inicial.id), 'No pude enlazar el plan con el recuerdo');
      if (inicial?.mes) revisar(await supabase.from('retos_mes').update({ recuerdo_id: data.id }).eq('mes', inicial.mes), 'No pude enlazar el reto con el recuerdo');
    }

    if (id && (nuevasFotos.length || nuevosVideos.length)) {
      // Las nuevas van después de las que ya había
      const desde = fotosExistentes.length ? Math.max(...fotosExistentes.map((f) => f.orden)) + 1 : 0;
      const fallidas = await subirFotos(id, [...nuevasFotos, ...nuevosVideos], desde);
      if (fallidas) aviso(`${fallidas} ${fallidas === 1 ? 'archivo no se subió' : 'archivos no se subieron'} 😢 Intenta agregarlos otra vez.`, 'error');
    }
    setGuardando(false);
    aviso(existente ? 'Recuerdo actualizado 💚' : 'Recuerdo guardado 📸');
    onDone(existente ? null : id);
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      {existente ? (
        <div className="flex items-center justify-between">
          <p className="font-titulo text-xl font-semibold">Editar recuerdo</p>
          <button onClick={onCancelar} className="btn-icon" aria-label="Cerrar sin guardar"><IconoCerrar className="w-4 h-4" /></button>
        </div>
      ) : (
        <select value={citaId} onChange={(e) => elegirCita(e.target.value)} className="input" aria-label="¿De cuál cita es este recuerdo?">
          <option value="">Desde cero (sin cita de la app)</option>
          {citas.map((c: any) => <option key={c.id} value={c.id}>{fechaBonita(c.fecha)} · {nombreLugar(c)}</option>)}
        </select>
      )}
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" aria-label="Título del recuerdo" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" className="input" />
        <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" aria-label="Lugar" className="input" />
      </div>
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Cómo nos fue?" aria-label="¿Cómo nos fue?" className="input min-h-24" />
      <div>
        <p className="font-bold">¿Qué tal estuvo?</p>
        <div className="flex text-bosque -ml-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} type="button" whileTap={{ scale: 1.2 }} onClick={() => setCalificacion(n)} aria-label={`${n} ${n === 1 ? 'corazón' : 'corazones'}`} aria-pressed={n === calificacion} className="w-11 h-11 flex items-center justify-center">
              <Corazon className="w-8 h-8" lleno={n <= calificacion} />
            </motion.button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => setMapaAbierto(true)} className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left ${ubicacion ? 'border-bosque bg-seleccion' : 'border-dashed border-menta bg-tarjeta'}`}>
        {ubicacion ? <IconoCheck className="w-6 h-6 text-bosque shrink-0" /> : <IconoMapa className="w-6 h-6 text-bosque shrink-0" />}
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-bosque">{ubicacion ? 'En nuestro mapa' : 'Marcar en nuestro mapa'}</span>
          <span className="block text-sm text-salvia truncate">{ubicacion ? (ubicacion.direccion || ubicacion.nombre || 'Toca para cambiar') : 'Opcional: para que aparezca en Lugares'}</span>
        </span>
      </button>
      <AnimatePresence>
        {mapaAbierto && (
          <MapaLugar inicial={ubicacion} onClose={() => setMapaAbierto(false)}
            onPick={(l) => { setUbicacion(l); if (!lugar) setLugar(l.nombre); setMapaAbierto(false); }} />
        )}
      </AnimatePresence>

      {fotosExistentes.length > 0 && (
        <div>
          <p className="font-bold mb-1">Fotos y videos · toca uno para quitarlo</p>
          <div className="grid grid-cols-4 gap-2">
            {fotosExistentes.map((f) => (
              <button key={f.id} type="button" onClick={() => alternarQuitar(f.id)} className="relative aspect-square" aria-label={`${quitar.has(f.id) ? 'Dejar' : 'Quitar'} ${f.tipo === 'video' ? 'el video' : 'la foto'}`}>
                {f.tipo === 'video'
                  ? <span className={`w-full h-full rounded-xl bg-pino text-white flex items-center justify-center transition ${quitar.has(f.id) ? 'opacity-30' : ''}`}><IconoPlay className="w-7 h-7" /></span>
                  : <img src={f.url || undefined} alt="" className={`w-full h-full object-cover rounded-xl bg-seleccion transition ${quitar.has(f.id) ? 'opacity-30 grayscale' : ''}`} />}
                <span className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center ${quitar.has(f.id) ? 'bg-hondo text-white' : 'bg-tarjeta text-coral'}`}>
                  {quitar.has(f.id) ? <IconoMas className="w-3.5 h-3.5" /> : <IconoCerrar className="w-3.5 h-3.5" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {(cupo > 0 || cupoVideos > 0) && (
        <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-menta bg-seleccion/60 p-4 cursor-pointer active:bg-seleccion">
          <IconoCamara className="w-6 h-6 text-bosque shrink-0" />
          <span className="flex-1">
            <span className="block font-bold text-bosque">{nuevasFotos.length + nuevosVideos.length > 0
              ? [nuevasFotos.length && `${nuevasFotos.length} ${nuevasFotos.length === 1 ? 'foto' : 'fotos'}`, nuevosVideos.length && `${nuevosVideos.length} ${nuevosVideos.length === 1 ? 'video' : 'videos'}`].filter(Boolean).join(' y ') + ' por subir'
              : existente ? 'Agregar más fotos o videos' : 'Agregar fotos o videos'}</span>
            <span className="block text-sm text-salvia">
              {videosPesados > 0 ? `${videosPesados === 1 ? 'Un video pesa' : `${videosPesados} videos pesan`} más de ${MAX_MB_VIDEO} MB y no ${videosPesados === 1 ? 'cabe' : 'caben'}. `
                : sobran > 0 ? `No caben ${sobran} más; subo los primeros. ` : ''}
              Caben {cupo} {cupo === 1 ? 'foto' : 'fotos'} y {cupoVideos} {cupoVideos === 1 ? 'video' : 'videos'} (de hasta {MAX_MB_VIDEO} MB)
            </span>
          </span>
          <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
        </label>
      )}
      {vistas.length > 0 && (
        <div className="grid grid-cols-4 gap-2" aria-label="Fotos escogidas">
          {vistas.map((v) => <img key={v} src={v} alt="" className="w-full aspect-square object-cover rounded-xl" />)}
        </div>
      )}
      <button onClick={guardar} disabled={guardando || !titulo || !fecha} className="btn-primary">
        {guardando ? 'Guardando…' : existente ? 'Guardar cambios' : 'Guardar recuerdo'}
      </button>
    </div>
  );
}
