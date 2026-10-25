// Pruebas de api/archivos: rutaValida (rechaza rutas que se salen de su carpeta) y llaveExterna
// (arma la llave del bucket de Storage codificando cada parte). No toca red: funciones puras.
import { describe, expect, it } from 'vitest';
import { llaveExterna, rutaValida } from '../api/archivos';

describe('rutaValida', () => {
  it('acepta las rutas que arma la app', () => {
    expect(rutaValida('0f1e2d3c-aaaa-bbbb-cccc-1234567890ab/1791390999264-0.mp4')).toBe(true);
    expect(rutaValida('cartas/f30ead85-6008-49bb-9731-ad07c304c731/1791425847599.m4a')).toBe(true);
  });

  it('rechaza rutas que podrían salirse de su carpeta o venir mal', () => {
    for (const r of ['../secreto', 'a/../../b', '/absoluta', 'a//b', 'a/./b', 'con espacio.jpg', 'x', 42, null, 'a'.repeat(600)]) {
      expect(rutaValida(r)).toBe(false);
    }
  });
});

describe('llaveExterna', () => {
  it('pone cada bucket en su carpeta y codifica cada parte', () => {
    expect(llaveExterna('recuerdos', 'abc/1.jpg')).toBe('recuerdos/abc/1.jpg');
    expect(llaveExterna('adjuntos', 'cartas/x+y/1.m4a')).toBe('adjuntos/cartas/x%2By/1.m4a');
  });
});
