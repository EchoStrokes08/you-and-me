import { Link } from 'react-router-dom';
import DiasNoPuedo from '../components/DiasNoPuedo';
import { Encabezado, IconoAtras } from '../components/ui';

// Se abre desde Ajustes: los días en que cada uno no puede tener cita
export default function Dias() {
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/" className="btn-icon" aria-label="Volver al inicio"><IconoAtras /></Link>
      <Encabezado eyebrow="Para que no nos crucemos" titulo="Días que no puedo" />
      <DiasNoPuedo />
    </div>
  );
}
