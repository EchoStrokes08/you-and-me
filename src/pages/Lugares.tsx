import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { crearMapa, pinBallena, type TipoPin } from '../lib/mapa';
import { diasEntre, fechaStr, hoy } from '../lib/utils';
import Ballena from '../components/Ballena';
import { Corazon, IconoCerrar, IconoFlecha, Segmented } from '../components/ui';

export type Visita = {
  id: string;
  tipo: 'recuerdo' | 'vivida' | 'proxima';
  fecha: string;
  titulo: string;
  calificacion?: number;
};

export type Punto = {
  key: string;
  lat: number;
  lng: number;
  nombre: string;
  emoji: string;
  direccion?: string | null;
  visitas: Visita[]; // de la más reciente a la más antigua
};

const tipoPunto = (p: Punto): TipoPin => (p.visitas.some((v) => v.tipo !== 'proxima') ? 'vivido' : 'proximo');
const fechaCorta = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const linkMaps = (p: Punto) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/* ---------- Datos ---------- */

async function cargarPuntos(): Promise<Punto[]> {
  const hoyS = fechaStr(hoy());
  const [{ data: recs }, { data: citas }] = await Promise.all([
    supabase.from('recuerdos').select('id, titulo, fecha, calificacion, lugar_texto, lat, lng, cita_id, citas(lugar_personalizado, lugar_direccion, lugar_lat, lugar_lng, lugares(nombre, emoji, lat, lng))'),
    supabase.from('citas').select('id, fecha, estado, lugar_personalizado, lugar_direccion, lugar_lat, lugar_lng, lugares(nombre, emoji, lat, lng), actividades(nombre), categorias_cita(nombre)').in('estado', ['confirmada', 'vivida']),
  ]);

  // Agrupa por coordenada redondeada (~10 m): el mismo sitio visitado varias veces es un solo pin
  const puntos = new Map<string, Punto>();
  const agregar = (lat: number | null | undefined, lng: number | null | undefined, base: Omit<Punto, 'key' | 'lat' | 'lng' | 'visitas'>, v: Visita) => {
    if (lat == null || lng == null) return;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const p = puntos.get(key) ?? { key, lat, lng, ...base, visitas: [] };
    p.visitas.push(v);
    puntos.set(key, p);
  };

  const citasConRecuerdo = new Set<string>();
  for (const r of (recs ?? []) as any[]) {
    const c = r.citas;
    const l = c?.lugares;
    if (r.cita_id) citasConRecuerdo.add(r.cita_id);
    agregar(
      r.lat ?? c?.lugar_lat ?? l?.lat,
      r.lng ?? c?.lugar_lng ?? l?.lng,
      { nombre: l?.nombre ?? c?.lugar_personalizado ?? (r.lugar_texto || 'Nuestro lugar'), emoji: l?.emoji ?? '📍', direccion: c?.lugar_direccion },
      { id: r.id, tipo: 'recuerdo', fecha: r.fecha, titulo: r.titulo, calificacion: r.calificacion },
    );
  }
  for (const c of (citas ?? []) as any[]) {
    if (citasConRecuerdo.has(c.id)) continue;
    const l = c.lugares;
    agregar(
      c.lugar_lat ?? l?.lat,
      c.lugar_lng ?? l?.lng,
      { nombre: l?.nombre ?? c.lugar_personalizado ?? 'Nuestro lugar', emoji: l?.emoji ?? '📍', direccion: c.lugar_direccion },
      { id: c.id, tipo: c.estado === 'confirmada' && c.fecha >= hoyS ? 'proxima' : 'vivida', fecha: c.fecha, titulo: c.actividades?.nombre ?? c.categorias_cita?.nombre ?? 'Nuestra cita' },
    );
  }
  const lista = [...puntos.values()];
  for (const p of lista) p.visitas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return lista;
}

async function primeraFoto(recuerdoId: string): Promise<string | null> {
  const { data } = await supabase.from('fotos_recuerdo').select('ruta').eq('recuerdo_id', recuerdoId).order('orden').limit(1).maybeSingle();
  if (!data) return null;
  const { data: u } = await supabase.storage.from('recuerdos').createSignedUrl(data.ruta, 3600);
  return u?.signedUrl ?? null;
}

export default function Lugares() {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { cargarPuntos().then((p) => { setPuntos(p); setCargando(false); }); }, []);
  return <MapaNuestrosLugares puntos={puntos} cargando={cargando} cargarFoto={primeraFoto} />;
}

/* ---------- Vista ---------- */

type Filtro = 'todos' | 'vividos' | 'proximos';

