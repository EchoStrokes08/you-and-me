import { Link, useSearchParams } from 'react-router-dom';
import DiasNoPuedo from '../components/DiasNoPuedo';
import DiasImportantes from '../components/DiasImportantes';
import { Encabezado, IconoAtras, Segmented } from '../components/ui';

// Se abre desde Ajustes: los días en que cada uno no puede tener cita y los días importantes de cada uno
export default function Dias() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'importantes' ? 'importantes' : 'nopuedo';
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/" className="btn-icon" aria-label="Volver al inicio"><IconoAtras /></Link>
      <Encabezado eyebrow={tab === 'nopuedo' ? 'Para que no nos crucemos' : 'Para acompañarnos'} titulo="Nuestros días" />
      <Segmented id="tabs-dias" value={tab} onChange={(t) => setParams(t === 'nopuedo' ? {} : { tab: t }, { replace: true })}
        options={[['nopuedo', 'No puedo'], ['importantes', 'Importantes']] as const} />
      {tab === 'nopuedo' ? <DiasNoPuedo /> : <DiasImportantes />}
    </div>
  );
}
