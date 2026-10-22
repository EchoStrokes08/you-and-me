// "Nuestra película": arma las escenas con los recuerdos y las dibuja en un lienzo vertical.
// draw(t) es puro respecto al tiempo: sirve igual para verla y para grabarla.
import { supabase } from './supabase';
import { urlsFirmadas } from './fotos';
import { renglones } from './tarjetaResumen';

export const ANCHO = 720, ALTO = 1280;
const FUNDIDO = 0.7;
const TITULO = 'Fraunces, serif', TEXTO = 'Nunito, sans-serif';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MAX_RECUERDOS = 24, MAX_VIDEOS = 3, SEG_VIDEO = 5;

type Recuerdo = { id: string; titulo: string; fecha: string; lugar_texto: string | null; descripcion: string | null; calificacion: number };
type Medio = { img?: ImageBitmap; video?: HTMLVideoElement };

export type Escena =
  | { tipo: 'intro'; inicio: number; dur: number }
  | { tipo: 'cifras'; inicio: number; dur: number }
  | { tipo: 'mes'; inicio: number; dur: number; mes: string; anio: string }
  | { tipo: 'foto' | 'video'; inicio: number; dur: number; medio: Medio; r: Recuerdo; primera: boolean; dir: number }
  | { tipo: 'final'; inicio: number; dur: number };

export type Pelicula = {
  escenas: Escena[];
  total: number;
  nombres: string;
  rango: string;
  cifras: { n: number; txt: string }[];
  ballena: HTMLImageElement | null;
  videos: HTMLVideoElement[];
  liberar: () => void;
};

export type Rango = { desde: string | null; hasta: string | null; etiqueta: string };

const fechaLarga = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

async function bajarImagen(url: string): Promise<ImageBitmap | null> {
  try {
    const blob = await (await fetch(url)).blob();
    // Más pequeñas que el original: con 60 fotos en memoria el celular lo agradece
    try { return await createImageBitmap(blob, { resizeWidth: 1000, resizeQuality: 'medium' }); } catch { return await createImageBitmap(blob); }
  } catch {
    return null;
  }
}

async function bajarVideo(url: string, urls: string[]): Promise<HTMLVideoElement | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const local = URL.createObjectURL(blob);
    urls.push(local);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = local;
    await new Promise<void>((ok, mal) => {
      const t = setTimeout(() => mal(new Error('tarde')), 10000);
      v.addEventListener('loadeddata', () => { clearTimeout(t); ok(); }, { once: true });
      v.addEventListener('error', () => { clearTimeout(t); mal(new Error('video')); }, { once: true });
    });
    return v;
  } catch {
    return null;
  }
}

