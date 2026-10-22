// Mascotas elegidas (principal y acompañante), compartidas por toda la app.
// Se guardan también en el navegador para pintar la correcta desde el primer instante,
// sin que aparezca la ballena mientras llega la configuración.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

export type MascotaPrimariaTipo = 'ballena' | 'tiburon_ballena' | 'cachalote' | 'orca';
export type MascotaSecundariaTipo = 'caballito_de_mar' | 'medusa' | 'pez_payaso' | 'tortuga';
export type Mascotas = { primario: MascotaPrimariaTipo; secundario: MascotaSecundariaTipo };

const CLAVE = 'mascotas';
const PRIMARIAS: MascotaPrimariaTipo[] = ['ballena', 'tiburon_ballena', 'cachalote', 'orca'];
const SECUNDARIAS: MascotaSecundariaTipo[] = ['caballito_de_mar', 'medusa', 'pez_payaso', 'tortuga'];
const esPrimaria = (x: unknown): x is MascotaPrimariaTipo => PRIMARIAS.includes(x as MascotaPrimariaTipo);
const esSecundaria = (x: unknown): x is MascotaSecundariaTipo => SECUNDARIAS.includes(x as MascotaSecundariaTipo);

function leer(): Mascotas {
  let g: Partial<Mascotas> = {};
  try { g = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') ?? {}; } catch { /* sin almacenamiento o dato dañado */ }
  return {
    primario: esPrimaria(g.primario) ? g.primario : 'ballena',
    secundario: esSecundaria(g.secundario) ? g.secundario : 'medusa',
  };
}

let actual = leer();
const oyentes = new Set<() => void>();

/** Cambia las mascotas en toda la app al instante (y las recuerda en este celular) */
export function ponerMascotas(cambio: Partial<Mascotas>) {
  const nuevo = { ...actual, ...cambio };
  if (nuevo.primario === actual.primario && nuevo.secundario === actual.secundario) return;
  actual = nuevo;
  try { localStorage.setItem(CLAVE, JSON.stringify(actual)); } catch { /* vale mientras la app esté abierta */ }
  oyentes.forEach((f) => f());
}

/** Trae las mascotas guardadas en la base (por si la otra persona las cambió) */
export async function cargarMascotas() {
  const { data } = await supabase.from('configuracion').select('componente_primario, componente_secundario').eq('id', 1).maybeSingle();
  if (!data) return;
  const cambio: Partial<Mascotas> = {};
  if (esPrimaria(data.componente_primario)) cambio.primario = data.componente_primario;
  if (esSecundaria(data.componente_secundario)) cambio.secundario = data.componente_secundario;
  ponerMascotas(cambio);
}

supabase.auth.onAuthStateChange((evento, sesion) => {
  // Fuera del callback: supabase no deja consultar mientras resuelve la sesión
  if (sesion && (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN')) setTimeout(cargarMascotas, 0);
});

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };

export const useMascotas = () => useSyncExternalStore(suscribir, () => actual);
