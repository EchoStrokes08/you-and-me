import Ballena, { FamiliaBallenas, Olas, Burbujas, Mar as MarBase } from './Ballena';
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
      <Acompanantes className="absolute w-[60%] -top-[30%] -left-[40%]" />
    </div>
  );
}

/** Tres acompañantes de distinto tamaño, cada uno nadando hacia su lado y a su propio ritmo */
export function Acompanantes({ className = 'w-20', tipo }: { className?: string; tipo?: MascotaSecundariaTipo }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative aspect-[8/5]">
        <MascotaSecundaria tipo={tipo} className="absolute w-[64%] right-0 bottom-0" />
        <MascotaSecundaria tipo={tipo} className="absolute w-[44%] left-0 top-0 [animation-duration:6.6s] [animation-delay:-2.1s]" espejo />
        <div className="absolute w-[30%] left-[10%] bottom-[2%] -rotate-12">
          <MascotaSecundaria tipo={tipo} className="w-full [animation-duration:4.6s] [animation-delay:-3.4s]" burbujas={false} />
        </div>
      </div>
    </div>
  );
}

/** Las mascotas cruzan la pantalla nadando: para los momentos de celebración */
export function DesfileMascotas({ className = 'fixed inset-0 z-50' }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <div className="cruza absolute left-0 top-[14%] w-24 [animation-duration:5.2s] [animation-delay:0.5s]">
        <Acompanantes className="w-full" />
      </div>
      <div className="cruza cruza-vuelve absolute left-0 top-[40%] w-14 [animation-duration:6.4s] [animation-delay:1.1s]">
        <MascotaSecundaria className="w-full" espejo burbujas={false} />
      </div>
      <div className="cruza absolute left-0 bottom-[9%] w-44 [animation-duration:4.4s]">
        <MascotaPrimaria className="w-full" />
        <MascotaPrimaria className="absolute w-[42%] -bottom-[6%] -left-[30%] [animation-delay:-1.6s]" soplo={false} />
      </div>
    </div>
  );
}

/** Fondo de toda la app: siluetas muy tenues que cruzan despacio, como vistas a lo lejos */
export function FondoMarino() {
  return (
    <div className="fondo-marino fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="cruza cruza-fondo absolute left-0 top-[16%] w-72 [animation-duration:96s] [animation-delay:-30s]">
        <MascotaPrimaria className="w-full" soplo={false} nadando={false} />
      </div>
      <div className="cruza cruza-fondo cruza-vuelve absolute left-0 top-[47%] w-28 [animation-duration:128s] [animation-delay:-84s]">
        <MascotaSecundaria className="w-full" espejo burbujas={false} nadando={false} />
        <MascotaSecundaria className="absolute w-[58%] top-[70%] left-[76%]" espejo burbujas={false} nadando={false} />
        <MascotaSecundaria className="absolute w-[44%] -top-[44%] left-[52%]" espejo burbujas={false} nadando={false} />
      </div>
      <div className="cruza cruza-fondo absolute left-0 top-[72%] w-44 [animation-duration:150s] [animation-delay:-108s]">
        <MascotaPrimaria className="w-full" soplo={false} nadando={false} />
      </div>
    </div>
  );
}

/** El mar con una mascota lejana al fondo: solo su silueta, grande y tenue, nadando hacia el otro lado */
export function Mar({ children, lejana = true, ...rest }: { className?: string; children?: React.ReactNode; lejana?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <MarBase {...rest}>
      {lejana && (
        <div className="absolute -left-[7%] top-1/2 w-[78%] -translate-y-[46%] opacity-[0.08] brightness-0 invert pointer-events-none" aria-hidden="true">
          <MascotaPrimaria className="w-full" espejo soplo={false} />
        </div>
      )}
      {children}
    </MarBase>
  );
}

export { Olas, Burbujas };