// El SVG de la mascota que se ve en la pantalla, convertido en imagen para el lienzo
export async function imagenDeSvg(svg: SVGSVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return null;
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const vb = copia.viewBox.baseVal;
  copia.setAttribute('width', String((vb?.width || 300) * 3));
  copia.setAttribute('height', String((vb?.height || 200) * 3));
  // Sin las clases de animación: en el lienzo se mueve con el tiempo de la película
  copia.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
    return img;
  } catch {
    return null;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Trae los recuerdos del rango, baja sus fotos y videos y arma la línea de tiempo */
export async function armarPelicula(rango: Rango, ballena: HTMLImageElement | null, conVideos: boolean, progreso: (hechas: number, total: number) => void): Promise<Pelicula | null> {
  await Promise.all([`600 60px ${TITULO}`, `700 100px ${TITULO}`, `italic 500 60px ${TITULO}`, `700 30px ${TEXTO}`, `800 30px ${TEXTO}`].map((f) => document.fonts.load(f).catch(() => null)));

  let q = supabase.from('recuerdos').select('id, titulo, fecha, lugar_texto, descripcion, calificacion').order('fecha');
  if (rango.desde) q = q.gte('fecha', rango.desde);
  if (rango.hasta) q = q.lte('fecha', rango.hasta);
  const [{ data: rs }, { data: cfg }] = await Promise.all([q, supabase.from('configuracion').select('nombre_el, nombre_ella, fecha_inicio').eq('id', 1).single()]);
  if (!rs?.length) return null;

  const { data: fs } = await supabase.from('fotos_recuerdo').select('recuerdo_id, ruta, orden, tipo, favorita').in('recuerdo_id', rs.map((r) => r.id)).order('orden');
  const porRecuerdo = new Map<string, NonNullable<typeof fs>>();
  for (const f of fs ?? []) (porRecuerdo.get(f.recuerdo_id) ?? porRecuerdo.set(f.recuerdo_id, []).get(f.recuerdo_id)!).push(f);

  // Con muchos recuerdos se quedan los mejor calificados y los que tienen fotos; luego, en orden de fecha
  let elegidos = rs.filter((r) => porRecuerdo.get(r.id)?.length);
  if (elegidos.length > MAX_RECUERDOS) {
    elegidos = [...elegidos].sort((a, b) => b.calificacion - a.calificacion || (porRecuerdo.get(b.id)!.length - porRecuerdo.get(a.id)!.length)).slice(0, MAX_RECUERDOS)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  if (!elegidos.length) return null;
  const porCada = elegidos.length <= 5 ? 5 : elegidos.length <= 12 ? 3 : 2;

  // Primero las favoritas; un video por recuerdo como mucho
  let videosUsados = 0;
  const plan = elegidos.map((r) => {
    const todas = porRecuerdo.get(r.id)!;
    const fotos = todas.filter((f) => f.tipo !== 'video').sort((a, b) => Number(b.favorita) - Number(a.favorita) || a.orden - b.orden).slice(0, porCada);
    const video = conVideos && videosUsados < MAX_VIDEOS ? todas.find((f) => f.tipo === 'video') : undefined;
    if (video) videosUsados++;
    return { r, fotos, video };
  });

  const rutas = plan.flatMap((p) => [...p.fotos.map((f) => f.ruta), ...(p.video ? [p.video.ruta] : [])]);
  const firmadas = await urlsFirmadas(rutas);
  const total = rutas.length;
  let hechas = 0;
  progreso(0, total);
  const urlsLocales: string[] = [];
  const bitmaps: ImageBitmap[] = [];

  // De a cuatro a la vez para no ahogar la conexión
  const medios = new Map<string, Medio>();
  const cola = [...rutas];
  const esVideo = new Set(plan.flatMap((p) => (p.video ? [p.video.ruta] : [])));
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let ruta = cola.shift(); ruta; ruta = cola.shift()) {
      const url = firmadas[ruta];
      if (url) {
        if (esVideo.has(ruta)) { const v = await bajarVideo(url, urlsLocales); if (v) medios.set(ruta, { video: v }); }
        else { const img = await bajarImagen(url); if (img) { bitmaps.push(img); medios.set(ruta, { img }); } }
      }
      progreso(++hechas, total);
    }
  }));

  // La línea de tiempo: cada escena empieza un fundido antes de que acabe la anterior
  const escenas: Escena[] = [];
  let t = 0;
  type SinInicio = Escena extends infer E ? (E extends Escena ? Omit<E, 'inicio'> : never) : never;
  const poner = (e: SinInicio) => { escenas.push({ ...e, inicio: t } as Escena); t += e.dur - FUNDIDO; };
  poner({ tipo: 'intro', dur: 5.5 });
  poner({ tipo: 'cifras', dur: 4.2 });
  let mesActual = '';
  let dir = 1;
  let nFotos = 0;
  for (const p of plan) {
    const clave = p.r.fecha.slice(0, 7);
    const ms = [...p.fotos.map((f) => medios.get(f.ruta)).filter(Boolean), ...(p.video && medios.get(p.video.ruta) ? [medios.get(p.video.ruta)] : [])] as Medio[];
    if (!ms.length) continue;
    if (clave !== mesActual) {
      mesActual = clave;
      poner({ tipo: 'mes', dur: 2.2, mes: MESES[Number(clave.slice(5, 7)) - 1], anio: clave.slice(0, 4) });
    }
    ms.forEach((m, i) => {
      dir = -dir;
      if (m.video) poner({ tipo: 'video', dur: Math.min(SEG_VIDEO, m.video.duration || SEG_VIDEO) + FUNDIDO, medio: m, r: p.r, primera: i === 0, dir });
      else { nFotos++; poner({ tipo: 'foto', dur: i === 0 ? 4.2 : 3.2, medio: m, r: p.r, primera: i === 0, dir }); }
    });
  }
  poner({ tipo: 'final', dur: 6.5 });
  const totalSeg = t + FUNDIDO;

  const diasJuntos = cfg?.fecha_inicio ? Math.floor((Date.now() - new Date(cfg.fecha_inicio + 'T00:00:00').getTime()) / 86400000) : 0;
  const desde = rango.desde ?? elegidos[0].fecha;
  const hasta = rango.hasta && rango.hasta < new Date().toISOString().slice(0, 10) ? rango.hasta : elegidos[elegidos.length - 1].fecha;

  return {
    escenas,
    total: totalSeg,
    nombres: [cfg?.nombre_el, cfg?.nombre_ella].filter(Boolean).join(' & ') || 'You and me',
    rango: `${fechaLarga(desde)} — ${fechaLarga(hasta)}`,
    cifras: [
      rango.desde ? { n: elegidos.length, txt: elegidos.length === 1 ? 'recuerdo' : 'recuerdos' } : { n: diasJuntos, txt: 'días juntos' },
      rango.desde ? { n: nFotos, txt: 'fotos en esta película' } : { n: rs.length, txt: rs.length === 1 ? 'recuerdo guardado' : 'recuerdos guardados' },
      { n: (fs ?? []).length, txt: 'fotos y videos de los dos' },
    ],
    ballena,
    videos: [...medios.values()].flatMap((m) => (m.video ? [m.video] : [])),
    liberar: () => { bitmaps.forEach((b) => b.close()); urlsLocales.forEach((u) => URL.revokeObjectURL(u)); },
  };
}

