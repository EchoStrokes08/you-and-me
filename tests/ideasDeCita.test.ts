import { describe, expect, it } from 'vitest';
import { ideasPara } from '../src/lib/ideasDeCita';

const actividades = [
  { id: 'atardecer', categorias: ['airelibre'], es_comodin: false },
  { id: 'picnic', categorias: ['airelibre'], es_comodin: true },
  { id: 'postre', categorias: ['comida'], es_comodin: true },
  { id: 'sorpresa', categorias: [], es_comodin: true, es_sorpresa: true },
];
const vinculos = [{ lugar_id: 'monserrate', actividad_id: 'atardecer' }];
const ids = (l: any[]) => l.map((a) => a.id);

describe('ideasPara', () => {
  it('sin lugar: solo las ideas generales, nunca la sorpresa', () => {
    const r = ideasPara(null, actividades, vinculos);
    expect(ids(r.propias)).toEqual([]);
    expect(ids(r.otras)).toEqual(['picnic', 'postre']);
  });

  it('lugar del catálogo: las que se le anotaron y las generales de su tipo de plan', () => {
    const r = ideasPara({ id: 'monserrate', categorias: ['airelibre'] }, actividades, vinculos);
    expect(ids(r.propias)).toEqual(['atardecer']);
    expect(ids(r.otras)).toEqual(['picnic']);
  });

  it('lugar del mapa: las generales de su tipo primero y todas las demás después', () => {
    const r = ideasPara({ id: 'x', es_mapa: true, categorias: ['comida'] }, actividades, vinculos);
    expect(ids(r.propias)).toEqual(['postre']);
    expect(ids(r.otras)).toEqual(['atardecer', 'picnic']);
  });
});
