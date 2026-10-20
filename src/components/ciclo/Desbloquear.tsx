import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { fuerzaClave } from '../../lib/ciclo/cripto';
import { useAvisos } from '../../lib/avisos';
import { IconoCandado } from '../ui';
import { Grupo, Interruptor } from './comunes';

export default function Desbloquear({ ciclo }: { ciclo: Ciclo }) {
  const { aviso } = useAvisos();
  const [clave, setClave] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState('');
  const [olvido, setOlvido] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    setAbriendo(true);
    setError('');
    try {
      const ok = olvido ? await ciclo.recuperar(codigo, nueva, recordar) : await ciclo.desbloquear(clave, recordar);
      if (!ok) setError(olvido ? 'Ese código no abre tu llave. Revisa que esté completo.' : 'Esa no es tu clave del ciclo.');
      else if (olvido) aviso('Listo: ya tienes clave nueva 🔐');
    } catch { setError('No pude conectarme. Revisa tu internet.'); }
    setAbriendo(false);
  };

  return (
    <form onSubmit={abrir} className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <span className="w-12 h-12 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCandado className="w-6 h-6" /></span>
        <h2 className="text-2xl font-bold">{olvido ? 'Recuperar con tu código' : 'Escribe tu clave del ciclo'}</h2>
        {olvido ? (
          <>
            <label htmlFor="codigo" className="font-bold">Código de recuperación</label>
            <input id="codigo" className="input font-mono uppercase" autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <label htmlFor="nueva" className="font-bold">Clave nueva</label>
            <input id="nueva" type="password" autoComplete="new-password" className="input" value={nueva} onChange={(e) => setNueva(e.target.value)} />
            {nueva && <p className="text-sm text-salvia">{fuerzaClave(nueva).texto}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-salvia -mt-1">Es la que creaste para esta sección, no la de la app.</p>
            <input type="password" aria-label="Clave del ciclo" autoComplete="current-password" className="input" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
          </>
        )}
        {error && <p className="text-sm text-coral font-bold" role="alert">{error}</p>}
        <Grupo><Interruptor activo={recordar} onCambio={setRecordar} titulo="Recordarla en este celular" /></Grupo>
      </section>
      <button type="submit" className="btn-primary" disabled={abriendo || (olvido ? !codigo || fuerzaClave(nueva).puntos === 0 : !clave)}>
        {abriendo ? 'Abriendo…' : olvido ? 'Recuperar' : 'Abrir'}
      </button>
      <button type="button" className="btn-soft" onClick={() => { setOlvido(!olvido); setError(''); }}>{olvido ? 'Tengo mi clave' : 'Olvidé mi clave'}</button>
    </form>
  );
}

// Era "solo en este celular" y este celular ya no tiene las llaves (se borraron los datos del navegador u otro celular)
export function LlavesPerdidas({ ciclo }: { ciclo: Ciclo }) {
  const { confirmar } = useAvisos();
  const empezar = async () => {
    if (await confirmar({ titulo: '¿Empezar de nuevo?', texto: 'Se crea una llave nueva. Lo que estaba guardado solo en el otro celular sigue allá.', boton: 'Empezar de nuevo' })) await ciclo.borrarTodo();
  };
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Tus datos están en otro celular</h2>
        <p>Escogiste guardar el ciclo solo en un celular, y este no tiene tus llaves. Ábrelo desde ese celular, o, si ya no lo tienes, importa una copia cifrada después de empezar de nuevo.</p>
      </section>
      <button className="btn-soft" onClick={empezar}>Empezar de nuevo en este celular</button>
    </div>
  );
}
