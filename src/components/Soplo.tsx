// El chorrito de agua o las burbujas de una mascota, en su propia capa SVG detrás del cuerpo y por fuera del dibujo grande.
// El aparte es a propósito: animar dentro del SVG obligaría a repintar el cuerpo entero en cada cuadro.
import type { ReactNode, SVGProps } from 'react';

type Props = {
  /** Dónde va dentro del dibujo de la mascota (240 × 140): x, y, ancho y alto */
  caja: [number, number, number, number];
  espejo?: boolean;
  children: ReactNode;
} & SVGProps<SVGGElement>;

/**
 * El chorrito o las burbujas de una mascota, en su propia capa detrás del cuerpo.
 * Va aparte porque una animación dentro de un SVG obliga a repintar el dibujo entero en cada cuadro:
 * así el cuerpo se pinta una sola vez y esto lo mueve la tarjeta gráfica.
 */
export default function Soplo({ caja: [x, y, ancho, alto], espejo = false, children, ...trazo }: Props) {
  return (
    <svg viewBox={`${x} ${y} ${ancho} ${alto}`} className="ballena-soplo absolute overflow-visible"
      style={{ left: `${(espejo ? 240 - x - ancho : x) / 2.4}%`, top: `${y / 1.4}%`, width: `${ancho / 2.4}%`, height: `${alto / 1.4}%` }}>
      <g transform={espejo ? `translate(${2 * x + ancho} 0) scale(-1 1)` : undefined} {...trazo}>{children}</g>
    </svg>
  );
}
