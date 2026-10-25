// Formulario para crear o editar un recuerdo de la historia: título, fecha, lugar (con mapa),
// calificación, fotos y videos, y lo guarda en la tabla recuerdos con sus fotos en Storage.
// Si no hay señal no lo pierde: deja el recuerdo en el teléfono (recuerdosPendientes) y lo sube al volver.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { fechaBonita, nombreLugar } from '../../lib/utils';
import { borrarFotos, esVideo, maxMbVideoAElegir, subirFotos, MAX_FOTOS, MAX_VIDEOS, type Foto } from '../../lib/fotos';
import type { Perfil } from '../../context/AuthContext';
import { useAvisos, sinConexion } from '../../lib/avisos';
import { esFallaDeRed, guardarPendiente } from '../../lib/recuerdosPendientes';
import { Corazon, IconoCamara, IconoCheck, IconoCerrar, IconoMapa, IconoMas, IconoPlay } from '../../components/ui';
import MapaLugar, { type LugarMapa } from '../../components/MapaLugar';
import type { CitaVivible, Recuerdo, RecuerdoInicial } from './tipos';

/** Qué se le pasa al formulario de recuerdos, tanto para crear como para editar. */
export type PropsFormRecuerdo = {
  perfil: Perfil | null;
  citas?: CitaVivible[];
  /** Algo a medio empezar: un sueno/reto ("guardarlo como recuerdo") o fotos compartidas */
  inicial?: RecuerdoInicial | null;
  citaInicial?: string | null;
  existente?: Recuerdo;
  fotosExistentes?: Foto[];
  onDone: (idNuevo?: string | null) => void;
  onCancelar?: () => void;
};

/** Crea un recuerdo nuevo o, con `existente`, edita uno (datos y fotos). */
export default function FormRecuerdo({ perfil, citas = [], inicial, citaInicial, existente, fotosExistentes = [], onDone, onCancelar }: PropsFormRecuerdo) {
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
  const [estadoSubida, setEstadoSubida] = useState('');

  const quedan = fotosExistentes.filter((f) => !quitar.has(f.id));
  const cupo = Math.max(0, MAX_FOTOS - quedan.filter((f) => f.tipo !== 'video').length);
  const cupoVideos = Math.max(0, MAX_VIDEOS - quedan.filter((f) => f.tipo === 'video').length);
  // Lo escogido, ya recortado a lo que cabe: fotos por un lado y videos por el otro
  const nuevasFotos = useMemo(() => archivos.filter((a) => !esVideo(a)).slice(0, cupo), [archivos, cupo]);
  const maxMb = maxMbVideoAElegir();
  const videosPesados = useMemo(() => archivos.filter((a) => esVideo(a) && a.size > maxMb * 1024 * 1024).length, [archivos, maxMb]);
  const nuevosVideos = useMemo(() => archivos.filter((a) => esVideo(a) && a.size <= maxMb * 1024 * 1024).slice(0, cupoVideos), [archivos, cupoVideos, maxMb]);
  const sobran = archivos.length - nuevasFotos.length - nuevosVideos.length - videosPesados;
  // Miniaturas de las fotos escogidas, para verlas antes de guardar
  const vistas = useMemo(() => nuevasFotos.map((a) => URL.createObjectURL(a)), [nuevasFotos]);
  useEffect(() => () => vistas.forEach((v) => URL.revokeObjectURL(v)), [vistas]);

  const elegirCita = (id: string) => {
    setCitaId(id);
    const c = citas.find((x) => x.id === id);
    if (c) { setFecha(c.fecha); setLugar(nombreLugar(c) ?? ''); setTitulo(c.actividades?.nombre ?? 'Nuestra cita'); }
    // La ubicación de la cita (mapa o catálogo) pasa al recuerdo
    const lat = c?.lugar_lat ?? c?.lugares?.lat, lng = c?.lugar_lng ?? c?.lugares?.lng;
    setUbicacion(c && lat != null && lng != null ? { nombre: nombreLugar(c) ?? '', direccion: c.lugar_direccion ?? '', lat, lng } : null);
  };

  // Se viene a guardar una cita en particular: queda escogida apenas llega la lista de citas
  const pendienteDeElegir = !!citaInicial && !citaId && citas.some((c) => c.id === citaInicial);
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
      const res = await supabase.from('recuerdos').insert({ ...campos, cita_id: citaId || null, creado_por: perfil?.id ?? '' }).select().single();
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
      const fallidas = await subirFotos(id, [...nuevasFotos, ...nuevosVideos], desde, setEstadoSubida);
      setEstadoSubida('');
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
          {citas.map((c) => <option key={c.id} value={c.id}>{fechaBonita(c.fecha)} · {nombreLugar(c)}</option>)}
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
              {videosPesados > 0 ? `${videosPesados === 1 ? 'Un video pesa' : `${videosPesados} videos pesan`} más de ${maxMb} MB y no ${videosPesados === 1 ? 'cabe' : 'caben'}. `
                : sobran > 0 ? `No caben ${sobran} más; subo los primeros. ` : ''}
              Caben {cupo} {cupo === 1 ? 'foto' : 'fotos'} y {cupoVideos} {cupoVideos === 1 ? 'video' : 'videos'} (de hasta {maxMb} MB)
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
        {guardando ? estadoSubida || 'Guardando…' : existente ? 'Guardar cambios' : 'Guardar recuerdo'}
      </button>
    </div>
  );
}