/* ---------- Dibujo ---------- */

const suave = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const entre = (t: number, a: number, b: number) => suave((t - a) / (b - a));

// Plancton fijo: cada punto con su lugar y su velocidad
const PLANCTON = Array.from({ length: 46 }, (_, i) => {
  const s = Math.sin(i * 91.7) * 10000;
  const r = s - Math.floor(s);
  const s2 = Math.sin(i * 47.3) * 10000;
  return { x: r * ANCHO, y: (s2 - Math.floor(s2)) * ALTO, v: 8 + r * 22, tam: 1.2 + r * 2.6 };
});

function mar(ctx: CanvasRenderingContext2D, t: number, hondo = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, ALTO);
  g.addColorStop(0, hondo ? '#165040' : '#2B7A5C'); g.addColorStop(0.55, hondo ? '#0C2F27' : '#165040'); g.addColorStop(1, '#06181A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  // Rayos de luz que se mecen
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = ANCHO * (0.25 + i * 0.28) + Math.sin(t * 0.4 + i) * 40;
    ctx.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 2);
    ctx.fillStyle = '#C3E08A';
    ctx.beginPath();
    ctx.moveTo(x - 40, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 180, ALTO * 0.8); ctx.lineTo(x - 10, ALTO * 0.8);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#CFE9E4';
  for (const p of PLANCTON) {
    const y = ((p.y - t * p.v) % ALTO + ALTO) % ALTO;
    ctx.globalAlpha = 0.18 + 0.15 * Math.sin(t + p.x);
    ctx.beginPath(); ctx.arc(p.x + Math.sin(t * 0.6 + p.y) * 8, y, p.tam, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function textoCentrado(ctx: CanvasRenderingContext2D, txt: string, y: number, font: string, color: string, alpha: number, espacio = 0) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.letterSpacing = `${espacio}px`;
  ctx.fillText(txt, ANCHO / 2, y);
  ctx.restore();
}

function ballena(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, ancho: number, giro: number) {
  if (!img) return;
  const alto = ancho * (img.height / img.width);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(giro);
  ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto);
  ctx.restore();
}

function corazon(ctx: CanvasRenderingContext2D, cx: number, cy: number, tam: number) {
  const s = tam / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s); ctx.scale(s, s);
  ctx.fill(new Path2D('M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.1 5.3 3 1.8-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z'));
  ctx.restore();
}

