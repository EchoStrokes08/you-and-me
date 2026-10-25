// Pruebas de pedirGemini en api/asistente: cuotas, claves inválidas y modelos saturados.
// La red va de mentira: el doble inyecta un fetch falso por parámetro (nunca se stubbea el global).
import { describe, expect, it } from 'vitest';
import { ErrorAsistente, memoriaNueva, pedirGemini } from '../api/asistente';

// Un "Google" de mentira: decide la respuesta según el modelo y la clave, y anota cada intento
function google(reglas: (modelo: string, clave: string) => number) {
  const intentos: string[] = [];
  const pedir = (async (url: string, init: any) => {
    const modelo = String(url).match(/models\/([^:]+):/)![1];
    const clave = init.headers['x-goog-api-key'];
    intentos.push(`${modelo}|${clave}`);
    const status = reglas(modelo, clave);
    return new Response(status === 200 ? '{"ok":true}' : '{}', { status });
  }) as typeof fetch;
  return { pedir, intentos };
}
const limite = () => Date.now() + 50_000;

describe('pedirGemini', () => {
  it('salta la clave sin cuota y en la siguiente vuelta ya no la vuelve a probar', async () => {
    const { pedir, intentos } = google((_m, clave) => (clave === 'a' ? 429 : 200));
    const memoria = memoriaNueva();
    await pedirGemini(['a', 'b', 'c'], {}, limite(), memoria, pedir);
    await pedirGemini(['a', 'b', 'c'], {}, limite(), memoria, pedir);
    expect(intentos).toEqual(['gemini-3.6-flash|a', 'gemini-3.6-flash|b', 'gemini-3.6-flash|b']);
  });

  it('un modelo saturado se deja de lado y se sigue con el siguiente', async () => {
    const { pedir, intentos } = google((modelo) => (modelo === 'gemini-3.6-flash' ? 503 : 200));
    const memoria = memoriaNueva();
    await pedirGemini(['a', 'b'], {}, limite(), memoria, pedir);
    await pedirGemini(['a', 'b'], {}, limite(), memoria, pedir);
    // Con el primer 503 no se prueba la clave b en ese modelo; luego se va directo al que respondió
    expect(intentos).toEqual(['gemini-3.6-flash|a', 'gemini-3.5-flash|a', 'gemini-3.5-flash|a']);
  });

  it('una clave inválida no se prueba con ningún otro modelo', async () => {
    const { pedir, intentos } = google((modelo, clave) => (clave === 'mala' ? 403 : modelo === 'gemini-3.6-flash' ? 429 : 200));
    await pedirGemini(['mala', 'buena'], {}, limite(), memoriaNueva(), pedir);
    expect(intentos).toEqual(['gemini-3.6-flash|mala', 'gemini-3.6-flash|buena', 'gemini-3.5-flash|buena']);
  });

  it('prueba todas las claves que haya, sin tope, antes de rendirse', async () => {
    const claves = Array.from({ length: 12 }, (_, i) => `k${i}`);
    const { pedir, intentos } = google(() => 429);
    await expect(pedirGemini(claves, {}, limite(), memoriaNueva(), pedir)).rejects.toBeInstanceOf(ErrorAsistente);
    expect(intentos.length).toBe(12 * 3);
  });
});
