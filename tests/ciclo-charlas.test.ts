// Pruebas de recortarCharla en src/lib/ciclo/almacen (recorta conversaciones viejas).
// Mockea el módulo de Supabase con vi.mock porque el import real arma un cliente; no hay red.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
const { recortarCharla } = await import('../src/lib/ciclo/almacen');

describe('recortarCharla', () => {
  it('olvida los turnos más viejos para que el sobre quepa en la base', () => {
    const turnos = Array.from({ length: 40 }, (_, i) => ({ rol: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', contenido: `${i} ${'x'.repeat(2000)}` }));
    const r = recortarCharla({ id: 'a', titulo: 't', creada: '', actualizada: '', turnos });
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(24_000);
    expect(r.turnos[0].rol).toBe('user');
    expect(r.turnos[r.turnos.length - 1].contenido.startsWith('39 ')).toBe(true);
  });

  it('una conversación corta queda igual', () => {
    const ch = { id: 'a', titulo: 't', creada: '', actualizada: '', turnos: [{ rol: 'user' as const, contenido: 'hola' }] };
    expect(recortarCharla(ch)).toEqual(ch);
  });
});
