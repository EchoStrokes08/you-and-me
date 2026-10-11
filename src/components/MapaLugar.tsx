import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import { IconoCerrar, IconoCheck, IconoBuscar, IconoMira, IconoPin } from './ui';
import { BOGOTA, crearMapa, pinCorazon as pin } from '../lib/mapa';

export type LugarMapa = { nombre: string; direccion: string; lat: number; lng: number };

type Resultado = { display_name: string; name?: string; lat: string; lon: string };

const NOMINATIM = 'https://nominatim.openstreetmap.org';

const nombreCorto = (r: { name?: string; display_name: string }) => r.name || r.display_name.split(',')[0];
const direccionCorta = (d: string) => d.split(',').slice(0, 3).join(',').trim();

export default function MapaLugar({ inicial, onPick, onClose }: { inicial?: LugarMapa | null; onPick: (l: LugarMapa) => void; onClose: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);

  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<LugarMapa | null>(inicial ?? null);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [ubicando, setUbicando] = useState(false);

  const ponerPin = (lat: number, lng: number, volar = true) => {
    const m = mapa.current;
    if (!m) return;
    if (marcador.current) marcador.current.setLatLng([lat, lng]);
    else marcador.current = L.marker([lat, lng], { icon: pin }).addTo(m);
    if (volar) m.flyTo([lat, lng], Math.max(m.getZoom(), 16), { duration: 0.8 });
  };

  const elegirPunto = async (lat: number, lng: number) => {
    ponerPin(lat, lng, false);
    setElegido({ nombre: '', direccion: 'Buscando dirección…', lat, lng });
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&accept-language=es&lat=${lat}&lon=${lng}`).then((x) => x.json());
      const n = r?.name || r?.address?.amenity || r?.address?.road || 'Lugar en el mapa';
      setElegido({ nombre: n, direccion: direccionCorta(r?.display_name ?? ''), lat, lng });
      setNombre(n);
    } catch {
      setElegido({ nombre: 'Lugar en el mapa', direccion: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
      setNombre('Lugar en el mapa');
    }
  };

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = crearMapa(contenedor.current, inicial ? [inicial.lat, inicial.lng] : BOGOTA, inicial ? 16 : 12);
    m.on('click', (e: L.LeafletMouseEvent) => elegirPunto(e.latlng.lat, e.latlng.lng));
    mapa.current = m;
    if (inicial) ponerPin(inicial.lat, inicial.lng, false);
    // El overlay entra animado; recalcular tamaño cuando ya está visible
    setTimeout(() => m.invalidateSize(), 350);
    return () => { m.remove(); mapa.current = null; marcador.current = null; };
    // Solo al montar: `inicial` es la posición de arranque, cambios posteriores no deben recrear el mapa
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda con espera para no saturar Nominatim
  useEffect(() => {
    if (q.trim().length < 3) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const url = `${NOMINATIM}/search?format=jsonv2&accept-language=es&countrycodes=co&limit=6&viewbox=-74.35,4.95,-73.9,4.45&q=${encodeURIComponent(q)}`;
        setResultados(await fetch(url).then((x) => x.json()));
      } catch { setResultados([]); }
      setBuscando(false);
    }, 500);
    return () => clearTimeout(t);
  }, [q]);

  const elegirResultado = (r: Resultado) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    ponerPin(lat, lng);
    const n = nombreCorto(r);
    setElegido({ nombre: n, direccion: direccionCorta(r.display_name), lat, lng });
    setNombre(n);
    setResultados([]);
    setQ('');
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) return;
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setUbicando(false); mapa.current?.flyTo([p.coords.latitude, p.coords.longitude], 16); elegirPunto(p.coords.latitude, p.coords.longitude); },
      () => setUbicando(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Portal: un ancestro con transform (animaciones) rompería el position: fixed
  return createPortal(
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="mapa-selector fixed inset-0 z-[60] bg-crema flex flex-col">
      {/* Buscador */}
      <div className="absolute top-0 inset-x-0 z-[1000] px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="max-w-lg mx-auto flex gap-2">
          <div className="glass flex-1 rounded-2xl shadow-soft flex items-center gap-2 px-3">
            <IconoBuscar className="w-5 h-5 text-salvia shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un lugar, barrio o dirección"
              className="flex-1 bg-transparent py-3 outline-none text-sm font-semibold placeholder:text-salvia" />
            {buscando && <span className="w-4 h-4 rounded-full border-2 border-menta border-t-esmeralda animate-spin" />}
          </div>
          <button onClick={onClose} className="btn-icon w-12 h-12 shadow-soft" aria-label="Cerrar mapa"><IconoCerrar /></button>
        </div>
        <AnimatePresence>
          {resultados.length > 0 && (
            <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-lg mx-auto mt-2 card p-1.5 max-h-72 overflow-y-auto">
              {resultados.map((r, i) => (
                <li key={i}>
                  <button onClick={() => elegirResultado(r)} className="w-full text-left rounded-2xl px-3 py-2.5 active:bg-seleccion flex gap-3 items-start">
                    <IconoPin className="w-5 h-5 mt-0.5 text-bosque shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-bold text-sm truncate">{nombreCorto(r)}</span>
                      <span className="block text-sm text-salvia truncate">{direccionCorta(r.display_name)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <div ref={contenedor} className="flex-1 z-0" />

      <button onClick={miUbicacion} className="absolute right-3 bottom-[calc(13rem+env(safe-area-inset-bottom))] z-[1000] btn-icon w-11 h-11 shadow-soft" aria-label="Mi ubicación">
        {ubicando ? <span className="w-4 h-4 rounded-full border-2 border-menta border-t-esmeralda animate-spin" /> : <IconoMira className="w-5 h-5" />}
      </button>

      {/* Hoja inferior */}
      <div className="absolute bottom-0 inset-x-0 z-[1000] px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="card max-w-lg mx-auto p-4 flex flex-col gap-3 rounded-[1.75rem]">
          {elegido ? (
            <>
              <div>
                <p className="text-sm font-bold text-salvia">Lugar elegido</p>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="input mt-1 py-2 font-bold" placeholder="¿Cómo le decimos a este lugar?" />
                <p className="text-sm text-salvia mt-1 truncate">{elegido.direccion}</p>
              </div>
              <button onClick={() => onPick({ ...elegido, nombre: nombre.trim() || elegido.nombre || 'Lugar en el mapa' })} className="btn-primary">
                <IconoCheck /> Elegir este lugar
              </button>
            </>
          ) : (
            <div className="text-center py-1">
              <p className="font-titulo text-lg font-semibold">¿A dónde vamos?</p>
              <p className="text-sm text-salvia">Busca arriba o toca el mapa para poner el pin</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
