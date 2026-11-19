// Fondo marino quieto en este celular: sin animaciones, para teléfonos a los que se les hace pesado.
// Se guarda en el navegador (como el tema) y quien lo cambia avisa a la app para que se aplique al momento.
import { useSyncExternalStore } from 'react';

const CLAVE = 'fondo-quieto';
const EVENTO = 'fondo-quieto';

export function leerFondoQuieto(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

// Sin almacenamiento, vale solo mientras la app esté abierta
let enMemoria: boolean | null = null;

export function guardarFondoQuieto(quieto: boolean) {
  enMemoria = quieto;
  try {
    if (quieto) localStorage.setItem(CLAVE, '1');
    else localStorage.removeItem(CLAVE);
  } catch { /* se queda en memoria */ }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

const actual = () => enMemoria ?? leerFondoQuieto();

/** true si en este celular escogieron el fondo sin animación */
export function useFondoQuieto(): boolean {
  return useSyncExternalStore(suscribir, actual, () => false);
}
