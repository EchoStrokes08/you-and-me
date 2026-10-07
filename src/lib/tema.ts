// Tema de la app en este celular: automático (el del sistema), claro u oscuro.
// Se guarda en el navegador; index.html lo aplica antes de pintar para que no parpadee.
export type Tema = 'auto' | 'claro' | 'oscuro';

const CLAVE = 'tema';
const BARRA = { claro: '#2F6B4F', oscuro: '#0D1814' };

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'claro' || t === 'oscuro' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function aplicarTema(t: Tema) {
  const raiz = document.documentElement;
  if (t === 'auto') delete raiz.dataset.tema;
  else raiz.dataset.tema = t;
  // Color de la barra de estado: hay una etiqueta para claro y otra para oscuro
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const delSistema = m.getAttribute('media')?.includes('dark') ? BARRA.oscuro : BARRA.claro;
    m.setAttribute('content', t === 'auto' ? delSistema : BARRA[t]);
  });
}

export function guardarTema(t: Tema) {
  try {
    if (t === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, t);
  } catch { /* sin almacenamiento: vale solo mientras la app esté abierta */ }
  aplicarTema(t);
}
