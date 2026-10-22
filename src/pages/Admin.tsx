import { useState } from 'react';
import { Encabezado, Segmented } from '../components/ui';
import { Solicitudes } from './admin/solicitudes';
import { Catalogos } from './admin/catalogos';
import { AdminPreguntas } from './admin/preguntas';
import { Config, Fechas } from './admin/ajustes';

/* El panel de quien administra: cada pestaña vive en su archivo dentro de admin/ */

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
