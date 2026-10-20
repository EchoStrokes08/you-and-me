import type { ReactNode } from 'react';

import { fechaCorta } from '../../lib/ciclo/formato';

// Interruptor accesible, igual al de "Qué avisos me llegan"
export function Interruptor({ activo, onCambio, titulo, detalle, deshabilitado }: {
  activo: boolean; onCambio: (v: boolean) => void; titulo: string; detalle?: ReactNode; deshabilitado?: boolean;
}) {
  return (
    <button role="switch" aria-checked={activo} disabled={deshabilitado} onClick={() => onCambio(!activo)}
      className="w-full flex items-center gap-3 text-left px-4 py-3 min-h-14 disabled:opacity-50">
      <span className="flex-1 min-w-0">
        <span className="block font-bold leading-tight">{titulo}</span>
        {detalle && <span className="block text-sm text-salvia">{detalle}</span>}
      </span>
      <span className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${activo ? 'bg-hondo' : 'bg-menta'}`} aria-hidden="true">
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function Grupo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-tarjeta border border-menta divide-y divide-menta/70 overflow-hidden ${className}`}>{children}</div>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <p className="eyebrow px-1">{children}</p>;
}

// Chips de selección múltiple o única que bajan de renglón
export function Opciones<T extends string>({ opciones, elegidas, onCambio, multiple = true, etiqueta }: {
  opciones: readonly (readonly [T, string, ...unknown[]])[]; elegidas: T[]; onCambio: (v: T[]) => void; multiple?: boolean; etiqueta: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={etiqueta}>
      {opciones.map(([id, nombre]) => {
        const activa = elegidas.includes(id);
        return (
          <button key={id} type="button" className="chip" data-active={activa} aria-pressed={activa}
            onClick={() => onCambio(multiple ? (activa ? elegidas.filter((x) => x !== id) : [...elegidas, id]) : activa ? [] : [id])}>
            {nombre}
          </button>
        );
      })}
    </div>
  );
}

// Gráfica de temperatura basal del ciclo, con la línea de base de la regla de 3 sobre 6
export function GraficaTemperatura({ puntos, ovulacion, alto = 140 }: { puntos: { fecha: string; valor: number }[]; ovulacion?: string; alto?: number }) {
  if (puntos.length < 2) return <p className="text-sm text-salvia">Con dos o más temperaturas aparece la gráfica.</p>;
  const ordenados = [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const min = Math.min(...ordenados.map((p) => p.valor)) - 0.1;
  const max = Math.max(...ordenados.map((p) => p.valor)) + 0.1;
  const t0 = Date.parse(ordenados[0].fecha);
  const dias = Math.max(1, (Date.parse(ordenados[ordenados.length - 1].fecha) - t0) / 86400000);
  const ancho = 320;
  const x = (f: string) => 12 + ((Date.parse(f) - t0) / 86400000 / dias) * (ancho - 24);
  const y = (v: number) => 10 + (1 - (v - min) / (max - min)) * (alto - 30);
  const linea = ordenados.map((p, i) => `${i ? 'L' : 'M'}${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label={`Temperatura basal: ${ordenados.length} mediciones, de ${Math.min(...ordenados.map((p) => p.valor)).toFixed(2)} a ${Math.max(...ordenados.map((p) => p.valor)).toFixed(2)} grados`}>
        {ovulacion && ovulacion >= ordenados[0].fecha && (
          <line x1={x(ovulacion)} x2={x(ovulacion)} y1={6} y2={alto - 18} stroke="var(--color-esmeralda)" strokeDasharray="3 3" strokeWidth={1.5} />
        )}
        <path d={linea} fill="none" stroke="var(--color-bosque)" strokeWidth={2} strokeLinejoin="round" />
        {ordenados.map((p) => <circle key={p.fecha} cx={x(p.fecha)} cy={y(p.valor)} r={3} fill="var(--color-tarjeta)" stroke="var(--color-bosque)" strokeWidth={1.5} />)}
        <text x={4} y={alto - 4} fontSize={10} fill="var(--color-salvia)">{fechaCorta(ordenados[0].fecha)}</text>
        <text x={ancho - 4} y={alto - 4} fontSize={10} textAnchor="end" fill="var(--color-salvia)">{fechaCorta(ordenados[ordenados.length - 1].fecha)}</text>
        <text x={ancho - 4} y={12} fontSize={10} textAnchor="end" fill="var(--color-salvia)">{(max - 0.1).toFixed(2)} °C</text>
      </svg>
      {ovulacion && <figcaption className="text-xs text-salvia">La línea punteada es la ovulación detectada.</figcaption>}
    </figure>
  );
}