// La foto llena la pantalla y se acerca despacio (Ken Burns), hacia un lado o el otro
function cubrir(ctx: CanvasRenderingContext2D, fuente: CanvasImageSource, w: number, h: number, avance: number, dir: number) {
  const zoom = 1.04 + 0.12 * avance;
  const escala = Math.max(ANCHO / w, ALTO / h) * zoom;
  const dw = w * escala, dh = h * escala;
  const libreX = dw - ANCHO, libreY = dh - ALTO;
  const x = -libreX / 2 + dir * libreX * 0.35 * (avance - 0.5);
  const y = -libreY / 2 - libreY * 0.2 * (avance - 0.5);
  ctx.drawImage(fuente, x, y, dw, dh);
}

function escena(ctx: CanvasRenderingContext2D, p: Pelicula, e: Escena, lt: number, t: number) {
  switch (e.tipo) {
    case 'intro': {
      mar(ctx, t);
      const x = -ANCHO * 0.5 + (ANCHO * 1.0) * suave(lt / 4.5);
      ballena(ctx, p.ballena, x, ALTO * 0.6 + Math.sin(lt * 1.4) * 14, ANCHO * 0.82, Math.sin(lt * 1.4) * 0.03);
      textoCentrado(ctx, 'NUESTRA PELÍCULA', ALTO * 0.2, `800 26px ${TEXTO}`, '#C3E08A', entre(lt, 0.3, 1.1), 7);
      textoCentrado(ctx, p.nombres, ALTO * 0.2 + 100, `700 76px ${TITULO}`, '#FFFFFF', entre(lt, 0.7, 1.6));
      textoCentrado(ctx, p.rango, ALTO * 0.2 + 160, `italic 500 26px ${TITULO}`, '#CFE9E4', entre(lt, 1.3, 2.2));
      break;
    }
    case 'cifras': {
      mar(ctx, t, 1);
      p.cifras.forEach((c, i) => {
        const a = entre(lt, 0.3 + i * 0.6, 1 + i * 0.6);
        const y = ALTO * 0.3 + i * 260 + (1 - a) * 30;
        textoCentrado(ctx, c.n.toLocaleString('es-CO'), y, `700 150px ${TITULO}`, '#FFFFFF', a);
        textoCentrado(ctx, c.txt, y + 60, `700 34px ${TEXTO}`, '#C3E08A', a);
      });
      break;
    }
    case 'mes': {
      mar(ctx, t, 1);
      const a = entre(lt, 0.15, 0.8);
      ctx.save(); ctx.translate(0, (1 - a) * 24);
      textoCentrado(ctx, e.mes, ALTO * 0.5, `italic 500 120px ${TITULO}`, '#FFFFFF', a);
      textoCentrado(ctx, e.anio, ALTO * 0.5 + 70, `800 32px ${TEXTO}`, '#C3E08A', a, 8);
      ctx.restore();
      break;
    }
    case 'foto':
    case 'video': {
      ctx.fillStyle = '#06181A';
      ctx.fillRect(0, 0, ANCHO, ALTO);
      const avance = lt / e.dur;
      if (e.medio.img) cubrir(ctx, e.medio.img, e.medio.img.width, e.medio.img.height, avance, e.dir);
      else if (e.medio.video && e.medio.video.readyState >= 2) cubrir(ctx, e.medio.video, e.medio.video.videoWidth, e.medio.video.videoHeight, avance * 0.4, e.dir);
      // Velo de abajo para que el texto se lea sobre cualquier foto
      const velo = ctx.createLinearGradient(0, ALTO * 0.5, 0, ALTO);
      velo.addColorStop(0, 'rgba(6,24,26,0)'); velo.addColorStop(1, `rgba(6,24,26,${e.primera ? 0.88 : 0.55})`);
      ctx.fillStyle = velo;
      ctx.fillRect(0, ALTO * 0.5, ANCHO, ALTO * 0.5);
      ctx.textAlign = 'left';
      if (e.primera) {
        const a = entre(lt, 0.3, 1.1);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 20);
        ctx.font = `600 58px ${TITULO}`;
        const lineas = renglones(ctx, e.r.titulo, ANCHO - 120, 3);
        ctx.font = `italic 500 28px ${TITULO}`;
        const nota = e.r.descripcion ? renglones(ctx, `«${e.r.descripcion}»`, ANCHO - 120, 2) : [];
        let y = ALTO - 120 - nota.length * 38 - 50 - (lineas.length - 1) * 64;
        ctx.fillStyle = '#FFFFFF'; ctx.font = `600 58px ${TITULO}`;
        for (const l of lineas) { ctx.fillText(l, 60, y); y += 64; }
        ctx.fillStyle = '#CFE9E4'; ctx.font = `700 26px ${TEXTO}`;
        const meta = [fechaCorta(e.r.fecha), e.r.lugar_texto].filter(Boolean).join(' · ');
        ctx.fillText(meta.charAt(0).toUpperCase() + meta.slice(1), 60, y - 10);
        y += 40;
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `italic 500 28px ${TITULO}`;
        for (const l of nota) { ctx.fillText(l, 60, y); y += 38; }
        ctx.fillStyle = '#C3E08A';
        for (let i = 0; i < e.r.calificacion; i++) corazon(ctx, 74 + i * 36, ALTO - 84, 28);
        ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha = 0.85 * entre(lt, 0.2, 0.8);
        ctx.fillStyle = '#FFFFFF'; ctx.font = `700 26px ${TEXTO}`;
        ctx.fillText(renglones(ctx, e.r.titulo, ANCHO - 120, 1)[0] ?? '', 60, ALTO - 70);
        ctx.restore();
      }
      break;
    }
    case 'final': {
      mar(ctx, t, 1);
      const x = ANCHO * 0.2 + ANCHO * 0.6 * (lt / e.dur);
      ballena(ctx, p.ballena, x, ALTO * 0.66 + Math.sin(lt * 1.2) * 12, ANCHO * 0.6, Math.sin(lt * 1.2) * 0.03);
      textoCentrado(ctx, 'Y todo lo que nos falta', ALTO * 0.32, `italic 500 58px ${TITULO}`, '#FFFFFF', entre(lt, 0.4, 1.4));
      const b = entre(lt, 1.6, 2.6);
      ctx.save(); ctx.globalAlpha = b; ctx.fillStyle = '#C3E08A'; corazon(ctx, ANCHO / 2, ALTO * 0.32 + 90, 46); ctx.restore();
      textoCentrado(ctx, 'YOU AND ME', ALTO * 0.32 + 170, `800 28px ${TEXTO}`, '#C3E08A', b, 8);
      break;
    }
  }
}

