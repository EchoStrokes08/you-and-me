// Chrome graba el MP4 de MediaRecorder con la duración general bien (mvhd), pero en cada pista
// (mdhd) escribe esa misma cifra sin pasarla a la escala de la pista: los reproductores creen
// que el video dura uno o dos segundos. Aquí se corrige: cada pista dura lo mismo que la película.

type Caja = { tipo: string; inicio: number; tam: number };

function cajas(v: DataView, ini: number, fin: number, out: Caja[] = []): Caja[] {
  let i = ini;
  while (i + 8 <= fin) {
    const tam = v.getUint32(i);
    const tipo = String.fromCharCode(v.getUint8(i + 4), v.getUint8(i + 5), v.getUint8(i + 6), v.getUint8(i + 7));
    if (tam < 8 || i + tam > fin) break;
    out.push({ tipo, inicio: i, tam });
    if (tipo === 'moov' || tipo === 'trak' || tipo === 'mdia') cajas(v, i + 8, i + tam, out);
    i += tam;
  }
  return out;
}

// mvhd y mdhd: versión 1 usa fechas y duración de 64 bits
const leer = (v: DataView, cuerpo: number) => {
  const v1 = v.getUint8(cuerpo) === 1;
  const escala = v.getUint32(cuerpo + (v1 ? 20 : 12));
  const pos = cuerpo + (v1 ? 24 : 16);
  const duracion = v1 ? Number(v.getBigUint64(pos)) : v.getUint32(pos);
  return { v1, escala, pos, duracion };
};

/** Devuelve una copia con la duración de cada pista corregida (o el mismo búfer si no hay nada que hacer) */
export function arreglarDuracionMp4(buf: ArrayBuffer): ArrayBuffer {
  const copia = buf.slice(0);
  const v = new DataView(copia);
  const lista = cajas(v, 0, v.byteLength);
  const mvhd = lista.find((c) => c.tipo === 'mvhd');
  if (!mvhd) return buf;
  const peli = leer(v, mvhd.inicio + 8);
  if (!peli.escala || !peli.duracion) return buf;
  const segundos = peli.duracion / peli.escala;
  for (const c of lista.filter((x) => x.tipo === 'mdhd')) {
    const pista = leer(v, c.inicio + 8);
    if (!pista.escala) continue;
    const nueva = Math.round(segundos * pista.escala);
    if (pista.v1) v.setBigUint64(pista.pos, BigInt(nueva));
    else v.setUint32(pista.pos, Math.min(nueva, 0xffffffff));
  }
  return copia;
}
