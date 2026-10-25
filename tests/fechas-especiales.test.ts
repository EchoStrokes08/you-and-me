// Pruebas de proximaFechaEspecial en src/components/citas/ProximaFecha: mesiversarios, cumpleaños y fechas raras.
// Congela el reloj con vi.useFakeTimers(); la zona horaria local de la máquina puede cambiar los días.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proximaFechaEspecial } from '../src/components/citas/ProximaFecha';

const config = (c: object) => ({ fecha_inicio: null, cumple_ella: null, cumple_el: null, nombre_ella: 'Ella', nombre_el: 'Él', ...c });

describe('proximaFechaEspecial', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('mesiversario de este mes, contando los meses', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 10));
    expect(proximaFechaEspecial(config({ fecha_inicio: '2025-01-15' }), true))
      .toEqual({ emoji: '💚', texto: 'nuestro mesiversario #21', dias: 2, fecha: '2026-10-15' });
  });

  it('el mismo día todavía cuenta (faltan 0 días)', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 22));
    expect(proximaFechaEspecial(config({ fecha_inicio: '2025-01-15' }), true)?.dias).toBe(0);
  });

  it('si el de este mes ya pasó, el del mes siguiente', () => {
    vi.setSystemTime(new Date(2026, 9, 16, 10));
    expect(proximaFechaEspecial(config({ fecha_inicio: '2025-01-15' }), true)?.fecha).toBe('2026-11-15');
  });

  it('cada 12 meses es aniversario', () => {
    vi.setSystemTime(new Date(2027, 0, 10, 10));
    expect(proximaFechaEspecial(config({ fecha_inicio: '2025-01-15' }), true))
      .toEqual({ emoji: '🎉', texto: 'nuestro aniversario #2', dias: 5, fecha: '2027-01-15' });
  });

  it('si empezaron un 31, en febrero cae el último día', () => {
    vi.setSystemTime(new Date(2026, 1, 10, 10));
    expect(proximaFechaEspecial(config({ fecha_inicio: '2025-01-31' }), true)?.fecha).toBe('2026-02-28');
  });

  it('cumpleaños: el texto depende de quién mira', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 10));
    const c = config({ cumple_ella: '1999-10-20' });
    expect(proximaFechaEspecial(c, true)).toEqual({ emoji: '🎂', texto: 'el cumpleaños de Ella', dias: 7, fecha: '2026-10-20' });
    expect(proximaFechaEspecial(c, false)?.texto).toBe('tu cumpleaños');
  });

  it('un cumpleaños que ya pasó este año es el del año que viene', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 10));
    expect(proximaFechaEspecial(config({ cumple_el: '1998-03-01' }), true)?.fecha).toBe('2027-03-01');
  });

  it('gana la fecha más cercana', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 10));
    const c = config({ fecha_inicio: '2025-01-25', cumple_ella: '1999-10-20', cumple_el: '1998-03-01' });
    expect(proximaFechaEspecial(c, true)?.texto).toBe('el cumpleaños de Ella');
  });

  it('sin fechas configuradas no hay nada que mostrar', () => {
    expect(proximaFechaEspecial(config({}), true)).toBeUndefined();
  });
});
