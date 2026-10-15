import { describe, expect, it } from 'vitest';
import { ErrorAsistente, fechasParaElSistema, memoriaNueva, pedirGroq, quitarMarcasDeCita, rescatarAcciones } from '../api/asistente';

// Un "Groq" de mentira: decide la respuesta según el modelo y la clave, y anota cada intento
function groq(reglas: (modelo: string, clave: string) => number) {
  const intentos: string[] = [];
  const pedir = (async (_url: string, init: any) => {
    const modelo = JSON.parse(init.body).model;
    const clave = init.headers.Authorization.replace('Bearer ', '');
    intentos.push(`${modelo}|${clave}`);
    const status = reglas(modelo, clave);
    return new Response(status === 200 ? '{"ok":true}' : '{}', { status });
  }) as typeof fetch;
  return { pedir, intentos };
}
const limite = () => Date.now() + 50_000;

describe('pedirGroq', () => {
  it('va al endpoint de Groq con el modelo grande primero', async () => {
    let url = '';
    const pedir = (async (u: string) => { url = u; return new Response('{}', { status: 200 }); }) as typeof fetch;
    await pedirGroq(['a'], { messages: [] }, limite(), memoriaNueva(), pedir);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('con la cuota por minuto agotada en una clave pasa a la siguiente cuenta', async () => {
    const { pedir, intentos } = groq((_m, clave) => (clave === 'a' ? 429 : 200));
    const memoria = memoriaNueva();
    await pedirGroq(['a', 'b', 'c'], {}, limite(), memoria, pedir);
    await pedirGroq(['a', 'b', 'c'], {}, limite(), memoria, pedir);
    expect(intentos).toEqual(['openai/gpt-oss-120b|a', 'openai/gpt-oss-120b|b', 'openai/gpt-oss-120b|b']);
  });

  it('un pedido demasiado grande (413) salta al modelo pequeño', async () => {
    const { pedir, intentos } = groq((modelo) => (modelo === 'openai/gpt-oss-120b' ? 413 : 200));
    await pedirGroq(['a', 'b'], {}, limite(), memoriaNueva(), pedir);
    expect(intentos).toEqual(['openai/gpt-oss-120b|a', 'openai/gpt-oss-20b|a']);
  });

  it('sin cuota en ninguna se rinde con "ocupado" para que siga Gemini', async () => {
    const { pedir, intentos } = groq(() => 429);
    await expect(pedirGroq(['a', 'b', 'c'], {}, limite(), memoriaNueva(), pedir)).rejects.toMatchObject({ codigo: 'ocupado' });
    expect(intentos.length).toBe(3 * 2);
  });

  it('un error raro del pedido se reporta como fallo', async () => {
    const { pedir } = groq(() => 400);
    await expect(pedirGroq(['a'], {}, limite(), memoriaNueva(), pedir)).rejects.toBeInstanceOf(ErrorAsistente);
  });
});

describe('rescatarAcciones', () => {
  it('convierte en botones las acciones escritas como JSON y quita el bloque', () => {
    const acciones: any[] = [];
    const texto = 'Les propongo el Museo del Oro.\n\n```json\n{ "tipo": "planear_cita", "titulo": "Museo del Oro" }\n{ "tipo": "agregar_plan", "titulo": "Ir al museo", "detalle": "Sábado" }\n```';
    expect(rescatarAcciones(texto, acciones)).toBe('Les propongo el Museo del Oro.');
    expect(acciones.map((a) => a.tipo)).toEqual(['planear_cita', 'agregar_plan']);
  });

  it('deja quieto un bloque de código que no es una acción', () => {
    const acciones: any[] = [];
    const texto = 'Mira:\n```\n{ "hola": 1 }\n```';
    expect(rescatarAcciones(texto, acciones)).toBe(texto);
    expect(acciones).toEqual([]);
  });

  it('no pasa de tres botones', () => {
    const acciones: any[] = [];
    const uno = '{ "tipo": "agregar_peli", "titulo": "Peli" }';
    rescatarAcciones('```json\n' + [uno, uno, uno, uno].join('\n') + '\n```', acciones);
    expect(acciones.length).toBe(3);
  });
});

describe('quitarMarcasDeCita', () => {
  it('quita las marcas que deja la búsqueda de Groq', () => {
    expect(quitarMarcasDeCita('Filarmónica a las 4 p. m. 【0†L204-L222】 en el León de Greiff【1†L3-L9】.')).toBe('Filarmónica a las 4 p. m. en el León de Greiff.');
  });
});

describe('fechasParaElSistema', () => {
  it('da el día de la semana y el fin de semana que viene', () => {
    expect(fechasParaElSistema('2026-10-15')).toEqual({ hoy: 'jueves, 15 de octubre de 2026', finde: 'sábado 17 de octubre y domingo 18 de octubre' });
  });
  it('un sábado o un domingo, el fin de semana es el que está pasando', () => {
    expect(fechasParaElSistema('2026-10-17').finde).toBe('sábado 17 de octubre y domingo 18 de octubre');
    expect(fechasParaElSistema('2026-10-18').finde).toBe('sábado 17 de octubre y domingo 18 de octubre');
  });
});
