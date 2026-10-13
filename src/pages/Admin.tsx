import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fechaBonita, hoyStr, nombreLugar, linkMapa } from '../lib/utils';
import { claveLugar, type PorConocer } from '../lib/porConocer';
import { AnimatePresence } from 'framer-motion';
import DiasNoPuedo from '../components/DiasNoPuedo';
import { Encabezado, Hoja, Segmented, Vacio, IconoAtras, IconoBasura, IconoCalendario, IconoCamara, IconoCampana, IconoLapiz, IconoPin } from '../components/ui';
import MapaLugar from '../components/MapaLugar';
import EditarCita from '../components/EditarCita';
import TarjetaCita, { type Mirada } from '../components/TarjetaCita';
import { useAvisos } from '../lib/avisos';
import { useAuth } from '../context/AuthContext';

// Postgres: no se puede borrar porque otra fila la usa (foreign key)
const EN_USO = '23503';

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
        mirada: { id: p.id, rol: p.rol, esAdmin: !!permisos?.find((x) => x.usuario_id === p.id)?.es_admin },
      });
    });
  }, [perfil]);
  return otro;
}

export default function Admin() {
  const [tab, setTab] = useState<'solicitudes' | 'catalogos' | 'preguntas' | 'fechas' | 'config'>('solicitudes');
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Detrás del telón" titulo="Panel" />
      <Segmented id="tabs-admin" value={tab} onChange={setTab} options={[['solicitudes', 'Solicitudes'], ['catalogos', 'Catálogos'], ['preguntas', 'Preguntas'], ['fechas', 'Fechas'], ['config', 'Config']] as const} />
      {tab === 'solicitudes' && <Solicitudes />}
      {tab === 'catalogos' && <Catalogos />}
      {tab === 'preguntas' && <AdminPreguntas />}
      {tab === 'fechas' && <Fechas />}
      {tab === 'config' && <Config />}
    </div>
  );
}

