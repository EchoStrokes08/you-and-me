// Dibuja el resumen del año como una imagen vertical (1080 × 1920) para compartir o guardar

export type DatosTarjeta = {
  anio: number;
  enCurso: boolean;
  // En orden de importancia: se dibujan hasta seis (cuatro si hay foto) y las que estén en cero se saltan
  cifras: { n: number; txt: string }[];
  recuerdo?: { titulo: string; foto: string | null } | null;
};

const ANCHO = 1080, ALTO = 1920, MARGEN = 80;
const TITULO = 'Fraunces, serif', TEXTO = 'Nunito, sans-serif';
// La cola de ballena de components/ui.tsx (viewBox 48 × 40)
const COLA = 'M24 13C28 8 37 5 47 9C45 17 38 22 30 23C29 29 30 34 34 39L14 39C18 34 19 29 18 23C10 22 3 17 1 9C11 5 20 8 24 13Z';

// La foto se baja como archivo: dibujada desde su dirección dejaría el lienzo sin poder exportarse
async function cargarFoto(url: string): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(await (await fetch(url)).blob());
  } catch {
    return null;
  }
}

// Parte un texto en renglones que quepan en `ancho` (máximo `max`; el último termina en puntos suspensivos)
export function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number) {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho || !actual) { actual = prueba; continue; }
    out.push(actual);
    actual = palabra;
  }
  if (actual) out.push(actual);
  if (out.length > max) {
    out.length = max;
    while (ctx.measureText(`${out[max - 1]}…`).width > ancho && out[max - 1].length > 1) out[max - 1] = out[max - 1].slice(0, -1);
    out[max - 1] += '…';
  }
  return out;
}

export async function crearTarjetaResumen(d: DatosTarjeta): Promise<Blob> {
  // Las fuentes de la app ya están en la página; se espera a que estén listas para el lienzo
  await Promise.all([`700 100px ${TITULO}`, `italic 500 100px ${TITULO}`, `700 40px ${TEXTO}`, `800 40px ${TEXTO}`].map((f) => document.fonts.load(f).catch(() => null)));
  const foto = d.recuerdo?.foto ? await cargarFoto(d.recuerdo.foto) : null;

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d')!;

  // El mar del héroe, de la superficie al fondo
  const mar = ctx.createLinearGradient(0, 0, 0, ALTO);
  mar.addColorStop(0, '#2B7A5C'); mar.addColorStop(0.55, '#165040'); mar.addColorStop(1, '#0C2F27');
  ctx.fillStyle = mar;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  // Luz que entra desde arriba
  const luz = ctx.createRadialGradient(ANCHO * 0.8, 0, 0, ANCHO * 0.8, 0, 900);
  luz.addColorStop(0, 'rgba(195, 224, 138, 0.22)'); luz.addColorStop(1, 'rgba(195, 224, 138, 0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#C3E08A';
  ctx.font = `800 34px ${TEXTO}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('YOU AND ME', MARGEN, 150);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 300px ${TITULO}`;
  ctx.fillText(String(d.anio), MARGEN - 12, 420);
  ctx.fillStyle = '#CFE9E4';
  ctx.font = `italic 500 58px ${TITULO}`;
  ctx.fillText(d.enCurso ? 'Lo que llevamos del año' : 'Nuestro año, en resumen', MARGEN, 510);

  let y = 590;
  if (foto) {
    // La foto del recuerdo del año, recortada para llenar el marco
    const w = ANCHO - MARGEN * 2, h = 520;
    const escala = Math.max(w / foto.width, h / foto.height);
    const fw = w / escala, fh = h / escala;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGEN, y, w, h, 56);
    ctx.clip();
    ctx.drawImage(foto, (foto.width - fw) / 2, (foto.height - fh) / 2, fw, fh, MARGEN, y, w, h);
    const sombra = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h);
    sombra.addColorStop(0, 'rgba(14, 42, 32, 0)'); sombra.addColorStop(1, 'rgba(14, 42, 32, 0.85)');
    ctx.fillStyle = sombra;
    ctx.fillRect(MARGEN, y, w, h);
    ctx.restore();
    ctx.fillStyle = '#C3E08A';
    ctx.font = `800 30px ${TEXTO}`;
    ctx.fillText('EL RECUERDO DEL AÑO', MARGEN + 44, y + h - 104);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 52px ${TITULO}`;
    ctx.fillText(renglones(ctx, d.recuerdo!.titulo, w - 88, 1)[0] ?? '', MARGEN + 44, y + h - 44);
    y += h + 70;
  }

  // Las cifras, en dos columnas; el alto que quede se reparte entre las filas
  // Con foto solo caben dos filas sin que se monten
  const cifras = d.cifras.filter((c) => c.n > 0).slice(0, foto ? 4 : 6);
  const filas = Math.ceil(cifras.length / 2);
  const pie = ALTO - 190;
  const altoFila = filas ? Math.min(300, (pie - y) / filas) : 0;
  const anchoCol = (ANCHO - MARGEN * 2) / 2;
  cifras.forEach((c, i) => {
    const x = MARGEN + (i % 2) * anchoCol, cy = y + Math.floor(i / 2) * altoFila;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 132px ${TITULO}`;
    ctx.fillText(c.n.toLocaleString('es-CO'), x, cy + 128);
    ctx.fillStyle = '#CFE9E4';
    ctx.font = `700 38px ${TEXTO}`;
    renglones(ctx, c.txt, anchoCol - 40, 2).forEach((r, j) => ctx.fillText(r, x, cy + 186 + j * 46));
  });

  // Pie: la cola de ballena y la despedida
  ctx.save();
  ctx.translate(MARGEN, ALTO - 150);
  ctx.scale(1.9, 1.9);
  ctx.fillStyle = '#C3E08A';
  ctx.fill(new Path2D(COLA));
  ctx.restore();
  ctx.fillStyle = '#F3FBF5';
  ctx.font = `italic 500 44px ${TITULO}`;
  ctx.fillText(d.enCurso ? 'Lo que falta aún está por escribirse' : 'Gracias por este año juntos', MARGEN + 120, ALTO - 96);

  return new Promise((ok, falla) => lienzo.toBlob((b) => (b ? ok(b) : falla(new Error('No se pudo crear la imagen'))), 'image/png'));
}