/** Dibuja el cuadro del segundo `t` */
export function dibujar(ctx: CanvasRenderingContext2D, p: Pelicula, t: number) {
  const activas = p.escenas.filter((e) => t >= e.inicio && t < e.inicio + e.dur);
  if (!activas.length) { ctx.fillStyle = '#06181A'; ctx.fillRect(0, 0, ANCHO, ALTO); return; }
  activas.forEach((e, i) => {
    ctx.save();
    ctx.globalAlpha = i === 0 ? 1 : suave((t - e.inicio) / FUNDIDO);
    escena(ctx, p, e, t - e.inicio, t);
    ctx.restore();
  });
  // Entra desde el negro y se va al negro
  const negro = Math.max(1 - t / 0.9, (t - (p.total - 1.2)) / 1.2);
  if (negro > 0) { ctx.fillStyle = `rgba(6,24,26,${Math.min(1, negro)})`; ctx.fillRect(0, 0, ANCHO, ALTO); }
}

/** Los videos suenan en silencio y avanzan solo mientras su escena está en pantalla */
export function sincronizarVideos(p: Pelicula, t: number, andando: boolean) {
  for (const e of p.escenas) {
    if (e.tipo !== 'video' || !e.medio.video) continue;
    const v = e.medio.video;
    const activa = t >= e.inicio && t < e.inicio + e.dur;
    if (activa && andando && v.paused) {
      const lt = t - e.inicio;
      if (Math.abs(v.currentTime - lt) > 0.4) v.currentTime = Math.min(lt, Math.max(0, v.duration - 0.1));
      v.play().catch(() => {});
    } else if ((!activa || !andando) && !v.paused) v.pause();
  }
}
