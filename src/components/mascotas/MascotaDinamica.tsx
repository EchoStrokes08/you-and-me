// El conmutador de mascotas: dibuja la principal que hayan escogido (ballena, tiburón ballena, cachalote u orca) más su acompañante.
// Desde aquí salen también las listas del menú de mascotas y los tipos que usa el resto de la app.
import { useEffect, useRef, useState } from 'react';
import Ballena, { FamiliaBallenas, Olas, Burbujas, Mar as MarBase } from './Ballena';
import TiburonBallena from './TiburonBallena';
import Cachalote from './Cachalote';
import Orca from './Orca';

import Medusa from './Medusa';
import CaballitoDeMar from './CaballitoDeMar';
import PezPayaso from './PezPayaso';
import Tortuga from './Tortuga';
import { Arena, Cardumen, CoralAbanico, CoralRamas, Plancton, RayosDeLuz, Rocas } from './FondoDecorado';

import { useMascotas, type MascotaPrimariaTipo, type MascotaSecundariaTipo } from '../../lib/mascotas';

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
  { id: 'tortuga', nombre: 'Tortugas', emoji: '🐢' },
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
    case 'tortuga':
      return <Tortuga className={className} espejo={espejo} burbujas={burbujas} nadando={nadando} />;
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
      <Acompanantes className="absolute w-[60%] -top-[40%] -left-[40%]" />
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

/** Lo que espera una mascota del fondo, ya fuera de la pantalla, antes de volver a pasar */
const PAUSA_PASADA_MS = 3000;

/**
 * Una pasada por el fondo: cruza, sale, espera la pausa y vuelve a cruzar.
 * Cada vuelta pasa a otra altura dentro de su franja (`desde` a `hasta`, en % de la pantalla),
 * y por dentro sube y baja con la corriente en vez de deslizarse en línea recta.
 */
function Pasada({ className, desde, hasta, pausa = PAUSA_PASADA_MS, children }: { className: string; desde: number; hasta: number; pausa?: number; children: React.ReactNode }) {
  const [vuelta, setVuelta] = useState({ n: 0, alto: (desde + hasta) / 2 });
  const espera = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(espera.current), []);
  return (
    <div
      key={vuelta.n}
      className={`pasa absolute left-0 ${className}`}
      // El adelanto con el que arrancan repartidas por la pantalla solo vale para la primera pasada
      style={{ top: `${vuelta.alto}%`, animationDelay: vuelta.n ? '0s' : undefined }}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        espera.current = window.setTimeout(() => setVuelta((v) => ({ n: v.n + 1, alto: desde + Math.random() * (hasta - desde) })), pausa);
      }}
    >
      <div className="ondula relative">{children}</div>
    </div>
  );
}

// Burbujas sueltas del fondo: [posición horizontal, tamaño en px, segundos que tarda en subir, adelanto]
const BURBUJAS_FONDO: [string, number, number, number][] = [
  ['left-[7%]', 9, 19, -3],
  ['left-[13%]', 5, 15, -11],
  ['left-[34%]', 6, 23, -17],
  ['right-[30%]', 5, 17, -6],
  ['right-[12%]', 10, 21, -14],
  ['right-[6%]', 6, 16, -1],
];

