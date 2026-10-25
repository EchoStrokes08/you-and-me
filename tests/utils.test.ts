// Pruebas de src/lib/utils: fechas, textos y permisos de edición, con el reloj congelado para las fechas.
// Sin red ni mocks de datos: funciones puras alimentadas con valores de mentira.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diasEntre, diasLabel, diasSinCopia, fechaStr, horaBonita, hoyStr, linkMapa, nombreLugar, precioStr, puedeEditar } from '../src/lib/utils';

describe('fechas', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fechaStr rellena con ceros', () => {
    expect(fechaStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('hoyStr es el día local, también de noche (en UTC ya sería mañana)', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 23, 30));
    expect(hoyStr()).toBe('2026-10-13');
  });

  it('diasEntre cuenta días completos sin importar la hora', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 23, 30));
    expect(diasEntre('2026-10-13')).toBe(0);
    expect(diasEntre('2026-10-20')).toBe(7);
    expect(diasEntre('2026-10-10')).toBe(-3);
  });

  it('diasSinCopia: null si nunca hubo copia', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 12));
    expect(diasSinCopia(null)).toBeNull();
    expect(diasSinCopia(undefined)).toBeNull();
    expect(diasSinCopia(new Date(2026, 8, 12, 12).toISOString())).toBe(31);
    expect(diasSinCopia(new Date(2026, 9, 13, 8).toISOString())).toBe(0);
  });
});

describe('textos', () => {
  it('precioStr va de $ a $$$$', () => {
    expect([0, 1, 3, 9].map(precioStr)).toEqual(['$', '$', '$$$', '$$$$']);
  });

  it('diasLabel nombra los días', () => {
    expect(diasLabel([6, 0])).toBe('sábado y domingo');
    expect(diasLabel(null)).toBeNull();
  });

  it('horaBonita pasa a 12 horas', () => {
    expect(horaBonita('19:30:00')).toMatch(/^7:30\sp/);
    expect(horaBonita('09:05:00')).toMatch(/^9:05\sa/);
    expect(horaBonita(null)).toBe('');
  });
});

describe('citas', () => {
  it('nombreLugar: primero el del catálogo, luego el del mapa', () => {
    expect(nombreLugar({ lugares: { nombre: 'Monserrate' }, lugar_personalizado: 'Otro' })).toBe('Monserrate');
    expect(nombreLugar({ lugares: null, lugar_personalizado: 'Parque de la 93' })).toBe('Parque de la 93');
    expect(nombreLugar({ lugar_personalizado: null, lugares: null })).toBeUndefined();
  });

  it('linkMapa solo si el lugar tiene coordenadas', () => {
    expect(linkMapa({ lugar_lat: 4.6, lugar_lng: -74.07 })).toBe('https://www.google.com/maps/search/?api=1&query=4.6,-74.07');
    expect(linkMapa({ lugar_lat: null, lugar_lng: null })).toBeNull();
  });

  it('puedeEditar: el admin todas, cada uno las suyas, y solo si siguen en pie', () => {
    const ella = { id: 'ella', esAdmin: false };
    const admin = { id: 'el', esAdmin: true };
    expect(puedeEditar({ estado: 'pendiente', creada_por: 'ella' }, ella)).toBe(true);
    expect(puedeEditar({ estado: 'confirmada', creada_por: 'el' }, ella)).toBe(false);
    expect(puedeEditar({ estado: 'confirmada', creada_por: 'ella' }, admin)).toBe(true);
    expect(puedeEditar({ estado: 'cancelada', creada_por: 'ella' }, admin)).toBe(false);
    expect(puedeEditar({ estado: 'vivida', creada_por: 'ella' }, ella)).toBe(false);
    expect(puedeEditar({ estado: 'pendiente', creada_por: 'ella' }, null)).toBe(false);
  });
});
