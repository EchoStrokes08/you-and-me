// Dibuja las páginas del libro en un lienzo cuadrado (20 × 20 cm a ~260 ppp) y las entrega como JPEG.
// Usa los colores claros de la app (en papel no hay modo oscuro) y sus fuentes, Fraunces y Nunito.
// Las fotos se bajan de a pocas y se sueltan apenas se dibujan: un libro de 150 páginas cabe en un celular.
import { urlsFirmadas } from '../media/fotos';
import type { CartaLibro, DatosLibro, Pagina, ParPregunta, RecuerdoLibro } from './datos';
import type { PaginaJpeg } from './pdf';

export const LADO = 2048;
export const CM = 20;
const M = 170; // margen
const TITULO = 'Fraunces, serif', TEXTO = 'Nunito, sans-serif';
const C = {
  crema: '#F1F6EE', papel: '#FFFDF7', tinta: '#17332A', bosque: '#1F6B4A', salvia: '#456B58', menta: '#CFE6D7',
  seleccion: '#E6F3EA', lima: '#C3E08A', coral: '#A94E35', espuma: '#CFE9E4', mar1: '#2B7A5C', mar2: '#165040', mar3: '#0C2F27',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Ctx = CanvasRenderingContext2D;
type Fotos = { tomar: (ruta: string) => Promise<ImageBitmap | null> };

const fechaLarga = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Ayudas de dibujo ---------- */

function fuente(ctx: Ctx, f: string, color: string, espaciado = 0) {
  ctx.font = f;
  ctx.fillStyle = color;
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${espaciado}px`;
}

// Parte el texto en renglones que caben en `ancho`, respetando los saltos de línea; con `max`, corta con …
export function renglones(ctx: Pick<Ctx, 'measureText'>, texto: string, ancho: number, max = Infinity): string[] {
  const out: string[] = [];
  for (const parrafo of texto.replace(/\r/g, '').split('\n')) {
    let linea = '';
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) { out.push(''); continue; }
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
      else { out.push(linea); linea = palabra; }
    }
    out.push(linea);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  if (out.length > max) {
    out.length = max;
    let ult = out[max - 1];
    while (ult.length > 1 && ctx.measureText(`${ult}…`).width > ancho) ult = ult.slice(0, -1);
    out[max - 1] = `${ult.trimEnd()}…`;
  }
  return out;
}

// Escribe renglones desde y (línea base del primero) y devuelve dónde quedó la siguiente línea
function escribir(ctx: Ctx, lineas: string[], x: number, y: number, alto: number, alinear: CanvasTextAlign = 'left') {
  ctx.textAlign = alinear;
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * alto));
  ctx.textAlign = 'left';
  return y + lineas.length * alto;
}

function redondeado(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// La foto llena el recuadro sin deformarse (recorta lo que sobra, centrada)
function fotoCubriendo(ctx: Ctx, img: ImageBitmap | null, x: number, y: number, w: number, h: number, r = 36) {
  ctx.save();
  redondeado(ctx, x, y, w, h, r);
  ctx.clip();
  if (img) {
    const escala = Math.max(w / img.width, h / img.height);
    const sw = w / escala, sh = h / escala;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = C.menta;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function mar(ctx: Ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, LADO);
  g.addColorStop(0, C.mar1); g.addColorStop(0.65, C.mar2); g.addColorStop(1, C.mar3);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LADO, LADO);
  // Burbujas suaves, siempre en el mismo lugar
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (const [x, y, r] of [[0.12, 0.18, 70], [0.86, 0.12, 110], [0.78, 0.42, 40], [0.2, 0.62, 52], [0.9, 0.7, 64]]) {
    ctx.beginPath(); ctx.arc(x * LADO, y * LADO, r, 0, Math.PI * 2); ctx.fill();
  }
}

function olas(ctx: Ctx, y: number, color: string, alfa = 1) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let x = 0; x <= LADO; x += 16) ctx.lineTo(x, y + Math.sin((x / LADO) * Math.PI * 4) * 26);
  ctx.lineTo(LADO, LADO); ctx.lineTo(0, LADO); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function ballena(ctx: Ctx, img: HTMLImageElement | null, cx: number, cy: number, ancho: number) {
  if (!img) return;
  const alto = (ancho * img.height) / img.width;
  ctx.drawImage(img, cx - ancho / 2, cy - alto / 2, ancho, alto);
}

function eyebrow(ctx: Ctx, texto: string, x: number, y: number, color = C.salvia) {
  fuente(ctx, `800 40px ${TEXTO}`, color, 6);
  ctx.fillText(texto.toUpperCase(), x, y);
  fuente(ctx, `800 40px ${TEXTO}`, color, 0);
}

function numeroDePagina(ctx: Ctx, n: number) {
  fuente(ctx, `700 32px ${TEXTO}`, C.salvia);
  ctx.textAlign = 'center';
  ctx.fillText(String(n), LADO / 2, LADO - 80);
  ctx.textAlign = 'left';
}

/* ---------- Cada tipo de página ---------- */

function portada(ctx: Ctx, d: DatosLibro, img: HTMLImageElement | null) {
  mar(ctx);
  olas(ctx, LADO * 0.8, C.espuma, 0.18);
  olas(ctx, LADO * 0.86, C.espuma, 0.12);
  fuente(ctx, `600 230px ${TITULO}`, '#fff');
  ctx.textAlign = 'center';
  ctx.fillText('You and me', LADO / 2, LADO * 0.25);
  fuente(ctx, `800 72px ${TEXTO}`, C.lima);
  ctx.fillText(d.nombres, LADO / 2, LADO * 0.33);
  ballena(ctx, img, LADO / 2, LADO * 0.57, LADO * 0.6);
  fuente(ctx, `700 50px ${TEXTO}`, 'rgba(255,255,255,0.9)');
  ctx.fillText(d.rango.desde === d.rango.hasta ? fechaCorta(d.rango.desde) : `${fechaCorta(d.rango.desde)} — ${fechaCorta(d.rango.hasta)}`, LADO / 2, LADO * 0.92);
  ctx.textAlign = 'left';
}

function cifras(ctx: Ctx, d: DatosLibro) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  eyebrow(ctx, 'Hasta aquí', M, M + 40);
  fuente(ctx, `600 130px ${TITULO}`, C.tinta);
  ctx.fillText('Lo que llevamos', M, M + 190);
  const cols = 2, gap = 48, top = M + 300;
  const w = (LADO - 2 * M - gap) / cols;
  const filas = Math.ceil(d.cifras.length / cols);
  const h = Math.min(400, (LADO - M - top - gap * (filas - 1)) / filas);
  d.cifras.forEach((c, i) => {
    const x = M + (i % cols) * (w + gap), y = top + Math.floor(i / cols) * (h + gap);
    ctx.fillStyle = i === 0 ? C.bosque : C.seleccion;
    redondeado(ctx, x, y, w, h, 48); ctx.fill();
    fuente(ctx, `700 170px ${TITULO}`, i === 0 ? '#fff' : C.bosque);
    ctx.fillText(c.n.toLocaleString('es-CO'), x + 60, y + h / 2 + 30);
    fuente(ctx, `700 50px ${TEXTO}`, i === 0 ? C.lima : C.salvia);
    ctx.fillText(c.txt, x + 64, y + h / 2 + 110);
  });
}

function mes(ctx: Ctx, p: Extract<Pagina, { tipo: 'mes' }>, img: HTMLImageElement | null) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  const [nombre, anio] = nombreMes(p.mes).split(' ');
  fuente(ctx, `italic 500 250px ${TITULO}`, C.tinta);
  ctx.textAlign = 'center';
  ctx.fillText(mayus(nombre), LADO / 2, LADO * 0.42);
  fuente(ctx, `800 90px ${TEXTO}`, C.bosque, 12);
  ctx.fillText(anio, LADO / 2, LADO * 0.52);
  fuente(ctx, `700 48px ${TEXTO}`, C.salvia);
  if (p.recuerdos) ctx.fillText(p.recuerdos === 1 ? 'Un recuerdo' : `${p.recuerdos} recuerdos`, LADO / 2, LADO * 0.59);
  ctx.textAlign = 'left';
  olas(ctx, LADO * 0.78, C.mar1, 0.9);
  olas(ctx, LADO * 0.84, C.mar2, 1);
  ballena(ctx, img, LADO * 0.72, LADO * 0.74, LADO * 0.3);
}

// El texto de un recuerdo debajo de la foto. Con `dibujar` en false solo mide: así la foto se achica
// lo justo para que quepa la descripción completa (hasta un tope) en vez de cortarla en una línea.
function textoRecuerdo(ctx: Ctx, r: RecuerdoLibro, y0: number, bajo: number, dibujar: boolean) {
  const ancho = LADO - 2 * M, conFoto = !!r.fotos[0];
  let y = y0;
  const poner = (lineas: string[], yy: number, alto: number) => (dibujar ? escribir(ctx, lineas, M, yy, alto) : yy + lineas.length * alto);
  const quedan = (alto: number) => Math.max(0, Math.floor((bajo - y) / alto));

  if (dibujar) eyebrow(ctx, fechaLarga(r.fecha), M, y);
  y += 110;
  fuente(ctx, `600 ${conFoto ? 96 : 130}px ${TITULO}`, C.tinta);
  y = poner(renglones(ctx, r.titulo, ancho, 2), y, conFoto ? 108 : 144);

  const meta = [r.lugar ? `📍 ${r.lugar}` : '', r.calificacion ? '★'.repeat(Math.min(5, r.calificacion)) : ''].filter(Boolean).join('   ');
  if (meta) {
    fuente(ctx, `700 46px ${TEXTO}`, C.bosque);
    y = poner(renglones(ctx, meta, ancho, 1), y + 10, 60) + 10;
  }
  if (r.descripcion?.trim()) {
    fuente(ctx, `600 48px ${TEXTO}`, C.tinta);
    const max = Math.min(quedan(68), conFoto ? 7 : 14);
    if (max) y = poner(renglones(ctx, r.descripcion, ancho, max), y + 20, 68) + 10;
  }
  for (const nota of r.notas.slice(0, 3)) {
    fuente(ctx, `italic 500 46px ${TITULO}`, C.salvia);
    const max = Math.min(quedan(64), 3);
    if (!max) break;
    y = poner(renglones(ctx, `“${nota.texto}” — ${nota.quien}`, ancho, max), y + 20, 64);
  }
  const c = r.canciones[0];
  if (c && quedan(64) >= 1) {
    fuente(ctx, `800 44px ${TEXTO}`, C.bosque);
    y = poner(renglones(ctx, `♪ ${c.titulo}${c.artista ? ` — ${c.artista}` : ''}`, ancho, 1), y + 30, 64);
  }
  return y - y0;
}

async function recuerdo(ctx: Ctx, r: RecuerdoLibro, fotos: Fotos, n: number) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  const bajo = LADO - M - 20;
  let y: number;
  if (r.fotos[0]) {
    // La foto toma lo que deja el texto, entre el 38 % y el 62 % de la página
    const texto = textoRecuerdo(ctx, r, 0, Infinity, false);
    const alto = Math.min(LADO * 0.62, Math.max(LADO * 0.38, bajo - M - 110 - texto));
    const img = await fotos.tomar(r.fotos[0]);
    fotoCubriendo(ctx, img, M, M, LADO - 2 * M, alto);
    img?.close();
    y = M + alto + 110;
  } else {
    // Sin foto: una comilla grande y más espacio para el texto
    fuente(ctx, `600 360px ${TITULO}`, C.lima);
    ctx.fillText('“', M - 20, M + 260);
    y = M + 380;
  }
  textoRecuerdo(ctx, r, y, bajo, true);
  numeroDePagina(ctx, n);
}

async function collage(ctx: Ctx, r: RecuerdoLibro, rutas: string[], fotos: Fotos, n: number) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  const imgs = await Promise.all(rutas.map((ruta) => fotos.tomar(ruta)));
  const g = 32, x = M, y = M, w = LADO - 2 * M, h = LADO - 2 * M - 150;
  const cajas: [number, number, number, number][] =
    imgs.length === 2 ? [[x, y, (w - g) / 2, h], [x + (w + g) / 2, y, (w - g) / 2, h]]
    : imgs.length === 3 ? [[x, y, (w - g) * 0.58, h], [x + (w - g) * 0.58 + g, y, (w - g) * 0.42, (h - g) / 2], [x + (w - g) * 0.58 + g, y + (h + g) / 2, (w - g) * 0.42, (h - g) / 2]]
    : [[x, y, (w - g) / 2, (h - g) / 2], [x + (w + g) / 2, y, (w - g) / 2, (h - g) / 2], [x, y + (h + g) / 2, (w - g) / 2, (h - g) / 2], [x + (w + g) / 2, y + (h + g) / 2, (w - g) / 2, (h - g) / 2]];
  imgs.forEach((img, i) => { fotoCubriendo(ctx, img, ...cajas[i], 28); img?.close(); });
  fuente(ctx, `italic 500 54px ${TITULO}`, C.salvia);
  escribir(ctx, renglones(ctx, `${r.titulo} · ${fechaCorta(r.fecha)}`, w, 1), LADO / 2, LADO - M - 30, 60, 'center');
  numeroDePagina(ctx, n);
}

// Las preguntas con las respuestas completas (hasta 10 renglones cada una): si una no cabe, pasa
// a la página siguiente. Devuelve cuántas páginas usó.
async function preguntas(ctx: Ctx, items: ParPregunta[], entregar: () => Promise<void>, n: number) {
  const ancho = LADO - 2 * M, bajo = LADO - M - 20;
  const titulo = `Lo que nos preguntamos · ${nombreMes(items[0].fecha.slice(0, 7))}`;
  const bloque = (p: ParPregunta) => {
    fuente(ctx, `600 64px ${TITULO}`, C.tinta);
    const pregunta = renglones(ctx, p.pregunta, ancho - (p.corazones ? 90 : 0), 3);
    fuente(ctx, `600 46px ${TEXTO}`, C.tinta);
    const respuestas = p.respuestas.map((r) => ({ quien: r.quien, lineas: renglones(ctx, r.texto, ancho, 10) }));
    const alto = 70 + pregunta.length * 76 + 16 + respuestas.reduce((a, r) => a + 100 + r.lineas.length * 58 + 4, 0);
    return { p, pregunta, respuestas, alto };
  };
  let pagina = 0, y = 0, enEsta = 0;
  const empezar = () => {
    ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
    eyebrow(ctx, pagina ? `${titulo} (sigue)` : titulo, M, M + 40);
    y = M + 130; enEsta = 0;
  };
  empezar();
  for (const b of items.map(bloque)) {
    if (enEsta && y + 40 + b.alto > bajo) { numeroDePagina(ctx, n + pagina); await entregar(); pagina++; empezar(); }
    if (enEsta) { ctx.fillStyle = C.menta; ctx.fillRect(M, y + 10, ancho, 4); y += 40; }
    const arriba = y;
    fuente(ctx, `600 64px ${TITULO}`, C.tinta);
    y = escribir(ctx, b.pregunta, M, y + 70, 76) + 16;
    if (b.p.corazones) { fuente(ctx, `700 64px ${TEXTO}`, C.coral); ctx.textAlign = 'right'; ctx.fillText('♥', LADO - M, arriba + 70); ctx.textAlign = 'left'; }
    for (const r of b.respuestas) {
      fuente(ctx, `800 38px ${TEXTO}`, C.salvia, 3);
      ctx.fillText(r.quien.toUpperCase(), M, y + 40);
      fuente(ctx, `600 46px ${TEXTO}`, C.tinta);
      y = escribir(ctx, r.lineas, M, y + 100, 58) + 4;
    }
    enEsta++;
  }
  numeroDePagina(ctx, n + pagina);
  await entregar();
  return pagina + 1;
}

function seccion(ctx: Ctx, titulo: string, subtitulo: string) {
  mar(ctx);
  olas(ctx, LADO * 0.82, C.espuma, 0.14);
  fuente(ctx, `600 150px ${TITULO}`, '#fff');
  escribir(ctx, renglones(ctx, titulo, LADO - 2 * M, 2), LADO / 2, LADO * 0.46, 170, 'center');
  fuente(ctx, `800 60px ${TEXTO}`, C.lima);
  ctx.textAlign = 'center';
  ctx.fillText(subtitulo, LADO / 2, LADO * 0.6);
  ctx.textAlign = 'left';
}

// Una carta larga sigue en las páginas que haga falta: devuelve cuántas dibujó
async function carta(ctx: Ctx, c: CartaLibro, entregar: () => Promise<void>, n: number) {
  const ancho = LADO - 2 * M, alto = 70;
  fuente(ctx, `600 50px ${TEXTO}`, C.tinta);
  const lineas = renglones(ctx, c.contenido, ancho);
  let i = 0, pagina = 0;
  do {
    ctx.fillStyle = C.papel; ctx.fillRect(0, 0, LADO, LADO);
    ctx.fillStyle = C.lima; ctx.fillRect(0, 0, LADO, 24);
    let y = M + 60;
    if (pagina === 0) {
      if (c.emoji) { fuente(ctx, `120px ${TEXTO}`, C.tinta); ctx.fillText(c.emoji, M, y + 60); y += 180; }
      fuente(ctx, `600 96px ${TITULO}`, C.tinta);
      y = escribir(ctx, renglones(ctx, c.titulo, ancho, 2), M, y + 40, 110);
      eyebrow(ctx, `De ${c.de} para ${c.para} · ${fechaCorta(c.fecha)}`, M, y + 30);
      y += 150;
    } else {
      eyebrow(ctx, `${c.titulo} (sigue)`, M, y);
      y += 110;
    }
    const caben = Math.floor((LADO - M - 60 - y) / alto);
    fuente(ctx, `600 50px ${TEXTO}`, C.tinta);
    escribir(ctx, lineas.slice(i, i + caben), M, y, alto);
    i += caben;
    numeroDePagina(ctx, n + pagina);
    pagina++;
    await entregar();
  } while (i < lineas.length);
  return pagina;
}

function canciones(ctx: Ctx, items: { titulo: string; artista: string | null }[], n: number) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  eyebrow(ctx, 'Lo que sonaba', M, M + 40);
  fuente(ctx, `600 120px ${TITULO}`, C.tinta);
  ctx.fillText('Nuestra banda sonora', M, M + 180);
  const ancho = LADO - 2 * M - 150;
  items.forEach((c, i) => {
    const y = M + 300 + i * 118;
    ctx.fillStyle = C.lima;
    ctx.beginPath(); ctx.arc(M + 44, y + 30, 44, 0, Math.PI * 2); ctx.fill();
    fuente(ctx, `800 46px ${TEXTO}`, C.bosque);
    ctx.textAlign = 'center'; ctx.fillText('♪', M + 44, y + 46); ctx.textAlign = 'left';
    fuente(ctx, `800 48px ${TEXTO}`, C.tinta);
    ctx.fillText(renglones(ctx, c.titulo, ancho, 1)[0], M + 130, y + 24);
    if (c.artista) { fuente(ctx, `600 38px ${TEXTO}`, C.salvia); ctx.fillText(renglones(ctx, c.artista, ancho, 1)[0], M + 130, y + 74); }
  });
  numeroDePagina(ctx, n);
}

function lugares(ctx: Ctx, items: { nombre: string; veces: number }[], n: number, img: HTMLImageElement | null) {
  ctx.fillStyle = C.crema; ctx.fillRect(0, 0, LADO, LADO);
  eyebrow(ctx, 'Nuestro mapa', M, M + 40);
  fuente(ctx, `600 120px ${TITULO}`, C.tinta);
  ctx.fillText('Donde estuvimos', M, M + 180);
  // Con pocos lugares, una sola columna y más grande; con muchos, dos columnas
  const pocos = items.length <= 6;
  const g = 60, cols = pocos ? 1 : 2, w = (LADO - 2 * M - g * (cols - 1)) / cols, alto = pocos ? 150 : 128;
  const porColumna = Math.ceil(items.length / cols);
  items.forEach((l, i) => {
    const col = Math.floor(i / porColumna), fila = i % porColumna;
    const x = M + col * (w + g), y = M + 340 + fila * alto;
    fuente(ctx, `800 ${pocos ? 60 : 46}px ${TEXTO}`, C.tinta);
    ctx.fillText(renglones(ctx, `📍 ${l.nombre}`, w - 220, 1)[0], x, y);
    fuente(ctx, `700 ${pocos ? 44 : 38}px ${TEXTO}`, C.bosque);
    ctx.textAlign = 'right'; ctx.fillText(l.veces === 1 ? '1 vez' : `${l.veces} veces`, x + w, y); ctx.textAlign = 'left';
    ctx.fillStyle = C.menta; ctx.fillRect(x, y + (pocos ? 50 : 40), w, 3);
  });
  olas(ctx, LADO * 0.82, C.mar1, 0.85);
  olas(ctx, LADO * 0.88, C.mar2, 1);
  ballena(ctx, img, LADO - M - 260, LADO * 0.78, 460);
  fuente(ctx, `700 32px ${TEXTO}`, 'rgba(255,255,255,0.85)');
  ctx.textAlign = 'center'; ctx.fillText(String(n), LADO / 2, LADO - 80); ctx.textAlign = 'left';
}

function final(ctx: Ctx, d: DatosLibro, img: HTMLImageElement | null) {
  mar(ctx);
  olas(ctx, LADO * 0.8, C.espuma, 0.16);
  fuente(ctx, `italic 500 190px ${TITULO}`, '#fff');
  ctx.textAlign = 'center';
  ctx.fillText('Continuará…', LADO / 2, LADO * 0.32);
  ballena(ctx, img, LADO / 2, LADO * 0.56, LADO * 0.42);
  fuente(ctx, `800 56px ${TEXTO}`, C.lima);
  ctx.fillText(d.nombres, LADO / 2, LADO * 0.86);
  fuente(ctx, `700 40px ${TEXTO}`, 'rgba(255,255,255,0.8)');
  ctx.fillText('Hecho con amor en You and me', LADO / 2, LADO * 0.91);
  ctx.textAlign = 'left';
}

/* ---------- Armar todo ---------- */

async function bajarImagen(url: string): Promise<ImageBitmap | null> {
  try {
    const blob = await (await fetch(url)).blob();
    try { return await createImageBitmap(blob, { resizeWidth: 1800, resizeQuality: 'high' }); } catch { return await createImageBitmap(blob); }
  } catch {
    return null;
  }
}

const aJpeg = (lienzo: HTMLCanvasElement) => new Promise<Uint8Array>((ok, mal) =>
  lienzo.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : mal(new Error('No pude guardar la página'))), 'image/jpeg', 0.88));

export async function armarLibro(
  d: DatosLibro, plan: Pagina[], img: HTMLImageElement | null,
  progreso: (hechas: number, total: number) => void,
  firmar: (rutas: string[]) => Promise<Record<string, string>> = urlsFirmadas,
): Promise<PaginaJpeg[]> {
  await Promise.all([`600 100px ${TITULO}`, `italic 500 100px ${TITULO}`, `700 100px ${TITULO}`, `600 40px ${TEXTO}`, `700 40px ${TEXTO}`, `800 40px ${TEXTO}`]
    .map((f) => document.fonts.load(f).catch(() => null)));

  // Las fotos se firman todas de una vez y se bajan un poco antes de necesitarlas
  const rutas = plan.flatMap((p) => (p.tipo === 'recuerdo' ? p.r.fotos.slice(0, 1) : p.tipo === 'collage' ? p.fotos : []));
  const firmadas = rutas.length ? await firmar(rutas) : {};
  const pedidas = new Map<string, Promise<ImageBitmap | null>>();
  const pedir = (ruta: string) => {
    if (!pedidas.has(ruta)) pedidas.set(ruta, firmadas[ruta] ? bajarImagen(firmadas[ruta]) : Promise.resolve(null));
    return pedidas.get(ruta)!;
  };
  const fotos: Fotos = { tomar: (ruta) => { const p = pedir(ruta); pedidas.delete(ruta); return p; } };
  const adelantar = (desde: number) => {
    for (const p of plan.slice(desde, desde + 3)) {
      if (p.tipo === 'recuerdo' && p.r.fotos[0]) pedir(p.r.fotos[0]);
      if (p.tipo === 'collage') p.fotos.forEach(pedir);
    }
  };

  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = LADO;
  const ctx = lienzo.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  const salida: PaginaJpeg[] = [];
  const entregar = async () => {
    salida.push({ jpeg: await aJpeg(lienzo), ancho: LADO, alto: LADO });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  };

  try {
    for (let i = 0; i < plan.length; i++) {
      adelantar(i + 1);
      const p = plan[i], n = salida.length + 1;
      switch (p.tipo) {
        case 'portada': portada(ctx, d, img); break;
        case 'cifras': cifras(ctx, d); break;
        case 'mes': mes(ctx, p, img); break;
        case 'recuerdo': await recuerdo(ctx, p.r, fotos, n); break;
        case 'collage': await collage(ctx, p.r, p.fotos, fotos, n); break;
        case 'preguntas': await preguntas(ctx, p.items, entregar, n); progreso(i + 1, plan.length); continue;
        case 'seccion': seccion(ctx, p.titulo, p.subtitulo); break;
        case 'carta': await carta(ctx, p.c, entregar, n); progreso(i + 1, plan.length); continue;
        case 'canciones': canciones(ctx, p.items, n); break;
        case 'lugares': lugares(ctx, p.items, n, img); break;
        case 'final': final(ctx, d, img); break;
      }
      await entregar();
      progreso(i + 1, plan.length);
      // Deja respirar a la pantalla para que se vea el progreso
      await new Promise((ok) => setTimeout(ok, 0));
    }
  } finally {
    for (const p of pedidas.values()) p.then((b) => b?.close());
    lienzo.width = lienzo.height = 0;
  }
  return salida;
}
