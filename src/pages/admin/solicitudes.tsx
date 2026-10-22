import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fechaBonita, hoyStr, nombreLugar, linkMapa } from '../../lib/utils';
import { AnimatePresence } from 'framer-motion';
import { Hoja, Vacio, IconoBasura, IconoLapiz, IconoPin } from '../../components/ui';
import EditarCita from '../../components/EditarCita';
import TarjetaCita, { type Mirada } from '../../components/TarjetaCita';
import { useAvisos } from '../../lib/avisos';
import { useAuth } from '../../context/AuthContext';
import { tieneFecha, type CitaConFecha } from '../../lib/tipos';

// El otro: cómo se llama en la app y con qué rol y permiso ve las cosas
function useOtro() {
  const { perfil } = useAuth();
  const [otro, setOtro] = useState<{ nombre: string; mirada: Mirada } | null>(null);
  useEffect(() => {
    if (!perfil) return;
    Promise.all([
      supabase.from('perfiles').select('id, rol').neq('id', perfil.id).limit(1).maybeSingle(),
      supabase.from('permisos').select('usuario_id, es_admin'),
      supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single(),
    ]).then(([{ data: p }, { data: permisos }, { data: c }]) => {
      if (!p) return;
      setOtro({
        nombre: (perfil.rol === 'admin' ? c?.nombre_ella : c?.nombre_el) ?? 'tu amor',
        mirada: { id: p.id, rol: p.rol === 'admin' ? 'admin' : 'pareja', esAdmin: !!permisos?.find((x) => x.usuario_id === p.id)?.es_admin },
      });
    });
  }, [perfil]);
  return otro;
}

