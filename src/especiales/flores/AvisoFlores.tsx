import { Link } from 'react-router-dom';
import { hoyStr } from '../../lib/utils';
import { IconoFlecha } from '../../components/ui';
import { FLORES_HASTA, RUTA_FLORES } from './config';

// Aviso del inicio que lleva a las flores; deja de salir después de FLORES_HASTA
export default function AvisoFlores() {
  if (hoyStr() > FLORES_HASTA) return null;
  return (
    <Link to={RUTA_FLORES} className="fila-aviso !bg-[#0b0a06] !border-[#f5c518]/40 text-[#fde68a]">
      <span className="text-xl">🌼</span>
      <p className="flex-1 font-bold text-sm">Tengo algo para ti… ábrelo ✨</p>
      <IconoFlecha className="w-4 h-4" />
    </Link>
  );
}
