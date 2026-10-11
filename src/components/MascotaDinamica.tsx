import Ballena, { Olas, Burbujas, Mar } from './Ballena';
import TiburonBallena from './TiburonBallena';
import Cachalote from './Cachalote';
import Orca from './Orca';

import Medusa from './Medusa';
import CaballitoDeMar from './CaballitoDeMar';
import PezPayaso from './PezPayaso';

export type MascotaPrimariaTipo = 'ballena' | 'tiburon_ballena' | 'cachalote' | 'orca';
export type MascotaSecundariaTipo = 'caballito_de_mar' | 'medusa' | 'pez_payaso';

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
  tipo?: MascotaPrimariaTipo | string;
  className?: string;
  espejo?: boolean;
  soplo?: boolean;
  nadando?: boolean;
};

export function MascotaPrimaria({
  tipo = 'ballena',
  className = 'w-32',
  espejo = false,
  soplo = true,
  nadando = true,
}: PropsPrimaria) {
  switch (tipo) {
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
  tipo?: MascotaSecundariaTipo | string;
  className?: string;
  espejo?: boolean;
  burbujas?: boolean;
  nadando?: boolean;
};

export function MascotaSecundaria({
  tipo = 'medusa',
  className = 'w-16',
  espejo = false,
  burbujas = true,
  nadando = true,
}: PropsSecundaria) {
  switch (tipo) {
    case 'caballito_de_mar':
      return <CaballitoDeMar className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
    case 'pez_payaso':
      return <PezPayaso className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
    case 'medusa':
    default:
      return <Medusa className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
  }
}

export function FamiliaMascotas({
  tipoPrimario = 'ballena',
  className = '',
}: {
  tipoPrimario?: MascotaPrimariaTipo | string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <MascotaPrimaria tipo={tipoPrimario} className="w-full" />
      <MascotaPrimaria
        tipo={tipoPrimario}
        className="absolute w-[42%] -bottom-[6%] -left-[14%]"
        soplo={false}
      />
    </div>
  );
}

export { Olas, Burbujas, Mar };
