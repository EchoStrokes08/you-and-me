// Utilidades de dibujo que comparten las mascotas y el fondo: azar con semilla fija (para que un SVG salga siempre igual), curvas suaves con Bézier y el trazo de una aleta en abanico.
export type P = [number, number];

/** Pseudo-aleatorio estable (Park-Miller): siempre da la misma secuencia */
export function semilla(s: number) {
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const r1 = (v: number) => Math.round(v * 10) / 10;

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos */
export function suave(p: P[], cerrado = true): string {
  const n = p.length;
  const en = (i: number) => (cerrado ? p[(i + n) % n] : p[Math.min(n - 1, Math.max(0, i))]);
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  for (let i = 0; i < (cerrado ? n : n - 1); i++) {
    const [a, b, c, e] = [en(i - 1), en(i), en(i + 1), en(i + 2)];
    d += ` C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${r1(c[0])} ${r1(c[1])}`;
  }
  return cerrado ? `${d} Z` : d;
}

/** Punto sobre una curva Bézier cúbica */
export function bezier(a: P, b: P, c: P, d: P, t: number): P {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/** Área con signo: positiva si el contorno va en sentido horario en pantalla */
export function areaFirmada(p: P[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/**
 * Aleta en abanico: la base va de `a` a `b` (pegada al cuerpo) y el borde es un arco
 * de elipse centrado en `c`, de `desde` a `hasta` grados. `dientes` festonea el borde.
 */
export function aleta(a: P, b: P, c: P, rx: number, ry: number, desde: number, hasta: number, n = 8, dientes = 0) {
  const borde: P[] = [];
  for (let i = 0; i <= n; i++) {
    const th = ((desde + ((hasta - desde) * i) / n) * Math.PI) / 180;
    const k = 1 - (i % 2 ? dientes : 0);
    borde.push([c[0] + rx * k * Math.cos(th), c[1] + ry * k * Math.sin(th)]);
  }
  const radios: string[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const bx = a[0] + (b[0] - a[0]) * t;
    const by = a[1] + (b[1] - a[1]) * t;
    const [ex, ey] = borde[i];
    radios.push(`M${r1(bx + (ex - bx) * 0.2)} ${r1(by + (ey - by) * 0.2)} L${r1(bx + (ex - bx) * 0.88)} ${r1(by + (ey - by) * 0.88)}`);
  }
  return { forma: suave([a, ...borde, b]), borde: suave(borde, false), radios };
}