/** Un manojo de algas que se mecen con la corriente */
function Algas({ className = '', espejo = false }: { className?: string; espejo?: boolean }) {
  const hoja = 'M20 200 C8 172 32 150 20 122 C8 94 32 72 22 40 C34 72 16 94 28 122 C40 150 16 172 30 200 Z';
  const hojas = [
    { x: -6, ancho: 1, alto: 0.62, d: -1.2, s: 7.5, oceano: true },
    { x: 14, ancho: 1.15, alto: 1.2, d: -3.6, s: 9, oceano: false },
    { x: 38, ancho: 1, alto: 0.86, d: -0.4, s: 6.8, oceano: true },
    { x: 58, ancho: 1.1, alto: 1.02, d: -5.1, s: 8.4, oceano: false },
    { x: 82, ancho: 0.9, alto: 0.5, d: -2.3, s: 7.1, oceano: false },
  ];
  // Cada hoja es su propio dibujo: mecerla es mover una capa ya pintada, no repintar el manojo en cada cuadro
  return (
    <div className={`aspect-[3/5] ${espejo ? '-scale-x-100' : ''} ${className}`} aria-hidden="true">
      {hojas.map((h, i) => (
        <svg key={i} viewBox="8 40 32 160" preserveAspectRatio="none"
          className={`alga absolute bottom-0 overflow-visible ${h.oceano ? 'text-oceano' : 'text-esmeralda'}`}
          style={{ left: `${(h.x + 8 * h.ancho) / 1.2}%`, width: `${(32 * h.ancho) / 1.2}%`, height: `${80 * h.alto}%`, animationDelay: `${h.d}s`, animationDuration: `${h.s}s` }}>
          <path d={hoja} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Fondo de toda la app, de atrás hacia adelante: la luz de la superficie, el plancton,
 * las siluetas que cruzan a lo lejos y el suelo con sus algas, corales y rocas.
 */
export function FondoMarino() {
  return (
    <>
      <div className="fondo-rayos fixed inset-x-0 top-0 h-[72vh] -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <RayosDeLuz className="w-full h-full" />
      </div>
      <div className="fondo-plancton fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <Plancton />
      </div>
      <div className="fondo-marino fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* La de cerca: grande, un poco más marcada y más rápida */}
        <Pasada desde={8} hasta={24} className="w-72 [animation-duration:30s] [animation-delay:-9s]">
          <MascotaPrimaria className="w-full" soplo={false} nadando={false} />
        </Pasada>
        <Pasada desde={38} hasta={54} className="pasa-vuelve [--cerca:0.8] w-[9.4rem] [animation-duration:38s] [animation-delay:-24s] [--vaiven:9s] [--sube:9px]">
          <MascotaSecundaria className="w-[75%]" espejo burbujas={false} nadando={false} />
          <MascotaSecundaria className="absolute w-[43%] top-[70%] left-[57%]" espejo burbujas={false} nadando={false} />
          <MascotaSecundaria className="absolute w-[33%] -top-[44%] left-[39%]" espejo burbujas={false} nadando={false} />
        </Pasada>
        {/* La de lejos: chica, más tenue y más lenta */}
        <Pasada desde={64} hasta={78} className="[--cerca:0.6] w-44 [animation-duration:46s] [animation-delay:-31s] [--vaiven:14s] [--sube:10px]">
          <MascotaPrimaria className="w-full" soplo={false} nadando={false} />
        </Pasada>
        {/* Cardúmenes: pasan rápido y de vez en cuando, uno hacia cada lado */}
        <Pasada desde={27} hasta={36} pausa={9000} className="[--cerca:0.7] w-28 [animation-duration:21s] [animation-delay:-4s] [--vaiven:5s] [--sube:7px] [--cabeceo:1deg]">
          <Cardumen className="w-full" />
        </Pasada>
        <Pasada desde={56} hasta={63} pausa={14000} className="pasa-vuelve [--cerca:0.5] w-20 [animation-duration:27s] [animation-delay:-15s] [--vaiven:6s] [--sube:6px]">
          <Cardumen className="w-full" espejo />
        </Pasada>
      </div>
      <div className="fondo-algas fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Atrás, lo que no se mueve: corales y rocas. Adelante, las algas y la arena */}
        <CoralAbanico className="absolute left-[20%] bottom-3 w-[5.5rem] text-durazno" />
        <CoralRamas className="absolute right-[25%] bottom-3 w-24 text-coral" />
        <Rocas className="absolute left-[34%] bottom-2 w-36" />
        <CoralRamas className="absolute left-[58%] bottom-3 w-16 text-durazno max-sm:hidden" espejo />
        <Algas className="absolute -left-3 -bottom-2 w-32" />
        <Algas className="absolute left-[30%] -bottom-2 w-16 max-sm:hidden" espejo />
        <Algas className="absolute right-[26%] -bottom-2 w-20 max-sm:hidden" />
        <Algas className="absolute -right-4 -bottom-2 w-40" espejo />
        <Arena className="absolute inset-x-0 bottom-0 w-full h-6 text-salvia" />
        {BURBUJAS_FONDO.map(([lado, px, s, d], i) => (
          <span
            key={i}
            className={`burbuja-fondo absolute bottom-0 rounded-full border-[1.5px] border-oceano ${lado}`}
            style={{ width: px, height: px, animationDuration: `${s}s`, animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </>
  );
}

/** El mar con una mascota lejana al fondo: solo su silueta, grande y tenue, nadando hacia el otro lado */
export function Mar({ children, lejana = true, ...rest }: { className?: string; children?: React.ReactNode; lejana?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <MarBase {...rest}>
      {/* El filtro va en la misma capa que nada: en un contenedor aparte habría que recomponerla en cada cuadro */}
      {lejana && <MascotaPrimaria className="absolute -left-[7%] top-1/2 w-[78%] -translate-y-[46%] opacity-[0.08] brightness-0 invert pointer-events-none" espejo soplo={false} />}
      {children}
    </MarBase>
  );
}

export { Olas, Burbujas };