export function Solicitudes() {
  const { pedirTexto, revisar, aviso, confirmar: preguntar } = useAvisos();
  const { perfil } = useAuth();
  const otro = useOtro();
  const nombre = otro?.nombre ?? 'tu amor';
  const [citas, setCitas] = useState<CitaConFecha[]>([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [editando, setEditando] = useState<CitaConFecha | null>(null);
  const [viendo, setViendo] = useState<CitaConFecha | null>(null);
  const cargar = useCallback(async () => {
    // Lo mismo que pide Citas: con eso la vista previa arma la tarjeta igual
    const { data } = await supabase.from('citas').select('*, lugares(nombre,emoji,lat,lng), actividades(nombre), franjas(nombre), categorias_cita(nombre,emoji), recuerdos(id)').eq('estado', filtro).order('fecha');
    setCitas((data ?? []).filter(tieneFecha));
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const confirmar = async (c: CitaConFecha, hora: string, nota: string) => {
    const { error } = revisar(await supabase.from('citas').update({ estado: 'confirmada', hora_confirmada: hora || null, nota_admin: nota || null, modificada: false }).eq('id', c.id), 'No pude confirmar la cita');
    if (!error) aviso('Cita confirmada ✅');
    cargar();
  };
  const cancelar = async (c: CitaConFecha) => {
    // null = tocó "Volver": la cita queda como estaba
    const msg = await pedirTexto({ titulo: '¿Cancelar esta cita?', texto: `${nombre} verá el mensaje en la cita.`, placeholder: `Mensaje para ${nombre} (opcional)`, boton: 'Cancelar cita', peligro: true });
    if (msg === null) return;
    const { error } = revisar(await supabase.from('citas').update({ estado: 'cancelada', nota_admin: msg.trim() || null }).eq('id', c.id), 'No pude cancelar la cita');
    if (!error) aviso('Cita cancelada');
    cargar();
  };
  // Solo las canceladas: las de prueba o repetidas que no vale la pena guardar
  const borrar = async (c: CitaConFecha) => {
    if (!(await preguntar({ titulo: '¿Borrar esta cita del todo?', texto: 'Desaparece para los dos y no se puede deshacer.', boton: 'Borrar', peligro: true }))) return;
    const { error } = revisar(await supabase.from('citas').delete().eq('id', c.id), 'No pude borrar la cita');
    if (!error) aviso('Cita borrada');
    cargar();
  };
  const nada = () => {};

  return (
    <div className="flex flex-col gap-3">
      <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="input">
        <option value="pendiente">Pendientes</option>
        <option value="confirmada">Confirmadas</option>
        <option value="vivida">Vividas</option>
        <option value="cancelada">Canceladas</option>
      </select>
      {citas.map((c) => <SolicitudCard key={c.id} c={c} propia={c.creada_por === perfil?.id} nombre={nombre} onConfirmar={confirmar} onCancelar={cancelar} onBorrar={() => borrar(c)} onEditar={() => setEditando(c)} onVer={otro ? () => setViendo(c) : undefined} />)}
      <AnimatePresence>
        {editando && <EditarCita cita={editando} onClose={() => setEditando(null)} onSaved={cargar} />}
      </AnimatePresence>
      <Hoja abierta={!!viendo} onClose={() => setViendo(null)} titulo={`Así la ve ${nombre}`}>
        {viendo && otro && (
          <>
            <div inert>
              <TarjetaCita c={viendo} perfil={otro.mirada} pasada={viendo.estado === 'confirmada' && viendo.fecha < hoyStr()} onEditar={nada} onCancelar={nada} onResponder={nada} onVivida={nada} />
            </div>
            <p className="text-sm text-salvia text-center">Es solo una vista: aquí los botones no hacen nada.</p>
          </>
        )}
      </Hoja>
      {citas.length === 0 && <Vacio titulo="Nada por aquí" texto="Mar en calma." />}
    </div>
  );
}

function SolicitudCard({ c, propia, nombre, onConfirmar, onCancelar, onBorrar, onEditar, onVer }: {
  c: CitaConFecha; propia: boolean; nombre: string;
  onConfirmar: (c: CitaConFecha, hora: string, nota: string) => void; onCancelar: (c: CitaConFecha) => void;
  onBorrar: () => void; onEditar: () => void; onVer?: () => void;
}) {
  const [hora, setHora] = useState(c.hora_confirmada ?? '');
  const [nota, setNota] = useState(c.nota_admin ?? '');
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-titulo text-xl font-semibold leading-tight">{c.es_cita_sorpresa ? 'Cita sorpresa' : `${c.categorias_cita?.nombre} · ${nombreLugar(c) ?? ''}`}</p>
        {['pendiente', 'confirmada'].includes(c.estado) && <button onClick={onEditar} className="chip px-3 text-sm shrink-0"><IconoLapiz className="w-4 h-4" /> Editar</button>}
      </div>
      {c.modificada && c.estado === 'pendiente' && <span className="badge bg-durazno/35 text-coral self-start text-sm">{nombre} la modificó: revisa y confirma</span>}
      <p>{[c.actividades?.nombre, c.franjas?.nombre, fechaBonita(c.fecha)].filter(Boolean).join(' · ')}</p>
      {linkMapa(c) && (
        <a href={linkMapa(c)!} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 min-h-11 text-sm text-bosque font-bold"><IconoPin className="w-4 h-4 shrink-0" /> {c.lugar_direccion || 'Ver en el mapa'}</a>
      )}
      {c.nota_ella && <p className="font-titulo italic text-lg leading-snug">“{c.nota_ella}”</p>}
      {onVer && ['pendiente', 'confirmada'].includes(c.estado) && (
        <button onClick={onVer} className="chip px-3 text-sm self-start">Ver como la ve {nombre}</button>
      )}
      {c.estado === 'cancelada' && (
        <button onClick={onBorrar} className="btn-soft text-coral"><IconoBasura className="w-4 h-4" /> Borrar del todo</button>
      )}
      {/* Las que uno crea las acepta el otro */}
      {c.estado === 'pendiente' && propia && (
        <>
          <span className="badge bg-espuma text-oceano self-start text-sm">Tu invitación: esperando que {nombre} la acepte</span>
          <button onClick={() => onCancelar(c)} className="btn-soft text-coral">Cancelar</button>
        </>
      )}
      {c.estado === 'pendiente' && !propia && (
        <>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora de la cita" className="input" />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" aria-label={`Nota para ${nombre}`} className="input" />
          <div className="flex gap-2">
            <button onClick={() => onConfirmar(c, hora, nota)} className="flex-1 btn-primary">Confirmar</button>
            <button onClick={() => onCancelar(c)} className="flex-1 btn-soft text-coral">Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
