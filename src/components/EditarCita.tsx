import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, fechaStr, hoy, diasLabel } from '../lib/utils';
import { Calendario } from './CitaWizard';
import MapaLugar, { type LugarMapa } from './MapaLugar';
import { IconoCerrar } from './ui';

type LugarSel = { tipo: 'catalogo'; id: string } | { tipo: 'mapa'; l: LugarMapa } | { tipo: 'ninguno' };

/** Hoja para corregir una cita pendiente o confirmada */
export default function EditarCita({ cita, onClose, onSaved }: { cita: any; onClose: () => void; onSaved: () => void }) {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const vuelveAPendiente = !esAdmin && cita.estado === 'confirmada';

  const [lugares, setLugares] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [franjas, setFranjas] = useState<any[]>([]);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [bloqueadas, setBloqueadas] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<any>(null);

  const [fecha, setFecha] = useState<string>(cita.fecha ?? '');
  const [franjaId, setFranjaId] = useState<string>(cita.franja_id ?? '');
  const [hora, setHora] = useState<string>(cita.hora_confirmada?.slice(0, 5) ?? '');
  const [lugar, setLugar] = useState<LugarSel>(
    cita.lugar_id ? { tipo: 'catalogo', id: cita.lugar_id }
      : cita.lugar_lat != null ? { tipo: 'mapa', l: { nombre: cita.lugar_personalizado ?? '', direccion: cita.lugar_direccion ?? '', lat: cita.lugar_lat, lng: cita.lugar_lng } }
        : { tipo: 'ninguno' },
  );
  const [actividadId, setActividadId] = useState<string>(cita.actividad_id ?? '');
  const [nota, setNota] = useState<string>((esAdmin ? cita.nota_admin : cita.nota_ella) ?? '');
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    supabase.from('lugares').select('*').eq('activo', true).eq('es_sorpresa', false).order('orden').then(({ data }) => setLugares(data ?? []));
    supabase.from('actividades').select('*').eq('activo', true).order('orden').then(({ data }) => setActividades(data ?? []));
    supabase.from('franjas').select('*').eq('activo', true).order('orden').then(({ data }) => setFranjas(data ?? []));
    supabase.from('lugar_actividad').select('*').then(({ data }) => setVinculos(data ?? []));
    supabase.from('fechas_no_disponibles').select('fecha').then(({ data }) => setBloqueadas(new Set((data ?? []).map((d) => d.fecha))));
    supabase.from('configuracion').select('whatsapp, whatsapp_ella').eq('id', 1).single().then(({ data }) => setConfig(data));
  }, []);

  // Si él edita, el aviso va a ella; si ella edita, va a él
  const waDestino = esAdmin ? config?.whatsapp_ella : config?.whatsapp;

  const actividad = actividades.find((a) => a.id === actividadId);
  const actividadesFiltradas = useMemo(() => {
    if (lugar.tipo !== 'catalogo') return actividades;
    const vinc = new Set(vinculos.filter((v) => v.lugar_id === lugar.id).map((v) => v.actividad_id));
    return actividades.filter((a) => a.es_comodin || a.es_sorpresa || vinc.has(a.id) || a.id === cita.actividad_id);
  }, [lugar, actividades, vinculos, cita.actividad_id]);

  const fechaBloqueada = (d: Date) => {
    const s = fechaStr(d);
    if (s === cita.fecha) return null; // su fecha actual siempre se puede conservar
    if (d < hoy()) return 'Ese día ya pasó 😢';
    if (d > new Date(hoy().getTime() + 60 * 86400000)) return 'Muy lejos 🌿';
    if (bloqueadas.has(s)) return 'Ese día no se puede 😢';
    if (actividad?.dias_permitidos && !actividad.dias_permitidos.includes(d.getDay()))
      return `Solo se puede ${diasLabel(actividad.dias_permitidos)} 🗓️`;
    return null;
  };

  const nombreLugarSel = lugar.tipo === 'catalogo' ? lugares.find((l) => l.id === lugar.id)?.nombre : lugar.tipo === 'mapa' ? lugar.l.nombre : undefined;

  const guardar = async () => {
    if (!fecha || !franjaId) { setError('Escoge el día y el momento 🙏'); return; }
    setGuardando(true);
    setError('');
    const cambios: Record<string, any> = { fecha, franja_id: franjaId };
    if (!cita.es_cita_sorpresa) {
      Object.assign(cambios, {
        lugar_id: lugar.tipo === 'catalogo' ? lugar.id : null,
        lugar_personalizado: lugar.tipo === 'mapa' ? lugar.l.nombre : null,
        lugar_direccion: lugar.tipo === 'mapa' ? lugar.l.direccion : null,
        lugar_lat: lugar.tipo === 'mapa' ? lugar.l.lat : null,
        lugar_lng: lugar.tipo === 'mapa' ? lugar.l.lng : null,
        actividad_id: actividadId || null,
      });
    }
    if (esAdmin) {
      Object.assign(cambios, { hora_confirmada: hora || null, nota_admin: nota || null });
      if (cita.estado === 'confirmada') cambios.modificada = true;
    } else {
      cambios.nota_ella = nota || null;
      if (vuelveAPendiente) Object.assign(cambios, { estado: 'pendiente', modificada: true, hora_confirmada: null });
    }
    const { error: e } = await supabase.from('citas').update(cambios).eq('id', cita.id);
    setGuardando(false);
    if (e) { setError('No pude guardar los cambios 😢 Intenta de nuevo.'); return; }
    onSaved();
    if (vuelveAPendiente) setListo(true);
    else onClose();
  };

  const avisoTxt = () => {
    const fr = franjas.find((f) => f.id === franjaId)?.nombre ?? '';
    return `Cambié nuestra cita ✏️💚\n${cita.es_cita_sorpresa ? '🎁 Cita sorpresa' : nombreLugarSel ?? ''}${actividad ? `\n${actividad.nombre}` : ''}\n${fechaBonita(fecha)} · ${fr}${nota ? `\nNota: ${nota}` : ''}\n¿Me la confirmas?`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-pino/55" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-crema rounded-t-[2rem] shadow-soft">
        <div className="sticky top-0 z-10 bg-crema px-5 pt-3 pb-3 flex flex-col items-center">
          <span className="w-10 h-1.5 rounded-full bg-menta mb-3" />
          <div className="w-full flex items-center gap-3">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Modificar cita</h2>
              <p className="text-sm text-salvia">{cita.estado === 'confirmada' ? 'Cita confirmada' : 'Cita por confirmar'}</p>
            </div>
            <button onClick={onClose} className="btn-icon" aria-label="Cerrar"><IconoCerrar /></button>
          </div>
        </div>

        {listo ? (
          <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-3 text-center">
            <p className="font-titulo text-2xl font-semibold mt-2">¡Cambios guardados!</p>
            <p className="text-sm text-salvia">La cita volvió a <b className="text-bosque">Por confirmar</b> para que la revise.</p>
            {waDestino && (
              <a href={`https://wa.me/${waDestino}?text=${encodeURIComponent(avisoTxt())}`} target="_blank" rel="noreferrer" className="btn-primary mt-2">Avisarle del cambio</a>
            )}
            <button onClick={onClose} className="btn-soft">Listo</button>
          </div>
        ) : (
          <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] flex flex-col gap-4">
            {vuelveAPendiente && (
              <p className="text-sm rounded-2xl bg-durazno/25 border border-durazno/50 px-3 py-2 text-bosque-oscuro">
                Al guardar, la cita vuelve a <b>Por confirmar</b> para que él vea los cambios 💚
              </p>
            )}

            <section className="flex flex-col gap-2">
              <p className="eyebrow">Día</p>
              <Calendario onPick={setFecha} fecha={fecha} fechaBloqueada={fechaBloqueada} mesInicial={cita.fecha} />
              {fecha && <p className="text-sm font-bold text-bosque text-center first-letter:uppercase">{fechaBonita(fecha)}</p>}
            </section>

            <section className="flex flex-col gap-2">
              <p className="eyebrow">Momento del día</p>
              <div className="flex flex-wrap gap-2">
                {franjas.map((f) => (
                  <button key={f.id} onClick={() => setFranjaId(f.id)} data-active={franjaId === f.id} className="chip">{f.emoji} {f.nombre} <span className="text-xs opacity-70">{f.horario}</span></button>
                ))}
              </div>
              {esAdmin && cita.estado === 'confirmada' && (
                <label className="text-sm font-extrabold text-bosque-oscuro mt-1">Hora
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input mt-1" />
                </label>
              )}
            </section>

            {!cita.es_cita_sorpresa && (
              <>
                <section className="flex flex-col gap-2">
                  <p className="eyebrow">Lugar</p>
                  <select className="input" value={lugar.tipo === 'catalogo' ? lugar.id : lugar.tipo === 'mapa' ? '__mapa' : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__mapa') { setMapaAbierto(true); return; }
                      setLugar(v ? { tipo: 'catalogo', id: v } : { tipo: 'ninguno' });
                      setActividadId('');
                    }}>
                    <option value="">— Sin lugar —</option>
                    {lugares.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.nombre}</option>)}
                    <option value="__mapa">{lugar.tipo === 'mapa' ? `🗺️ ${lugar.l.nombre} (mapa)` : '🗺️ Otro lugar en el mapa…'}</option>
                  </select>
                  {lugar.tipo === 'mapa' && (
                    <button onClick={() => setMapaAbierto(true)} className="text-left text-sm text-salvia truncate min-h-11">{lugar.l.direccion || lugar.l.nombre} · <span className="font-bold text-bosque">cambiar</span></button>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <p className="eyebrow">Actividad</p>
                  <select className="input" value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
                    <option value="">— Sin actividad / sorpresa —</option>
                    {actividadesFiltradas.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.nombre}</option>)}
                  </select>
                  {actividad && fecha && fechaBloqueada(new Date(fecha + 'T00:00:00')) && (
                    <p role="alert" className="text-sm font-bold text-coral">{fechaBloqueada(new Date(fecha + 'T00:00:00'))}</p>
                  )}
                </section>
              </>
            )}

            <section className="flex flex-col gap-2">
              <p className="eyebrow">{esAdmin ? 'Tu nota para ella' : 'Nota'}</p>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder={esAdmin ? 'Ej: cambiamos la hora por la lluvia ☔' : '¿Por qué el cambio? ¿Algo más?'} className="input min-h-20" />
            </section>

            {error && <p className="text-sm font-bold text-coral text-center">{error}</p>}
            <div className="sticky bottom-0 -mx-5 px-5 pt-2 pb-1 bg-gradient-to-t from-crema via-crema to-crema/0 flex gap-2">
              <button onClick={onClose} className="btn-soft flex-1">Descartar</button>
              <button onClick={guardar} disabled={guardando} className="btn-primary flex-[2]">{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {mapaAbierto && (
          <MapaLugar inicial={lugar.tipo === 'mapa' ? lugar.l : null} onClose={() => setMapaAbierto(false)}
            onPick={(l) => { setLugar({ tipo: 'mapa', l }); setActividadId(''); setMapaAbierto(false); }} />
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
