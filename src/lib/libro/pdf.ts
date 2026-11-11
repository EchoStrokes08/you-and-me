// El PDF del libro: cada página es una foto JPEG del lienzo, puesta tal cual (DCTDecode), así
// el libro se ve igual que la app (sus fuentes, tildes y emojis) y no hace falta ninguna librería.
// El tamaño se da en centímetros: es lo que piden las imprentas de fotolibros.

export type PaginaJpeg = { jpeg: Uint8Array; ancho: number; alto: number };

const PT_POR_CM = 72 / 2.54;
const n = (x: number) => (Math.round(x * 100) / 100).toString();

export function pdfDeImagenes(paginas: PaginaJpeg[], cmAncho: number, cmAlto: number): Uint8Array {
  if (!paginas.length) throw new Error('El libro no tiene páginas');
  const ancho = cmAncho * PT_POR_CM, alto = cmAlto * PT_POR_CM;
  const te = new TextEncoder();
  const objetos: Uint8Array[] = [];
  const agregar = (o: string | Uint8Array) => { objetos.push(typeof o === 'string' ? te.encode(o) : o); return objetos.length; };
  const flujo = (cabeza: string, datos: Uint8Array) => {
    const a = te.encode(`${cabeza}\nstream\n`), b = te.encode('\nendstream');
    const out = new Uint8Array(a.length + datos.length + b.length);
    out.set(a); out.set(datos, a.length); out.set(b, a.length + datos.length);
    return out;
  };

  const catalogo = agregar('');
  const raiz = agregar('');
  const hijos: number[] = [];
  for (const p of paginas) {
    const img = agregar(flujo(`<< /Type /XObject /Subtype /Image /Width ${p.ancho} /Height ${p.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg));
    const ops = te.encode(`q ${n(ancho)} 0 0 ${n(alto)} 0 0 cm /Im0 Do Q`);
    const contenido = agregar(flujo(`<< /Length ${ops.length} >>`, ops));
    hijos.push(agregar(`<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 ${n(ancho)} ${n(alto)}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${contenido} 0 R >>`));
  }
  objetos[catalogo - 1] = te.encode(`<< /Type /Catalog /Pages ${raiz} 0 R >>`);
  objetos[raiz - 1] = te.encode(`<< /Type /Pages /Kids [${hijos.map((h) => `${h} 0 R`).join(' ')}] /Count ${hijos.length} >>`);

  const partes: Uint8Array[] = [te.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  let largo = partes[0].length;
  const posiciones: number[] = [];
  objetos.forEach((o, i) => {
    posiciones.push(largo);
    for (const x of [te.encode(`${i + 1} 0 obj\n`), o, te.encode('\nendobj\n')]) { partes.push(x); largo += x.length; }
  });
  const tabla = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  partes.push(te.encode(`${tabla}trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${largo}\n%%EOF\n`));

  const salida = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of partes) { salida.set(p, o); o += p.length; }
  return salida;
}
