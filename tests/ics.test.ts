import { describe, expect, it } from 'vitest';
import { GET } from '../api/ics';

const pedir = (q: Record<string, string>) => GET(new Request(`https://app.test/api/ics?${new URLSearchParams(q)}`));

describe('/api/ics', () => {
  it('rechaza fechas y horas mal escritas', async () => {
    expect((await pedir({ f: '16/10/2026' })).status).toBe(400);
    expect((await pedir({ f: '2026-10-16', h: '7pm' })).status).toBe(400);
  });

  it('con hora: 3 horas en hora de Bogotá y aviso 2 horas antes', async () => {
    const r = await pedir({ f: '2026-10-16', h: '19:30', t: 'Cita 💚 Monserrate', l: 'Cra. 2 Este, Bogotá', n: 'Noche\nLleva chaqueta' });
    expect(r.headers.get('Content-Type')).toContain('text/calendar');
    const ics = await r.text();
    expect(ics).toContain('DTSTART:20261017T003000Z');
    expect(ics).toContain('DTEND:20261017T033000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    // Comas y saltos de línea escapados, como pide el formato
    expect(ics).toContain('LOCATION:Cra. 2 Este\\, Bogotá');
    expect(ics).toContain('DESCRIPTION:Noche\\nLleva chaqueta');
  });

  it('sin hora: evento de todo el día', async () => {
    const ics = await (await pedir({ f: '2026-12-31' })).text();
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
    expect(ics).toContain('SUMMARY:Cita 💚');
  });
});
