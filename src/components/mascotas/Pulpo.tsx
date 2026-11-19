// El pulpo que pasea por el fondo. Allí se ve casi transparente, así que es solo su silueta en movimiento
// (sin piel, ventosas, brillos ni ojo animado: no se notaban y eran lo que más le costaba pintar al teléfono).
// - Los 8 brazos NO son formas fijas: cada cuadro se recalcula su espina (16 segmentos) con una onda que viaja
//   hacia la punta, y se apoyan en la arena y se despegan al ondular.
// - Respira de forma asimétrica (inhala lento, exhala rápido) y el sifón late con la exhalación.
// - Si está dentro de <Caminata>, su velocidad llega por contexto y cambia el ritmo de brazos, cuerpo y respiración.
import { createContext, useContext, useEffect, useRef, type MutableRefObject } from 'react';
import Soplo from './Soplo';
import { alCompas } from './reloj';

/** Velocidad normalizada (0 quieto … 1 reptando fuerte) que publica quien lo hace caminar */
export const VelocidadPulpo = createContext<MutableRefObject<number> | null>(null);
/** true mientras quien lo hace caminar lo tiene fuera de la pantalla: entonces no se pinta */
export const PulpoFuera = createContext<MutableRefObject<boolean> | null>(null);


type Props = {
  className?: string;
  /** Color principal del lomo */
  color?: string;
  /** Color claro de las burbujas */
  clara?: string;
  /** Muestra burbujitas que salen de la boca del sifón */
  burbujas?: boolean;
  /** Mira hacia la izquierda */
  espejo?: boolean;
  /** Animaciones de reposo: respiración y brazos que ondulan */
  vivo?: boolean;
};

const TAU = Math.PI * 2;
const N = 16; // segmentos por brazo
const SUELO = 124; // la arena, en coordenadas del viewBox
const EX = 177; // centro del ojo
const EY = 87;
const SOMBRA = '#3D1A12';

// ───────────────────────── utilidades ─────────────────────────
const f = (v: number) => v.toFixed(1);

function rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mezcla(a: string, b: string, t: number) {
  const pa = rgb(a);
  const pb = rgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Curva suave que pasa por los puntos (quadráticas entre puntos medios) */
function suave(px: number[], py: number[], cerrar: boolean): string {
  const n = px.length;
  if (cerrar) {
    let d = `M${f((px[0] + px[1]) / 2)} ${f((py[0] + py[1]) / 2)}`;
    for (let i = 1; i <= n; i++) {
      const a = i % n;
      const b = (i + 1) % n;
      d += `Q${f(px[a])} ${f(py[a])} ${f((px[a] + px[b]) / 2)} ${f((py[a] + py[b]) / 2)}`;
    }
    return d + 'Z';
  }
  let d = `M${f(px[0])} ${f(py[0])}`;
  for (let i = 1; i < n - 1; i++) {
    d += `Q${f(px[i])} ${f(py[i])} ${f((px[i] + px[i + 1]) / 2)} ${f((py[i] + py[i + 1]) / 2)}`;
  }
  return d + `L${f(px[n - 1])} ${f(py[n - 1])}`;
}

// ───────────────────────── anatomía ─────────────────────────
type Brazo = {
  rx: number; ry: number;       // raíz, pegada a la cabeza
  a0: number; a1: number;       // ángulo al salir y ángulo al que se relaja (rad, 0 = derecha, + = abajo)
  k: number;                    // qué tan rápido se relaja de a0 a a1
  punta: number;                // cuánto se enrosca la punta
  largo: number; w0: number;    // largo y medio ancho en la base
  amp: number; freq: number;    // amplitud y nº de ondas a lo largo del brazo
  ritmo: number; fase0: number; deriva: number; sondeo: number;
  capa: 'atras' | 'frente';
  oscuro: number; vel: number;
};

// 0-2: los que arrastra atrás · 3: el de apoyo bajo el cuerpo · 4-6: los que tantean en la arena · 7: el alzado
const BRAZOS: Brazo[] = [
  { rx: 138, ry: 101, a0: 2.15, a1: 3.3, k: 3.0, punta: -0.8, largo: 70, w0: 6.2, amp: 0.3, freq: 1.0, ritmo: 0.31, fase0: 1.0, deriva: 0.1, sondeo: 0.3, capa: 'atras', oscuro: 0.4, vel: 0.8 },
  { rx: 144, ry: 103, a0: 1.95, a1: 3.08, k: 3.2, punta: 0.6, largo: 82, w0: 6.8, amp: 0.28, freq: 1.3, ritmo: 0.27, fase0: 2.4, deriva: 0.12, sondeo: 0.25, capa: 'atras', oscuro: 0.32, vel: 0.9 },
  { rx: 150, ry: 104, a0: 1.7, a1: 2.95, k: 3.4, punta: -0.5, largo: 76, w0: 6.6, amp: 0.26, freq: 1.2, ritmo: 0.36, fase0: 3.7, deriva: 0.1, sondeo: 0.3, capa: 'atras', oscuro: 0.26, vel: 1.0 },
  { rx: 158, ry: 105, a0: 1.35, a1: 2.7, k: 3.4, punta: -0.4, largo: 52, w0: 6.0, amp: 0.3, freq: 1.4, ritmo: 0.4, fase0: 4.9, deriva: 0.1, sondeo: 0.2, capa: 'frente', oscuro: 0.16, vel: 1.1 },
  { rx: 166, ry: 106, a0: 1.0, a1: 0.15, k: 4.2, punta: -0.6, largo: 68, w0: 6.2, amp: 0.26, freq: 1.3, ritmo: 0.33, fase0: 0.6, deriva: 0.08, sondeo: 0.2, capa: 'frente', oscuro: 0.1, vel: 1.0 },
  { rx: 174, ry: 105, a0: 0.85, a1: 0.08, k: 3.8, punta: -0.9, largo: 80, w0: 6.2, amp: 0.28, freq: 1.2, ritmo: 0.29, fase0: 2.0, deriva: 0.1, sondeo: 0.25, capa: 'frente', oscuro: 0.06, vel: 0.95 },
  { rx: 182, ry: 102, a0: 0.8, a1: 0.0, k: 3.4, punta: -1.3, largo: 90, w0: 6.0, amp: 0.3, freq: 1.1, ritmo: 0.37, fase0: 3.1, deriva: 0.12, sondeo: 0.3, capa: 'frente', oscuro: 0.03, vel: 0.85 },
  { rx: 188, ry: 98, a0: -0.1, a1: -0.65, k: 2.4, punta: 2.6, largo: 78, w0: 5.4, amp: 0.38, freq: 0.9, ritmo: 0.5, fase0: 0.2, deriva: 0.2, sondeo: 0.6, capa: 'frente', oscuro: 0, vel: 0.6 },
];

// Membranas entre brazos vecinos (nacen en la base y llegan hasta el segmento m)
const MEMBRANAS: { a: number; b: number; m: number; capa: 'atras' | 'frente' }[] = [
  { a: 0, b: 1, m: 5, capa: 'atras' },
  { a: 1, b: 2, m: 5, capa: 'atras' },
  { a: 3, b: 4, m: 3, capa: 'frente' },
  { a: 4, b: 5, m: 5, capa: 'frente' },
  { a: 5, b: 6, m: 5, capa: 'frente' },
  { a: 6, b: 7, m: 4, capa: 'frente' },
];

const ancho = (a: Brazo, s: number) => a.w0 * Math.pow(1 - s, 0.9) + 0.5;

// Silueta del cuerpo
const MANTO = 'M34 100 C24 74 38 42 74 32 C108 22 142 34 158 58 C164 68 166 82 162 92 C150 105 126 109 98 109 C68 109 42 108 34 100 Z';
const CABEZA = 'M148 78 C152 66 166 60 181 63 C196 67 203 80 199 92 C195 103 183 107 168 107 C155 107 147 98 147 88 Z';
const CUELLO = 'M144 60 C152 60 158 63 163 68 L163 102 L144 102 Z';
const SIFON = 'M171 101 C173 109 182 114 191 116 L195 111 C189 109 185 105 184 100 Z';

type Refs = {
  arm: SVGPathElement[]; web: SVGPathElement[];
  cuerpo: SVGGElement | null; sifon: SVGGElement | null;
};

export default function Pulpo({
  className = '',
  color = '#A34A38',
  clara = '#E9D9C6',
  burbujas = false,
  espejo = false,
  vivo = true,
}: Props) {
  const velRef = useContext(VelocidadPulpo);
  const fueraRef = useContext(PulpoFuera);
  const refs = useRef<Refs>({
    arm: [], web: [], cuerpo: null, sifon: null,
  });

  useEffect(() => {
    const r = refs.current;
    const reducido = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const anima = vivo && !reducido;

    const espinas = BRAZOS.map(() => ({ x: new Array<number>(N + 1).fill(0), y: new Array<number>(N + 1).fill(0) }));
    const lx = new Array<number>(N + 1), ly = new Array<number>(N + 1);
    const rx = new Array<number>(N + 1), ry = new Array<number>(N + 1);

    let ultimo = performance.now();
    let t = Math.random() * 40;
    let fase = Math.random() * 10;
    let vel = 0;

    const pinta = (dt: number) => {
      const objetivo = anima ? Math.max(0, Math.min(1, velRef?.current ?? 0)) : 0;
      vel += (objetivo - vel) * Math.min(1, dt * 3);
      fase += dt * (0.7 + 3.8 * vel);

      // Respiración: inhala lento, exhala rápido
      const T = 3.6 - 1.3 * vel;
      const p = (t % T) / T;
      const resp = p < 0.6 ? 0.5 - 0.5 * Math.cos((Math.PI * p) / 0.6) : 0.5 + 0.5 * Math.cos((Math.PI * (p - 0.6)) / 0.4);
      const pulso = p > 0.6 ? Math.sin((Math.PI * (p - 0.6)) / 0.4) : 0;

      // El cuerpo se mece al reptar: sube y baja con los empujes y se inclina hacia atrás
      const bob = vel * 1.2 * Math.sin(fase * 1.1) + 0.35 * Math.sin(t * 0.7);
      const tilt = -vel * 1.4 + vel * 0.9 * Math.sin(fase * 0.55);

      // ── Brazos
      for (let i = 0; i < BRAZOS.length; i++) {
        const a = BRAZOS[i];
        const { x, y } = espinas[i];
        const paso = a.largo / N;
        x[0] = a.rx;
        y[0] = a.ry + bob;
        const punta = a.punta + a.sondeo * Math.sin(t * a.ritmo * 1.7 + a.fase0);
        const ampli = a.amp * (0.35 + 0.9 * vel);
        for (let k = 1; k <= N; k++) {
          const s = (k - 0.5) / N;
          const base = a.a1 + (a.a0 - a.a1) * Math.exp(-s * a.k) + punta * s * s * s;
          const onda = ampli * Math.pow(s, 0.9) * Math.sin(TAU * s * a.freq - fase * a.vel + a.fase0);
          const deriva = a.deriva * Math.sin(t * a.ritmo + a.fase0) * s;
          const ang = base + onda + deriva;
          x[k] = x[k - 1] + Math.cos(ang) * paso;
          let yy = y[k - 1] + Math.sin(ang) * paso;
          const tope = SUELO - ancho(a, k / N) * 0.8;
          if (yy > tope) yy = tope; // la arena sostiene el brazo
          y[k] = yy;
        }

        // Bordes del brazo
        for (let k = 0; k <= N; k++) {
          const k0 = Math.max(0, k - 1);
          const k1 = Math.min(N, k + 1);
          let tx = x[k1] - x[k0];
          let ty = y[k1] - y[k0];
          const l = Math.hypot(tx, ty) || 1;
          tx /= l; ty /= l;
          const h = ancho(a, k / N);
          const nx = -ty, ny = tx;
          lx[k] = x[k] + nx * h; ly[k] = y[k] + ny * h;
          rx[k] = x[k] - nx * h; ry[k] = y[k] - ny * h;
        }
        const polyX = lx.concat(rx.slice().reverse());
        const polyY = ly.concat(ry.slice().reverse());
        r.arm[i]?.setAttribute('d', suave(polyX, polyY, true));
      }

      // ── Membranas entre brazos
      MEMBRANAS.forEach((w, i) => {
        const A = espinas[w.a], B = espinas[w.b];
        const xs = A.x.slice(0, w.m + 1).concat(B.x.slice(0, w.m + 1).reverse());
        const ys = A.y.slice(0, w.m + 1).concat(B.y.slice(0, w.m + 1).reverse());
        r.web[i]?.setAttribute('d', suave(xs, ys, true));
      });

      // ── Cuerpo: respira, se mece y el sifón late
      r.cuerpo?.setAttribute(
        'transform',
        `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 150 108) translate(110 108) scale(${(1 + 0.01 * resp).toFixed(4)} ${(1 + 0.026 * resp).toFixed(4)}) translate(-110 -108)`,
      );
      r.sifon?.setAttribute('transform', `translate(176 101) scale(${(1 + 0.2 * pulso).toFixed(3)}) translate(-176 -101)`);
    };

    // Al compás del reloj del fondo (pocos cuadros por segundo; ver reloj.ts)
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.08, (ahora - ultimo) / 1000);
      ultimo = ahora;
      // Fuera de la pantalla no hay nada que pintar
      if (fueraRef?.current) return;
      t += dt;
      pinta(dt);
    };
    // El primer cuadro se pinta siempre, para que no aparezca vacío
    pinta(0);
    return anima ? alCompas(cuadro) : undefined;
  }, [vivo, velRef, fueraRef]);

  // ── Colores derivados
  const tonos = BRAZOS.map((a) => mezcla(color, SOMBRA, a.oscuro));
  const tonoMembrana = mezcla(color, SOMBRA, 0.22);

  const brazo = (i: number) => (
    <path key={`b${i}`} ref={(el) => { if (el) refs.current.arm[i] = el; }} fill={tonos[i]} />
  );


  const capa = (cual: 'atras' | 'frente') => (
    <g>
      {MEMBRANAS.map((w, i) =>
        w.capa === cual ? (
          <path key={`w${i}`} ref={(el) => { if (el) refs.current.web[i] = el; }} fill={tonoMembrana} fillOpacity="0.92" />
        ) : null,
      )}
      {BRAZOS.map((a, i) => (a.capa === cual ? brazo(i) : null))}
    </g>
  );

  return (
    <div className={`mascota ${className}`} aria-hidden="true">
      {burbujas && (
        <Soplo caja={[188, 78, 18, 40]} espejo={espejo} stroke={clara} strokeWidth="1" fill="none">
          <circle cx="196" cy="114" r="2" />
          <circle cx="202" cy="102" r="1.5" />
          <circle cx="194" cy="90" r="1.2" />
          <circle cx="200" cy="80" r="0.85" fill={clara} stroke="none" />
        </Soplo>
      )}
      <svg viewBox="10 0 290 140" className="relative block w-full h-full overflow-visible">
        <g transform={espejo ? 'translate(310 0) scale(-1 1)' : undefined}>
          {/* La sombra sobre la arena */}
          <ellipse cx="150" cy="127" rx="112" ry="5" fill={SOMBRA} opacity="0.2" />
          <ellipse cx="150" cy="126" rx="70" ry="3" fill={SOMBRA} opacity="0.18" />

          {capa('atras')}
          {capa('frente')}

          {/* Manto, cabeza y ojo: respiran y se mecen juntos. De color liso: en el fondo solo se ve la silueta */}
          <g ref={(el) => { refs.current.cuerpo = el; }}>
            <path d={CUELLO} fill={color} />
            <path d={MANTO} fill={color} />
            <path d={CABEZA} fill={color} />
            <ellipse cx={EX} cy={EY} rx="6" ry="5.4" fill={SOMBRA} />

            {/* Sifón */}
            <g ref={(el) => { refs.current.sifon = el; }}>
              <path d={SIFON} fill={mezcla(color, SOMBRA, 0.25)} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}