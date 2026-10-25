// Pruebas de src/lib/arreglarMp4: la corrección de la duración del MP4 que graba el navegador.
// Arma un MP4 de mentira bytes a bytes, sin red.
import { describe, expect, it } from 'vitest';
import { arreglarDuracionMp4 } from '../src/lib/media/arreglarMp4';

// Un MP4 mínimo como lo deja Chrome: moov > mvhd (v0) y una pista moov > trak > mdia > mdhd (v1)
// con la duración de la película copiada tal cual en vez de pasarla a la escala de la pista
function mp4(): ArrayBuffer {
  const caja = (tipo: string, cuerpo: Uint8Array) => {
    const b = new Uint8Array(8 + cuerpo.length);
    new DataView(b.buffer).setUint32(0, b.length);
    b.set([...tipo].map((c) => c.charCodeAt(0)), 4);
    b.set(cuerpo, 8);
    return b;
  };
  const une = (...partes: Uint8Array[]) => { const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of partes) { out.set(p, i); i += p.length; } return out; };
  const mvhd = new Uint8Array(100); const vm = new DataView(mvhd.buffer);
  vm.setUint32(12, 1000); vm.setUint32(16, 48405); // 48,405 s
  const mdhd = new Uint8Array(36); const vd = new DataView(mdhd.buffer);
  mdhd[0] = 1; vd.setUint32(20, 48000); vd.setBigUint64(24, 48405n); // mal: debería ser 48,405 × 48000
  return une(caja('ftyp', new Uint8Array(8)), caja('moov', une(caja('mvhd', mvhd), caja('trak', caja('mdia', caja('mdhd', mdhd)))))).buffer;
}

describe('arreglarDuracionMp4', () => {
  it('pasa la duración de la película a la escala de cada pista', () => {
    const v = new DataView(arreglarDuracionMp4(mp4()));
    // ftyp (16) + moov (8) + mvhd (108) + trak (8) + mdia (8) + cabecera mdhd (8) + 24
    expect(v.getBigUint64(16 + 8 + 108 + 8 + 8 + 8 + 24)).toBe(BigInt(48405 * 48));
  });

  it('deja igual lo que no es un MP4', () => {
    const b = new Uint8Array([1, 2, 3, 4]).buffer;
    expect(arreglarDuracionMp4(b)).toBe(b);
  });
});
