// Pruebas de api/notificar: el envío de avisos push y lo que cada rol puede ver en ellos.
// Doble de web-push con vi.mock y envs stubbeados; el fetch no se usa, nunca sale nada de verdad.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enviar = vi.fn();
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => enviar(...a) } }));
const { POST } = await import('../api/notificar');

const ella = { endpoint: 'https://push.test/ella', keys: { p256dh: 'x', auth: 'x' }, rol: 'pareja', es_admin: false };
const el = { endpoint: 'https://push.test/el', keys: { p256dh: 'x', auth: 'x' }, rol: 'admin', es_admin: true };

const avisar = (cuerpo: object, secreto = 'secreto') =>
  POST(new Request('https://app.test/api/notificar', { method: 'POST', headers: { 'x-secreto': secreto }, body: JSON.stringify(cuerpo) }));
// Lo que le llegó a cada celular, por endpoint
const enviados = () => Object.fromEntries(enviar.mock.calls.map(([sub, carga]) => [sub.endpoint, JSON.parse(carga)]));

describe('/api/notificar', () => {
  beforeEach(() => {
    enviar.mockReset().mockResolvedValue({});
    vi.stubEnv('NOTIF_SECRETO', 'secreto');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'privada');
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'publica');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://base.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('sin el secreto no manda nada', async () => {
    const r = await avisar({ evento: 'prueba', nombre: 'Oscar', datos: {}, subs: [ella] }, 'otro');
    expect(r.status).toBe(401);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('el aviso del ciclo no cuenta nada de lo que dice', async () => {
    await avisar({ evento: 'ciclo', nombre: 'Sarah', datos: {}, subs: [el] });
    expect(enviados()[el.endpoint]).toMatchObject({ titulo: '💚 Sarah te dejó algo', cuerpo: 'Toca para verlo', url: '/ciclo', tag: 'ciclo' });
  });

  it('una cita propuesta lleva al admin al panel y a ella a Citas', async () => {
    await avisar({ evento: 'cita_nueva', nombre: 'Sarah', datos: { lugar: 'Monserrate', fecha: '2026-10-16' }, subs: [ella, el] });
    const m = enviados();
    expect(m[el.endpoint]).toMatchObject({ titulo: '💌 Sarah propuso una cita', url: '/admin', tag: 'cita_nueva' });
    expect(m[el.endpoint].cuerpo).toBe('Monserrate · viernes, 16 de octubre');
    expect(m[ella.endpoint].url).toBe('/citas');
  });

  it('el recordatorio de una cita sorpresa no le cuenta a ella a dónde van', async () => {
    const datos = { cuando: 'hoy', hora: '19:30:00', sorpresa: true, lugar: 'Monserrate', actividad: 'Atardecer', detalles: ['flores'] };
    await avisar({ evento: 'recordatorio_cita', nombre: '', datos, subs: [ella, el] });
    const m = enviados();
    expect(m[ella.endpoint].titulo).toBe('⏰ Hoy a las 19:30 tenemos cita');
    expect(m[ella.endpoint].cuerpo).toBe('Sorpresa 🎁');
    expect(m[el.endpoint].cuerpo).toBe('Monserrate · Atardecer\n🎁 Llevar: flores');
  });

  it('la respuesta del otro no se revela: solo dice si ya se pueden ver', async () => {
    await avisar({ evento: 'respuesta', nombre: 'Sarah', datos: { ya_respondio: false }, subs: [el] });
    expect(enviados()[el.endpoint].cuerpo).toBe('Responde tú para ver lo que dijo 👀');
  });

  it('cada 12 meses el mesiversario es aniversario', async () => {
    await avisar({ evento: 'mesiversario', nombre: '', datos: { meses: 24 }, subs: [ella] });
    expect(enviados()[ella.endpoint]).toMatchObject({ titulo: '🎉 ¡Feliz aniversario!', cuerpo: 'Hoy cumplimos 2 años juntos 💚' });
    enviar.mockClear();
    await avisar({ evento: 'mesiversario', nombre: '', datos: { meses: 21 }, subs: [ella] });
    expect(enviados()[ella.endpoint].titulo).toBe('💚 ¡Feliz mesiversario!');
  });

  it('un evento que no conoce no manda nada', async () => {
    const r = await avisar({ evento: 'no_existe', nombre: 'x', datos: {}, subs: [ella] });
    expect(r.status).toBe(200);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('las suscripciones que el celular ya no acepta se mandan a borrar', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchFalso);
    enviar.mockImplementation((sub) => (sub.endpoint === ella.endpoint ? Promise.reject({ statusCode: 410 }) : Promise.resolve({})));
    const r = await avisar({ evento: 'prueba', nombre: 'Oscar', datos: {}, subs: [ella, el] });
    expect(await r.json()).toEqual({ ok: true, vencidas: 1 });
    expect(fetchFalso).toHaveBeenCalledOnce();
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://base.test/rest/v1/rpc/borrar_suscripciones_vencidas');
    expect(JSON.parse(opciones.body)).toEqual({ p_endpoints: [ella.endpoint], p_secreto: 'secreto' });
  });
});
