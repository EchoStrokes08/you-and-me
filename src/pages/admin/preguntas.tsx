// Gestión de preguntas del día para el admin: crearlas (una por una o en lote), ordenar por
// categoría, programarlas en fechas futuras y desagendar las que ya no van. Escribe en la tabla
// preguntas y en pregunta_del_dia; es la fuente de las preguntas que salen cada día.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fechaBonita, hoyStr } from '../../lib/utils';
import { Vacio, IconoBasura, IconoCalendario, IconoLapiz } from '../../components/ui';
import { useAvisos } from '../../lib/avisos';
import { EN_USO } from './comun';
import type { CategoriaPregunta, Pregunta } from '../../lib/tipos';

export function AdminPreguntas() {
  const { revisar, aviso } = useAvisos();
  const [cat, setCat] = useState('');
  const [texto, setTexto] = useState('');
  const [lote, setLote] = useState('');
  const [cats, setCats] = useState<CategoriaPregunta[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [buscar, setBuscar] = useState('');
  useEffect(() => { supabase.from('categorias_preguntas').select('*').order('orden').then(({ data }) => setCats(data ?? [])); }, []);

  const cargar = useCallback(async () => {
    if (!cat) { setPreguntas([]); return; }
    const { data } = await supabase.from('preguntas').select('*').eq('categoria_slug', cat).order('texto');
    setPreguntas(data ?? []);
  }, [cat]);
  useEffect(() => { cargar(); }, [cargar]);

  // La de hoy (si ya salió) y las que quedaron puestas para más adelante
  const [dias, setDias] = useState<{ fecha: string; preguntas: { texto: string } | null }[]>([]);
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

function PreguntaItem({ p, onCambio, onProgramada }: { p: Pregunta; onCambio: () => void; onProgramada: () => void }) {
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
