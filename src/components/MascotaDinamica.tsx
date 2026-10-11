import Ballena, { FamiliaBallenas, Olas, Burbujas, Mar } from './Ballena';
import TiburonBallena from './TiburonBallena';
import Cachalote from './Cachalote';
import Orca from './Orca';

import Medusa from './Medusa';
import CaballitoDeMar from './CaballitoDeMar';
import PezPayaso from './PezPayaso';

import { useMascotas, type MascotaPrimariaTipo, type MascotaSecundariaTipo } from '../lib/mascotas';

export type { MascotaPrimariaTipo, MascotaSecundariaTipo };

export const OPCIONES_PRIMARIAS: { id: MascotaPrimariaTipo; nombre: string; emoji: string }[] = [
  { id: 'ballena', nombre: 'Ballena', emoji: '🐋' },
  { id: 'tiburon_ballena', nombre: 'Tiburón ballena', emoji: '🦈' },
  { id: 'cachalote', nombre: 'Cachalote', emoji: '🐳' },
  { id: 'orca', nombre: 'Orca', emoji: '⬛' },
];

export const OPCIONES_SECUNDARIAS: { id: MascotaSecundariaTipo; nombre: string; emoji: string }[] = [
  { id: 'medusa', nombre: 'Medusas', emoji: '🪼' },
  { id: 'caballito_de_mar', nombre: 'Caballito de mar', emoji: '🦛' },
  { id: 'pez_payaso', nombre: 'Peces payaso', emoji: '🐠' },
];

type PropsPrimaria = {
  /** Sin tipo, la que eligieron en Ajustes */
  tipo?: MascotaPrimariaTipo;
  className?: string;
  espejo?: boolean;
  soplo?: boolean;
  nadando?: boolean;
};

export function MascotaPrimaria({
  tipo,
  className = 'w-32',
  espejo = false,
  soplo = true,
  nadando = true,
}: PropsPrimaria) {
  const elegida = useMascotas().primario;
  switch (tipo ?? elegida) {
    case 'tiburon_ballena':
      return <TiburonBallena className={className} espejo={espejo} nadando={nadando} />;
    case 'cachalote':
      return <Cachalote className={className} espejo={espejo} soplo={soplo} nadando={nadando} />;
    case 'orca':
      return <Orca className={className} espejo={espejo} soplo={soplo} nadando={nadando} />;
    case 'ballena':
    default:
      return <Ballena className={className} espejo={espejo} soplo={soplo} nadando={nadando} />;
  }
}

type PropsSecundaria = {
  /** Sin tipo, el que eligieron en Ajustes */
  tipo?: MascotaSecundariaTipo;
  className?: string;
  espejo?: boolean;
  burbujas?: boolean;
  nadando?: boolean;
};

export function MascotaSecundaria({
  tipo,
  className = 'w-16',
  espejo = false,
  burbujas = true,
  nadando = true,
}: PropsSecundaria) {
  const elegida = useMascotas().secundario;
  switch (tipo ?? elegida) {
    case 'caballito_de_mar':
      return <CaballitoDeMar className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
    case 'pez_payaso':
      return <PezPayaso className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
    case 'medusa':
    default:
      return <Medusa className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
  }
}

/** La mascota principal con su cría y el acompañante nadando al lado */
export function FamiliaMascotas({ className = '' }: { className?: string }) {
  const { primario } = useMascotas();
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {primario === 'ballena' ? <FamiliaBallenas /> : (
        <>
          <MascotaPrimaria className="w-full" />
          <MascotaPrimaria className="absolute w-[42%] -bottom-[6%] -left-[14%]" soplo={false} />
        </>
      )}
      <MascotaSecundaria className="absolute w-[46%] -top-[10%] -left-[20%]" />
    </div>
  );
}

export { Olas, Burbujas, Mar };
