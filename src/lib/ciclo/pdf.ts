// Un PDF sencillo hecho a mano (texto, líneas, rectángulos), sin librerías: se arma en el celular
// y el informe nunca pasa por un servidor. Usa Helvetica, que todo lector de PDF trae, con WinAnsi para las tildes.
import { zlibSync } from 'fflate';

// Anchos de Helvetica y Helvetica-Bold (AFM estándar) para los caracteres 32 a 126, en milésimas del tamaño
const ANCHO_REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const ANCHO_NEGRITA = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Caracteres de WinAnsi fuera de Latin-1
const WINANSI: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };

export function aWinAnsi(texto: string): number[] {
  const bytes: number[] = [];
  for (const ch of texto.normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    if (WINANSI[ch]) bytes.push(WINANSI[ch]);
    else if (c >= 32 && c <= 126) bytes.push(c);
    else if (c >= 160 && c <= 255) bytes.push(c);
    else if (ch === '\n' || ch === '\t') bytes.push(32);
    else bytes.push(63); // ?
  }
  return bytes;
}

export function anchoTexto(texto: string, tam: number, negrita = false) {
  const tabla = negrita ? ANCHO_NEGRITA : ANCHO_REGULAR;
  let total = 0;
  for (const ch of texto) {
    const base = ch.normalize('NFD')[0];
    const c = base.codePointAt(0)!;
    total += c >= 32 && c <= 126 ? tabla[c - 32] : ch === '—' ? 1000 : ch === '•' ? 350 : 556;
  }
  return (total * tam) / 1000;
}

export function partirTexto(texto: string, ancho: number, tam: number, negrita = false): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (anchoTexto(prueba, tam, negrita) <= ancho || !linea) linea = prueba;
      else { lineas.push(linea); linea = palabra; }
    }
    lineas.push(linea);
  }
  return lineas;
}

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
const n = (x: number) => (Math.round(x * 100) / 100).toString();
export type Color = [number, number, number];
const rgb = (c: Color) => c.map((v) => n(v / 255)).join(' ');

// Tamaño carta, que es el que se usa en Colombia
export const ANCHO_PAGINA = 612;
export const ALTO_PAGINA = 792;

export class DocumentoPdf {
  private paginas: string[][] = [];
  private actual: string[] = [];

  constructor() { this.paginas.push(this.actual); }

  nuevaPagina() { this.actual = []; this.paginas.push(this.actual); }
  get numeroPaginas() { return this.paginas.length; }

  // y se mide desde arriba, como en la pantalla
  texto(x: number, y: number, texto: string, { tam = 10, negrita = false, color = [23, 51, 42] as Color } = {}) {
    this.actual.push(`BT /${negrita ? 'F2' : 'F1'} ${n(tam)} Tf ${rgb(color)} rg ${n(x)} ${n(ALTO_PAGINA - y)} Td <${hex(aWinAnsi(texto))}> Tj ET`);
  }

  linea(x1: number, y1: number, x2: number, y2: number, color: Color = [207, 230, 215], grosor = 0.8) {
    this.actual.push(`${rgb(color)} RG ${n(grosor)} w ${n(x1)} ${n(ALTO_PAGINA - y1)} m ${n(x2)} ${n(ALTO_PAGINA - y2)} l S`);
  }

  rect(x: number, y: number, w: number, h: number, color: Color) {
    this.actual.push(`${rgb(color)} rg ${n(x)} ${n(ALTO_PAGINA - y - h)} ${n(w)} ${n(h)} re f`);
  }

  guardar(): Uint8Array {
    const objetos: (string | Uint8Array)[] = [];
    const agregar = (o: string | Uint8Array) => { objetos.push(o); return objetos.length; };
    const catalogo = agregar('');
    const paginas = agregar('');
    const f1 = agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const hijos: number[] = [];
    for (const ops of this.paginas) {
      const datos = zlibSync(new TextEncoder().encode(ops.join('\n')));
      const cabeza = new TextEncoder().encode(`<< /Length ${datos.length} /Filter /FlateDecode >>\nstream\n`);
      const cola = new TextEncoder().encode('\nendstream');
      const flujo = new Uint8Array(cabeza.length + datos.length + cola.length);
      flujo.set(cabeza); flujo.set(datos, cabeza.length); flujo.set(cola, cabeza.length + datos.length);
      const contenido = agregar(flujo);
      hijos.push(agregar(`<< /Type /Page /Parent ${paginas} 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contenido} 0 R >>`));
    }
    objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${paginas} 0 R >>`;
    objetos[paginas - 1] = `<< /Type /Pages /Kids [${hijos.map((h) => `${h} 0 R`).join(' ')}] /Count ${hijos.length} >>`;

    const te = new TextEncoder();
    const partes: Uint8Array[] = [te.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
    let largo = partes[0].length;
    const posiciones: number[] = [];
    objetos.forEach((o, i) => {
      posiciones.push(largo);
      const cuerpo = typeof o === 'string' ? te.encode(o) : o;
      const p = [te.encode(`${i + 1} 0 obj\n`), cuerpo, te.encode('\nendobj\n')];
      for (const x of p) { partes.push(x); largo += x.length; }
    });
    const xref = largo;
    const tabla = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
    partes.push(te.encode(`${tabla}trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const salida = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of partes) { salida.set(p, o); o += p.length; }
    return salida;
  }
}