export function MapaNuestrosLugares({ puntos, cargando, cargarFoto }: { puntos: Punto[]; cargando: boolean; cargarFoto: (recuerdoId: string) => Promise<string | null> }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadrado = useRef(false);

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  const visibles = useMemo(() => puntos.filter((p) =>
    filtro === 'todos' ? true : filtro === 'vividos' ? tipoPunto(p) === 'vivido' : p.visitas.some((v) => v.tipo === 'proxima'),
  ), [puntos, filtro]);
  const sel = visibles.find((p) => p.key === selKey) ?? null;

  const lugaresVividos = puntos.filter((p) => tipoPunto(p) === 'vivido').length;
  const citasVividas = puntos.reduce((n, p) => n + p.visitas.filter((v) => v.tipo !== 'proxima').length, 0);

  // Mapa
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = crearMapa(contenedor.current);
    // Tocar el mapa (no un pin) cierra la ficha
    m.on('click', (e: L.LeafletMouseEvent) => {
      if ((e.originalEvent?.target as HTMLElement | null)?.closest('.leaflet-marker-icon')) return;
      setSelKey(null);
    });
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); mapa.current = null; capa.current = null; };
  }, []);

  // Pines
  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const p of visibles) {
      L.marker([p.lat, p.lng], { icon: pinBallena(tipoPunto(p), p.visitas.length, p.key === selKey), zIndexOffset: p.key === selKey ? 1000 : 0, title: p.nombre })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); setSelKey(p.key); })
        .addTo(g);
    }
    if (!encuadrado.current && puntos.length > 0) {
      encuadrado.current = true;
      if (puntos.length === 1) m.setView([puntos[0].lat, puntos[0].lng], 14);
      else m.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { paddingTopLeft: [40, 190], paddingBottomRight: [40, 260], maxZoom: 15 });
    }
  }, [visibles, selKey, puntos]);

  // Al elegir un lugar: volar hacia él (dejando espacio para la hoja inferior) y traer la foto
  useEffect(() => {
    setFoto(null);
    if (!sel) return;
    const m = mapa.current;
    if (m) {
      const z = Math.max(m.getZoom(), 14);
      const destino = m.unproject(m.project([sel.lat, sel.lng], z).add([0, 110]), z);
      m.flyTo(destino, z, { duration: 0.7 });
    }
    const conFoto = sel.visitas.find((v) => v.tipo === 'recuerdo');
    let vigente = true;
    if (conFoto) cargarFoto(conFoto.id).then((u) => { if (vigente) setFoto(u); });
    return () => { vigente = false; };
    // selKey identifica el lugar elegido: solo se vuela cuando cambia la selección
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);

  const recientes = [...visibles].sort((a, b) => b.visitas[0].fecha.localeCompare(a.visitas[0].fecha));

  return (
    <div className="mapa-recuerdos fixed inset-0">
      <div ref={contenedor} className="absolute inset-0 z-0" />

      {/* Encabezado */}
      <div className="absolute top-0 inset-x-0 z-[1000] px-4 pt-[max(env(safe-area-inset-top),14px)] pointer-events-none">
        <div className="glass pointer-events-auto max-w-lg mx-auto rounded-[1.75rem] shadow-soft p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="eyebrow">Donde hemos ido</p>
              <h1 className="text-[1.7rem] leading-tight font-bold">Nuestros lugares</h1>
            </div>
            <Ballena className="w-16 shrink-0" />
          </div>
          {puntos.length > 0 && (
            <div className="flex gap-2 -mt-1">
              <span className="badge bg-seleccion text-bosque border border-menta">🐋 {lugaresVividos} {lugaresVividos === 1 ? 'lugar' : 'lugares'}</span>
              <span className="badge bg-seleccion text-bosque border border-menta">💚 {citasVividas} {citasVividas === 1 ? 'cita vivida' : 'citas vividas'}</span>
            </div>
          )}
          <Segmented id="filtro-lugares" value={filtro} onChange={(f) => { setFiltro(f); setSelKey(null); }} options={[['todos', 'Todos'], ['vividos', 'Vividos'], ['proximos', 'Próximos']] as const} />
        </div>
      </div>

      {/* Parte inferior: detalle del lugar o carrusel */}
      <div className="absolute inset-x-0 z-[1000] bottom-[calc(max(env(safe-area-inset-bottom),14px)+80px)] pointer-events-none">
        <AnimatePresence mode="wait">
          {sel ? (
            <motion.div key={sel.key} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="px-4 pointer-events-auto">
              <DetalleLugar p={sel} foto={foto} onClose={() => setSelKey(null)} />
            </motion.div>
          ) : recientes.length > 0 ? (
            <motion.div key="carrusel" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="pointer-events-auto flex gap-3 overflow-x-auto snap-x px-4 pb-1 [scrollbar-width:none] max-w-lg mx-auto">
              {recientes.map((p) => (
                <button key={p.key} onClick={() => setSelKey(p.key)} className="card snap-start shrink-0 w-60 p-3 text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
                  <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xl ${tipoPunto(p) === 'vivido' ? 'bg-gradient-to-br from-esmeralda to-hondo' : 'bg-espuma'}`}>{p.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-extrabold text-sm truncate">{p.nombre}</span>
                    <span className="block text-xs text-salvia truncate">
                      {tipoPunto(p) === 'proximo' ? `Próxima · ${fechaCorta(p.visitas[0].fecha)}` : `${p.visitas.length} ${p.visitas.length === 1 ? 'visita' : 'visitas'} · ${fechaCorta(p.visitas[0].fecha)}`}
                    </span>
                  </span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mapa vacío */}
      {!cargando && visibles.length === 0 && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center px-6 pointer-events-none">
          <div className="card pointer-events-auto max-w-sm text-center flex flex-col items-center gap-1 mt-24">
            <Ballena className="w-28 mb-1" />
            <p className="font-titulo text-xl font-semibold">{puntos.length === 0 ? 'Nuestro mapa está esperando' : filtro === 'proximos' ? 'No hay citas próximas' : 'Aún no hay lugares vividos'}</p>
            <p className="text-sm text-salvia">Cada cita confirmada y cada recuerdo dejan una ballenita en el mapa 🌊</p>
            <Link to="/citas" className="btn-primary mt-3 w-full">Planear una cita ✨</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalleLugar({ p, foto, onClose }: { p: Punto; foto: string | null; onClose: () => void }) {
  const vividas = p.visitas.filter((v) => v.tipo !== 'proxima').length;
  const hayRecuerdo = p.visitas.some((v) => v.tipo === 'recuerdo');
  return (
    <div className="card max-w-lg mx-auto p-0 overflow-hidden">
      <AnimatePresence>
        {foto && (
          <motion.div initial={{ height: 0 }} animate={{ height: 128 }} className="relative overflow-hidden">
            <img src={foto} className="w-full h-32 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-pino/50 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 shrink-0 rounded-2xl bg-seleccion border border-menta flex items-center justify-center text-2xl">{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-titulo text-xl font-semibold leading-tight">{p.nombre}</p>
            <p className="text-xs text-salvia">
              {vividas > 0 ? (vividas === 1 ? 'Hemos venido una vez' : `Hemos venido ${vividas} veces`) : 'Aún no hemos venido juntos'}
              {p.direccion ? ` · ${p.direccion}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon w-9 h-9 shrink-0" aria-label="Cerrar"><IconoCerrar className="w-4 h-4" /></button>
        </div>

        <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {p.visitas.map((v) => {
            const d = new Date(v.fecha + 'T00:00:00');
            const faltan = diasEntre(v.fecha);
            return (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-crema border border-menta/70 px-3 py-2">
                <span className="shrink-0 w-10 text-center">
                  <span className="block text-[9px] font-extrabold uppercase text-salvia">{d.toLocaleDateString('es-CO', { month: 'short' })}</span>
                  <span className="block font-titulo font-bold text-bosque leading-none">{d.getDate()}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{v.titulo}</span>
                  {v.tipo === 'recuerdo' && (
                    <span className="flex text-esmeralda">{[1, 2, 3, 4, 5].map((n) => <Corazon key={n} className="w-3 h-3" lleno={n <= (v.calificacion ?? 0)} />)}</span>
                  )}
                  {v.tipo === 'proxima' && <span className="block text-xs font-bold text-esmeralda">{faltan === 0 ? '¡Es hoy! 🎉' : `Faltan ${faltan} ${faltan === 1 ? 'día' : 'días'}`}</span>}
                  {v.tipo === 'vivida' && <Link to="/historia" className="block text-xs font-bold text-coral">Guardar como recuerdo 📸</Link>}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <a href={linkMaps(p)} target="_blank" rel="noreferrer" className="btn-soft flex-1 py-2.5">📍 Cómo llegar</a>
          {hayRecuerdo && <Link to="/historia" className="btn-primary flex-1 py-2.5">Recuerdos <IconoFlecha /></Link>}
        </div>
      </div>
    </div>
  );
}