function Solicitudes() {
  const { pedirTexto, revisar, aviso, confirmar: preguntar } = useAvisos();
  const { perfil } = useAuth();
  const otro = useOtro();
  const nombre = otro?.nombre ?? 'tu amor';
  const [citas, setCitas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [editando, setEditando] = useState<any>(null);
  const [viendo, setViendo] = useState<any>(null);
  const cargar = useCallback(async () => {
    // Lo mismo que pide Citas: con eso la vista previa arma la tarjeta igual
    const { data } = await supabase.from('citas').select('*, lugares(nombre,emoji,lat,lng), actividades(nombre), franjas(nombre), categorias_cita(nombre,emoji), recuerdos(id)').eq('estado', filtro).order('fecha');
    setCitas(data ?? []);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const confirmar = async (c: any, hora: string, nota: string) => {
    const { error } = revisar(await supabase.from('citas').update({ estado: 'confirmada', hora_confirmada: hora || null, nota_admin: nota || null, modificada: false }).eq('id', c.id), 'No pude confirmar la cita');
    if (!error) aviso('Cita confirmada ✅');
    cargar();
  };
  const cancelar = async (c: any) => {
    // null = tocó "Volver": la cita queda como estaba
    const msg = await pedirTexto({ titulo: '¿Cancelar esta cita?', texto: `${nombre} verá el mensaje en la cita.`, placeholder: `Mensaje para ${nombre} (opcional)`, boton: 'Cancelar cita', peligro: true });
    if (msg === null) return;
    const { error } = revisar(await supabase.from('citas').update({ estado: 'cancelada', nota_admin: msg.trim() || null }).eq('id', c.id), 'No pude cancelar la cita');
    if (!error) aviso('Cita cancelada');
    cargar();
  };
  // Solo las canceladas: las de prueba o repetidas que no vale la pena guardar
  const borrar = async (c: any) => {
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

function SolicitudCard({ c, propia, nombre, onConfirmar, onCancelar, onBorrar, onEditar, onVer }: any) {
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

/* ---------- Catálogos ---------- */

type Campo = [clave: string, etiqueta: string, tipo?: 'textarea' | 'precio' | 'tipo-llevar' | 'tipos-plan' | 'momentos' | 'si-no'];
// Qué se puede editar de cada catálogo (el slug de las categorías no: lo usan las citas)
const CAMPOS: Record<string, Campo[]> = {
  categorias_cita: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea']],
  lugares: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['zona', 'Zona'], ['descripcion', 'Descripción', 'textarea'], ['duracion', 'Duración'], ['precio', 'Precio', 'precio'], ['categorias', 'Tipos de plan', 'tipos-plan']],
  // Con esto el asistente arma citas con sentido: una idea solo sale en los lugares donde está anotada
  // o, si es general, en los de su mismo tipo de plan; y a una hora en que se pueda hacer
  actividades: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['nota', 'Nota'], ['precio', 'Precio', 'precio'],
    ['categorias', 'Tipos de plan', 'tipos-plan'], ['es_comodin', 'Sirve en cualquier lugar de esos tipos de plan', 'si-no'], ['franjas_permitidas', 'Momentos del día (ninguno = cualquiera)', 'momentos']],
  franjas: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['horario', 'Horario']],
  opciones_llevar: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['tipo', 'Tipo', 'tipo-llevar']],
};

// Con qué columna de la cita se cuenta el uso de cada catálogo (qué llevar va aparte: vestimenta y detalles)
const CAMPO_EN_CITA: Record<string, string> = { lugares: 'lugar_id', actividades: 'actividad_id', franjas: 'franja_id', categorias_cita: 'categoria_slug' };

// Las categorías usan slug como llave; el resto, id
const llave = (it: any): [string, string] => ('id' in it ? ['id', it.id] : ['slug', it.slug]);

async function subirFotoCatalogo(file: File): Promise<string | null> {
  const ruta = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('catalogo').upload(ruta, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
}

function Catalogos() {
  const { revisar, aviso } = useAvisos();
  const [tabla, setTabla] = useState<string>('lugares');
  const [items, setItems] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [momentos, setMomentos] = useState<any[]>([]);
  const [ubicando, setUbicando] = useState<any>(null);
  const [editando, setEditando] = useState<string | null>(null);
  // En cuántas citas (sin contar las canceladas) se ha usado cada cosa del catálogo
  const [usos, setUsos] = useState<Record<string, number>>({});
  const [soloSinUsar, setSoloSinUsar] = useState(false);
  const [porConocer, setPorConocer] = useState<PorConocer[]>([]);
  const cargar = useCallback(async () => {
    setItems((await supabase.from(tabla as any).select('*').order('orden')).data ?? []);
    const { data: citas } = await supabase.from('citas').select('lugar_id, actividad_id, franja_id, categoria_slug, vestimenta_id, cita_detalles(opcion_id)').neq('estado', 'cancelada');
    const cuenta: Record<string, number> = {};
    for (const c of (citas ?? []) as any[]) {
      const claves = tabla === 'opciones_llevar' ? [c.vestimenta_id, ...(c.cita_detalles ?? []).map((d: any) => d.opcion_id)] : [c[CAMPO_EN_CITA[tabla]]];
      for (const k of claves) if (k) cuenta[k] = (cuenta[k] ?? 0) + 1;
    }
    setUsos(cuenta);
    setPorConocer(tabla === 'lugares' ? ((await supabase.from('lugares_por_conocer').select('*').order('created_at', { ascending: false })).data ?? []) : []);
    setActividades((await supabase.from('actividades').select('*').order('orden')).data ?? []);
    setTipos((await supabase.from('categorias_cita').select('slug, nombre, emoji').eq('activo', true).order('orden')).data ?? []);
    setMomentos((await supabase.from('franjas').select('id, nombre, emoji').eq('activo', true).order('orden')).data ?? []);
  }, [tabla]);
  useEffect(() => { cargar(); setEditando(null); setSoloSinUsar(false); }, [cargar]);

  const sinUsar = items.filter((it) => !usos[it.id ?? it.slug]);
  // Lugares por conocer que todavía no están en el catálogo (ni por nombre ni por punto en el mapa)
  const enCatalogo = new Set(items.flatMap((it) => [String(it.nombre ?? '').trim().toLowerCase(), it.lat != null ? claveLugar(it.lat, it.lng) : '']));
  const fuera = porConocer.filter((d) => !enCatalogo.has(d.nombre.trim().toLowerCase()) && !enCatalogo.has(claveLugar(d.lat, d.lng)));
  const pasarAlCatalogo = async (d: PorConocer) => {
    const { error } = revisar(await supabase.from('lugares').insert({
      nombre: d.nombre, emoji: '📍', descripcion: d.nota, lat: d.lat, lng: d.lng,
      categorias: d.categoria_slug ? [d.categoria_slug] : [], precio: 2, duracion: 'Medio día',
    }), 'No pude pasarlo al catálogo');
    if (!error) aviso('Ya está en el catálogo 💚 Revísale el precio y las actividades');
    cargar();
  };

  const actualizar = async (it: any, cambios: any, error: string) => {
    const [k, v] = llave(it);
    revisar(await supabase.from(tabla as any).update(cambios).eq(k, v), error);
    cargar();
  };
  const toggleActivo = (it: any) => actualizar(it, { activo: !it.activo }, 'No pude cambiarlo');
  const mover = (it: any, dir: number) => actualizar(it, { orden: (it.orden ?? 0) + dir }, 'No pude moverlo');
  const foto = async (it: any, file: File) => {
    const url = await subirFotoCatalogo(file);
    if (!url) { aviso('No pude subir la foto 😢', 'error'); return; }
    actualizar(it, { imagen_url: url }, 'No pude guardar la foto');
  };
  const ubicar = async (it: any, lat: number, lng: number) => {
    setUbicando(null);
    actualizar(it, { lat, lng }, 'No pude guardar la ubicación');
  };

  return (
    <div className="flex flex-col gap-3">
      <select value={tabla} onChange={(e) => setTabla(e.target.value)} className="input">
        <option value="categorias_cita">Tipos de plan</option>
        <option value="lugares">Lugares</option>
        <option value="actividades">Actividades</option>
        <option value="franjas">Franjas</option>
        <option value="opciones_llevar">Qué llevar</option>
      </select>
      <NuevoItem tabla={tabla} actividades={actividades} onDone={cargar} />
      {fuera.length > 0 && (
        <div className="card p-3 rounded-2xl flex flex-col gap-2">
          <p className="eyebrow">Por conocer, fuera del catálogo</p>
          {fuera.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight truncate">{d.nombre}</p>
                <p className="text-sm text-salvia truncate">{d.nota || d.direccion || 'Marcado en el mapa'}</p>
              </div>
              <button onClick={() => pasarAlCatalogo(d)} className="chip px-3 text-sm shrink-0">Pasar al catálogo</button>
            </div>
          ))}
        </div>
      )}
      {sinUsar.length > 0 && (
        <button onClick={() => setSoloSinUsar(!soloSinUsar)} data-active={soloSinUsar} aria-pressed={soloSinUsar} className="chip px-3 text-sm self-start">
          Solo lo que nunca se ha usado ({sinUsar.length})
        </button>
      )}
      {(soloSinUsar ? sinUsar : items).map((it) => {
        const id = it.id ?? it.slug;
        return (
          <div key={id} className="card p-3 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{it.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{it.nombre}</p>
                <p className="text-sm text-salvia">{it.activo ? 'Visible' : 'Oculto'} · puesto {it.orden}{tabla === 'lugares' && it.lat == null ? ' · sin ubicación' : ''} · {usos[id] ? `${usos[id]} ${usos[id] === 1 ? 'cita' : 'citas'}` : 'sin usar'}</p>
              </div>
              <button onClick={() => toggleActivo(it)} className="chip px-3 text-sm text-coral shrink-0">{it.activo ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditando(editando === id ? null : id)} aria-label={`Editar ${it.nombre}`} aria-expanded={editando === id} className={`btn-icon ${editando === id ? 'bg-seleccion border-bosque' : ''}`}><IconoLapiz className="w-5 h-5" /></button>
              <input type="file" accept="image/*" className="hidden" id={`f-${id}`} onChange={(e) => e.target.files?.[0] && foto(it, e.target.files[0])} />
              {tabla === 'lugares' && (
                <button onClick={() => setUbicando(it)} aria-label={`Ubicación de ${it.nombre} en el mapa`} className={`btn-icon ${it.lat != null ? 'bg-seleccion border-bosque' : ''}`}><IconoPin className="w-5 h-5" /></button>
              )}
              <label htmlFor={`f-${id}`} aria-label={`Cambiar la foto de ${it.nombre}`} className="btn-icon cursor-pointer"><IconoCamara className="w-5 h-5" /></label>
              <button onClick={() => mover(it, -1)} aria-label={`Subir ${it.nombre}`} className="btn-icon ml-auto"><IconoAtras className="w-5 h-5 rotate-90" /></button>
              <button onClick={() => mover(it, 1)} aria-label={`Bajar ${it.nombre}`} className="btn-icon"><IconoAtras className="w-5 h-5 -rotate-90" /></button>
            </div>
            {editando === id && (
              <EditarItem tabla={tabla} item={it} actividades={actividades} tipos={tipos} momentos={momentos} onDone={() => { setEditando(null); cargar(); }} />
            )}
          </div>
        );
      })}
      <AnimatePresence>
        {ubicando && (
          <MapaLugar
            inicial={ubicando.lat != null ? { nombre: ubicando.nombre, direccion: ubicando.zona ?? '', lat: ubicando.lat, lng: ubicando.lng } : null}
            onClose={() => setUbicando(null)}
            onPick={(l) => ubicar(ubicando, l.lat, l.lng)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipsActividades({ actividades, sel, setSel }: { actividades: any[]; sel: string[]; setSel: (v: string[]) => void }) {
  return (
    <>
      <p className="text-sm font-bold">Actividades:</p>
      <div className="flex flex-wrap gap-1">
        {actividades.map((a: any) => (
          <button key={a.id} onClick={() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id])}
            className="chip px-3 text-sm" data-active={sel.includes(a.id)} aria-pressed={sel.includes(a.id)}>{a.nombre}</button>
        ))}
      </div>
    </>
  );
}

function EditarItem({ tabla, item, actividades, tipos, momentos, onDone }: { tabla: string; item: any; actividades: any[]; tipos: any[]; momentos: any[]; onDone: () => void }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const campos = CAMPOS[tabla] ?? [];
  const [datos, setDatos] = useState<any>(() => Object.fromEntries(campos.map(([k]) => [k, item[k] ?? ''])));
  const [selActs, setSelActs] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (tabla !== 'lugares') return;
    supabase.from('lugar_actividad').select('actividad_id').eq('lugar_id', item.id)
      .then(({ data }) => setSelActs((data ?? []).map((d) => d.actividad_id)));
  }, [tabla, item.id]);

  const guardar = async () => {
    if (!String(datos.nombre ?? '').trim()) { aviso('El nombre no puede quedar vacío', 'error'); return; }
    setGuardando(true);
    const [k, v] = llave(item);
    const cambios = {
      ...datos, nombre: datos.nombre.trim(), ...('nota' in datos ? { nota: datos.nota || null } : {}),
      ...('categorias' in datos ? { categorias: datos.categorias || [] } : {}),
      ...('es_comodin' in datos ? { es_comodin: !!datos.es_comodin } : {}),
      ...('franjas_permitidas' in datos ? { franjas_permitidas: datos.franjas_permitidas?.length ? datos.franjas_permitidas : null } : {}),
    };
    const { error } = revisar(await supabase.from(tabla as any).update(cambios).eq(k, v), 'No pude guardar los cambios');
    if (!error && tabla === 'lugares' && selActs) {
      const borrado = revisar(await supabase.from('lugar_actividad').delete().eq('lugar_id', item.id), 'No pude actualizar las actividades');
      if (!borrado.error && selActs.length) {
        revisar(await supabase.from('lugar_actividad').insert(selActs.map((a) => ({ lugar_id: item.id, actividad_id: a }))), 'No pude actualizar las actividades');
      }
    }
    setGuardando(false);
    if (!error) { aviso('Guardado 💚'); onDone(); }
  };

  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Borrar «${item.nombre}»?`, texto: 'No se puede deshacer. Si solo no quieres que aparezca, mejor ocúltalo.', boton: 'Borrar', peligro: true }))) return;
    const [k, v] = llave(item);
    const { error } = await supabase.from(tabla as any).delete().eq(k, v);
    if (error?.code === EN_USO) { aviso(`«${item.nombre}» ya se usa en alguna cita; mejor ocúltalo`, 'error'); return; }
    revisar({ error }, 'No pude borrarlo');
    if (!error) { aviso('Borrado'); onDone(); }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-menta pt-3">
      {campos.map(([k, etiqueta, tipo]) => tipo === 'tipos-plan' || tipo === 'momentos' ? (
        <div key={k}>
          <p className="text-sm font-bold text-bosque-oscuro">{etiqueta}</p>
          <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label={etiqueta}>
            {(tipo === 'tipos-plan' ? tipos.map((c) => [c.slug, c] as const) : momentos.map((f) => [f.id, f] as const)).map(([v, o]) => {
              const sel: string[] = datos[k] || [];
              return <button key={v} type="button" onClick={() => setDatos({ ...datos, [k]: sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v] })}
                className="chip px-3 text-sm" data-active={sel.includes(v)} aria-pressed={sel.includes(v)}>{o.emoji} {o.nombre}</button>;
            })}
          </div>
        </div>
      ) : tipo === 'si-no' ? (
        <label key={k} className="text-sm font-bold text-bosque-oscuro flex items-center gap-2">
          <input type="checkbox" checked={!!datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.checked })} className="w-5 h-5 accent-bosque" />
          {etiqueta}
        </label>
      ) : (
        <label key={k} className="text-sm font-bold text-bosque-oscuro">{etiqueta}
          {tipo === 'textarea' ? (
            <textarea value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 min-h-16 text-sm font-normal text-bosque-oscuro" />
          ) : tipo === 'precio' ? (
            <select value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: Number(e.target.value) })} className="input mt-1 text-sm">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
            </select>
          ) : tipo === 'tipo-llevar' ? (
            <select value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm">
              <option value="detalle">Detalle</option>
              <option value="vestimenta">Vestimenta</option>
            </select>
          ) : (
            <input value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm font-normal text-bosque-oscuro" />
          )}
        </label>
      ))}
      {tabla === 'lugares' && selActs && <ChipsActividades actividades={actividades} sel={selActs} setSel={setSelActs} />}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button onClick={borrar} className="btn-soft py-2.5 bg-durazno/30 border-durazno/60 text-coral">Borrar</button>
        <button onClick={guardar} disabled={guardando} className="btn-primary py-2.5">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function NuevoItem({ tabla, actividades, onDone }: any) {
  const { revisar, aviso } = useAvisos();
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [slug, setSlug] = useState('');
  const [categoria, setCategoria] = useState('');
  const [selActs, setSelActs] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  const guardar = async () => {
    if (!nombre) return;
    const msg = 'No pude agregarlo';
    let error: any = null;
    if (tabla === 'categorias_cita' || tabla === 'categorias_preguntas') {
      ({ error } = revisar(await supabase.from(tabla as any).insert({ slug: slug || nombre.toLowerCase().replaceAll(' ', '-'), nombre, emoji, color: '#8FB39A' }), msg));
    } else if (tabla === 'lugares') {
      const res = revisar(await supabase.from('lugares').insert({ nombre, emoji, categorias: categoria ? [categoria] : [], precio: 2, duracion: 'Medio día' }).select().single(), msg);
      error = res.error;
      if (res.data && selActs.length) {
        revisar(await supabase.from('lugar_actividad').insert(selActs.map((a) => ({ lugar_id: res.data.id, actividad_id: a }))), 'Lo agregué, pero no pude guardar sus actividades');
      }
    } else if (tabla === 'actividades') {
      ({ error } = revisar(await supabase.from('actividades').insert({ nombre, emoji, precio: 2 }), msg));
    } else if (tabla === 'franjas') {
      ({ error } = revisar(await supabase.from('franjas').insert({ nombre, emoji, horario: '' }), msg));
    } else {
      ({ error } = revisar(await supabase.from('opciones_llevar').insert({ tipo: 'detalle', nombre, emoji }), msg));
    }
    if (error) return;
    aviso('Agregado 💚');
    setNombre(''); setSlug(''); setEmoji('✨'); setSelActs([]); setAbierto(false); onDone();
  };

  return abierto ? (
    <div className="card p-3 rounded-2xl flex flex-col gap-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="input" />
      <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" className="input" />
      {(tabla === 'categorias_cita' || tabla === 'categorias_preguntas') && <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (opcional)" className="input" />}
      {tabla === 'lugares' && (
        <>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Slug de categoría (ej: romantico)" className="input" />
          <ChipsActividades actividades={actividades} sel={selActs} setSel={setSelActs} />
        </>
      )}
      <button onClick={guardar} className="btn-primary py-2.5">Guardar</button>
    </div>
  ) : (
    <button onClick={() => setAbierto(true)} className="btn-soft py-2.5 border-dashed">+ Agregar</button>
  );
}

/* ---------- Preguntas ---------- */

function AdminPreguntas() {
  const { revisar, aviso } = useAvisos();
  const [cat, setCat] = useState('');
  const [texto, setTexto] = useState('');
  const [lote, setLote] = useState('');
  const [cats, setCats] = useState<any[]>([]);
  const [preguntas, setPreguntas] = useState<any[]>([]);
  const [buscar, setBuscar] = useState('');
  useEffect(() => { supabase.from('categorias_preguntas').select('*').order('orden').then(({ data }) => setCats(data ?? [])); }, []);

  const cargar = useCallback(async () => {
    if (!cat) { setPreguntas([]); return; }
    const { data } = await supabase.from('preguntas').select('*').eq('categoria_slug', cat).order('texto');
    setPreguntas(data ?? []);
  }, [cat]);
  useEffect(() => { cargar(); }, [cargar]);

  // La de hoy (si ya salió) y las que quedaron puestas para más adelante
  const [dias, setDias] = useState<any[]>([]);
  const cargarDias = useCallback(async () => {
    const { data } = await supabase.from('pregunta_del_dia').select('fecha, preguntas(texto)').gte('fecha', hoyStr()).order('fecha');
    setDias(data ?? []);
  }, []);
  useEffect(() => { cargarDias(); }, [cargarDias]);
  const deHoy = dias.find((d) => d.fecha === hoyStr());
  const quitarDia = async (fecha: string) => {
    revisar(await supabase.from('pregunta_del_dia').delete().eq('fecha', fecha).gt('fecha', hoyStr()), 'No pude quitarla');
    cargarDias();
  };

  const agregar = async () => {
    if (!texto.trim() || !cat) return;
    const { error } = revisar(await supabase.from('preguntas').insert({ categoria_slug: cat, texto: texto.trim() }), 'No pude agregar la pregunta');
    if (error) return;
    setTexto('');
    aviso('Pregunta agregada 💭');
    cargar();
  };
  const importar = async () => {
    const lineas = lote.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lineas.length || !cat) return;
    const { error } = revisar(await supabase.from('preguntas').insert(lineas.map((l) => ({ categoria_slug: cat, texto: l }))), 'No pude importar el lote');
    if (error) return;
    setLote('');
    aviso(`${lineas.length} ${lineas.length === 1 ? 'pregunta agregada' : 'preguntas agregadas'} 💭`);
    cargar();
  };

  const filtradas = buscar.trim() ? preguntas.filter((p) => p.texto.toLowerCase().includes(buscar.trim().toLowerCase())) : preguntas;

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex flex-col gap-2">
        <p className="eyebrow">Pregunta de hoy</p>
        <p className="font-titulo text-lg font-semibold leading-snug">{deHoy ? deHoy.preguntas?.texto : 'Todavía no ha salido: se escoge cuando uno de los dos abre la app.'}</p>
        <p className="text-sm text-salvia">Para cambiarla o dejar una puesta para otro día, búscala abajo y toca el calendario.</p>
        {dias.filter((d) => d !== deHoy).map((d) => (
          <div key={d.fecha} className="flex items-center gap-3 border-t border-menta pt-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-bosque first-letter:uppercase">{fechaBonita(d.fecha)}</p>
              <p className="text-sm">{d.preguntas?.texto}</p>
            </div>
            <button onClick={() => quitarDia(d.fecha)} aria-label={`Quitar la pregunta del ${fechaBonita(d.fecha)}`} className="btn-icon shrink-0"><IconoBasura className="w-5 h-5" /></button>
          </div>
        ))}
      </div>
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
        <option value="">Escoge categoría</option>
        {cats.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.nombre}</option>)}
      </select>
      {!cat ? <Vacio titulo="Escoge una categoría" texto="Para ver, editar o agregar preguntas." /> : (
        <>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nueva pregunta" className="input" />
          <button onClick={agregar} disabled={!texto.trim()} className="btn-primary py-2.5">Agregar</button>
          <textarea value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Importación en bloque: una pregunta por línea" className="input h-32" />
          <button onClick={importar} disabled={!lote.trim()} className="btn-soft py-2.5">Importar lote</button>

          <div className="flex items-center justify-between mt-3">
            <p className="font-bold">{preguntas.length} preguntas</p>
            <p className="text-sm text-salvia">{preguntas.filter((p) => !p.activo).length} desactivadas</p>
          </div>
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="input" />
          {filtradas.map((p) => <PreguntaItem key={p.id} p={p} onCambio={cargar} onProgramada={cargarDias} />)}
        </>
      )}
    </div>
  );
}

function PreguntaItem({ p, onCambio, onProgramada }: { p: any; onCambio: () => void; onProgramada: () => void }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.texto);
  const [programando, setProgramando] = useState(false);
  const [dia, setDia] = useState(hoyStr());

  const programar = async () => {
    const { error } = await supabase.rpc('fijar_pregunta_del_dia', { p_fecha: dia, p_pregunta: p.id });
    if (error?.message?.includes('Ya respondieron')) { aviso('La de hoy ya tiene respuestas: no se puede cambiar', 'error'); return; }
    revisar({ error }, 'No pude dejarla para ese día');
    if (error) return;
    aviso(dia === hoyStr() ? 'Es la pregunta de hoy 💭' : 'Quedó puesta para ese día 💭');
    setProgramando(false);
    onProgramada();
  };

  const guardar = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('preguntas').update({ texto: texto.trim() }).eq('id', p.id), 'No pude guardar la pregunta');
    if (error) return;
    setEditando(false);
    onCambio();
  };
  const alternar = async () => {
    revisar(await supabase.from('preguntas').update({ activo: !p.activo }).eq('id', p.id), 'No pude cambiarla');
    onCambio();
  };
  const borrar = async () => {
    if (!(await confirmar({ titulo: '¿Borrar esta pregunta?', texto: p.texto, boton: 'Borrar', peligro: true }))) return;
    const { error } = await supabase.from('preguntas').delete().eq('id', p.id);
    if (error?.code === EN_USO) { aviso('Ya salió como pregunta del día; mejor desactívala', 'error'); return; }
    revisar({ error }, 'No pude borrarla');
    if (!error) onCambio();
  };

  return (
    <div className={`card p-3 rounded-2xl flex flex-col gap-2 ${p.activo ? '' : 'opacity-60'}`}>
      {editando ? (
        <>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} className="input min-h-16 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setTexto(p.texto); setEditando(false); }} className="btn-soft py-2">Volver</button>
            <button onClick={guardar} disabled={!texto.trim()} className="btn-primary py-2">Guardar</button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold">{p.texto}</p>
          <div className="flex items-center gap-4 text-sm font-bold">
            <button onClick={() => setEditando(true)} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoLapiz className="w-4 h-4" /> Editar</button>
            <button onClick={alternar} className="text-salvia min-h-11">{p.activo ? 'Desactivar' : 'Activar'}</button>
            <button onClick={() => setProgramando(!programando)} aria-label="Poner como pregunta de un día" aria-expanded={programando} className="text-bosque min-h-11 min-w-11 flex items-center justify-center"><IconoCalendario className="w-5 h-5" /></button>
            <button onClick={borrar} className="text-coral ml-auto min-h-11 px-2 -mr-2">Borrar</button>
          </div>
          {programando && (
            <div className="flex items-end gap-2 border-t border-menta pt-2">
              <label className="flex-1 text-sm font-bold text-bosque-oscuro">Sale el día
                <input type="date" min={hoyStr()} value={dia} onChange={(e) => setDia(e.target.value)} className="input mt-1" />
              </label>
              <button onClick={programar} disabled={!dia} className="btn-primary py-2.5">Listo</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Fechas() {
  return <DiasNoPuedo />;
}

// Los mismos grupos que en src/components/AjustesAvisos.tsx
const GRUPOS_AVISO: Record<string, string> = {
  pregunta: 'la pregunta del día', pienso: 'pienso en ti', animo: 'el ánimo', recuerdos: 'recuerdos y canciones',
  juntos: 'planes, regalos y lugares', cartas: 'cartas y cápsulas', fechas: 'fechas especiales',
};

// En cuántos celulares tiene cada uno las notificaciones activas, y una de prueba para salir de dudas
function Notificaciones() {
  const { revisar, aviso } = useAvisos();
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<any[]>([]);
  useEffect(() => { supabase.rpc('estado_notificaciones').then(({ data }) => setFilas(data ?? [])); }, []);

  const probar = async (f: any) => {
    const { error } = revisar(await supabase.rpc('probar_notificacion', { p_destino: f.usuario_id }), 'No pude mandar la prueba');
    if (!error) aviso(f.usuario_id === perfil?.id ? 'Enviada: debería llegarte en unos segundos 🔔' : `Enviada a ${f.nombre} 🔔`);
  };

  if (!filas.length) return null;
  return (
    <section className="card p-4 flex flex-col gap-3 mb-2">
      <p className="eyebrow">Notificaciones</p>
      {filas.map((f) => (
        <div key={f.usuario_id} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">{f.usuario_id === perfil?.id ? 'Tú' : f.nombre}</p>
            <p className={`text-sm ${f.celulares ? 'text-salvia' : 'font-bold text-coral'}`}>
              {f.celulares ? `Activas en ${f.celulares} ${f.celulares === 1 ? 'celular' : 'celulares'}` : 'Sin activar en ningún celular'}
            </p>
            {f.silenciados?.length > 0 && <p className="text-sm text-salvia">En silencio: {f.silenciados.map((g: string) => GRUPOS_AVISO[g] ?? g).join(', ')}</p>}
          </div>
          {f.celulares > 0 && <button onClick={() => probar(f)} className="chip px-3 text-sm shrink-0"><IconoCampana className="w-4 h-4" /> Probar</button>}
        </div>
      ))}
    </section>
  );
}

function Config() {
  const { revisar, aviso } = useAvisos();
  const soyEl = useAuth().perfil?.rol === 'admin';
  const [c, setC] = useState<any>(null);
  useEffect(() => { supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setC(data)); }, []);
  const guardar = async () => {
    // Las fechas vacías van como null (Postgres no acepta '' en una columna date)
    const datos = { ...c, cumple_ella: c.cumple_ella || null, cumple_el: c.cumple_el || null };
    const { error } = revisar(await supabase.from('configuracion').update(datos).eq('id', 1), 'No pude guardar la configuración');
    if (!error) aviso('Guardado 💚');
  };
  if (!c) return null;
  return (
    <div className="flex flex-col gap-2">
      <Notificaciones />
      {/* Las etiquetas hablan de quien tiene el panel abierto */}
      {[['nombre_app', 'Nombre de la app'], ['nombre_ella', soyEl ? 'Nombre de ella' : 'Tu nombre'], ['apodo_ella', soyEl ? 'Cómo le dices' : 'Cómo te dice'], ['nombre_el', soyEl ? 'Tu nombre' : 'Nombre de él'], ['fecha_inicio', 'Fecha de inicio', 'date'], ['cumple_ella', soyEl ? 'Cumpleaños de ella' : 'Tu cumpleaños', 'date'], ['cumple_el', soyEl ? 'Tu cumpleaños' : 'Cumpleaños de él', 'date'], ['whatsapp', soyEl ? 'Tu WhatsApp (sin +)' : 'WhatsApp de él (sin +)'], ['whatsapp_ella', soyEl ? 'WhatsApp de ella (sin +)' : 'Tu WhatsApp (sin +)'], ['color_principal', 'Color principal']].map(([k, l, tipo]) => (
        <label key={k} className="text-sm">{l}
          <input type={tipo ?? 'text'} value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} className="input mt-1" />
        </label>
      ))}
      <button onClick={guardar} className="btn-primary">Guardar</button>
    </div>
  );
}
