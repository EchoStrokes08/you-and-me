import { useState } from 'react';
import { guardarTema, leerTema, type Tema } from '../lib/tema';
import { Segmented } from './ui';

// En Ajustes: escoger el tema de la app en este celular
export default function SelectorTema() {
  const [tema, setTema] = useState<Tema>(leerTema);
  const cambiar = (t: Tema) => { setTema(t); guardarTema(t); };
  return (
    <div className="flex flex-col gap-2">
      <p className="font-bold">Tema de la app</p>
      <Segmented id="tema" value={tema} onChange={cambiar}
        options={[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const} />
      {tema === 'auto' && <p className="text-sm text-salvia">Sigue el tema del celular.</p>}
    </div>
  );
}
