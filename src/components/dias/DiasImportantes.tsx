// Días importantes de cada uno (examen, cita médica, presentación): se anotan en /dias y, en uno de esos días, al otro le llega un aviso a las 7 a. m.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { DiaImportante } from '../../lib/tipos';
import { useAuth } from '../../context/AuthContext';
import { useAvisos } from '../../lib/avisos';
import { diasEntre, fechaBonita, fechaStr, hoy, hoyStr } from '../../lib/utils';
import { ChipsConMas, IconoFlecha, IconoMas, IconoSol, Vacio } from '../ui';

const IDEAS = ['Examen', 'Entrevista', 'Primer día de trabajo', 'Día pesado en el trabajo', 'Cita médica', 'Presentación'];

// En /dias: cada uno anota sus días importantes y ve los del otro. Ese día, a las 7 a. m., le llega un aviso al otro.
export default function DiasImportantes() {
  const { perfil } = useAuth();
  const { revisar, confirmar } = useAvisos();
  const [dias, setDias] = useState<DiaImportante[]>([]);
  const [pareja, setPareja] = useState('tu amor');
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const yo = perfil?.id;

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('dias_importantes').select('*').gte('fecha', hoyStr()).order('fecha');
    setDias(data ?? []);
  }, []);
  useEffect(() => {
    cargar();
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single()
      .then(({ data }) => setPareja((perfil?.rol === 'admin' ? data?.nombre_ella : data?.nombre_el) ?? 'tu amor'));
  }, [cargar, perfil?.rol]);

  const agregar = async () => {
    if (!titulo.trim() || !fecha) return;
    const { error } = revisar(await supabase.from('dias_importantes').insert({ titulo: titulo.trim(), fecha }), 'No pude anotarlo');
    if (error) return;
    setTitulo(''); setFecha('');
    cargar();
  };

  const quitar = async (d: DiaImportante) => {
    if (!(await confirmar({ titulo: `¿Quitar «${d.titulo}»?`, boton: 'Quitar', peligro: true }))) return;
    revisar(await supabase.from('dias_importantes').delete().eq('id', d.id), 'No pude quitarlo');
    cargar();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-salvia">Un examen, una entrevista, un día que va a estar pesado… Ese día, en la mañana, a {pareja} le llega un aviso para que te mande amor.</p>
      <div className="card p-4 flex flex-col gap-3">
        <ChipsConMas opciones={IDEAS} elegida={titulo} onElegir={setTitulo} visibles={4} etiqueta="Ideas" />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={60} placeholder="¿Qué tienes ese día?" aria-label="¿Qué tienes ese día?" className="input" />
        <input type="date" value={fecha} min={hoyStr()} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" className="input" />
        <button onClick={agregar} disabled={!titulo.trim() || !fecha} className="btn-primary"><IconoMas /> Anotar día importante</button>
      </div>
      {dias.length === 0 ? <Vacio titulo="No hay días importantes anotados" texto="Lo que anoten aquí lo ven los dos." /> : (
        <div className="flex flex-col gap-2 stagger">
          {dias.map((d) => {
            const mio = d.usuario_id === yo;
            return (
              <div key={d.id} className="card p-3 flex items-center gap-3">
                <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${mio ? 'bg-seleccion text-bosque' : 'bg-durazno/30 text-coral'}`}><IconoSol className="w-6 h-6" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-tight">{d.titulo}</p>
                  <p className="text-sm text-salvia first-letter:uppercase">{mio ? 'Tuyo' : `De ${pareja}`} · {fechaBonita(d.fecha).replace(/ de \d{4}$/, '')}</p>
                </div>
                {mio && <button onClick={() => quitar(d)} className="min-h-11 px-2 text-sm text-salvia font-bold shrink-0">Quitar</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// En el inicio: si hoy o mañana es un día importante del otro, se avisa (con el atajo para mandarle amor)
export function AvisoDiaImportante({ yo, pareja }: { yo: string; pareja: string }) {
  const [dia, setDia] = useState<DiaImportante | null>(null);
  useEffect(() => {
    const manana = hoy(); manana.setDate(manana.getDate() + 1);
    supabase.from('dias_importantes').select('*').neq('usuario_id', yo).gte('fecha', hoyStr()).lte('fecha', fechaStr(manana)).order('fecha').limit(1).maybeSingle()
      .then(({ data }) => setDia(data));
  }, [yo]);
  if (!dia) return null;
  const esHoy = diasEntre(dia.fecha) === 0;
  return (
    <Link to="/cartas" className="fila-aviso min-h-14 bg-durazno/20 border-durazno/50">
      <IconoSol className="w-5 h-5 text-coral shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">{esHoy ? `Hoy ${pareja} tiene: ${dia.titulo}` : `Mañana ${pareja} tiene: ${dia.titulo}`}</p>
        <p className="text-sm text-salvia">{esHoy ? 'Mándale un "Pienso en ti" o escríbele algo bonito' : 'Escríbele algo para que lo lea antes'}</p>
      </div>
      <IconoFlecha className="w-4 h-4 text-coral" />
    </Link>
  );
}
