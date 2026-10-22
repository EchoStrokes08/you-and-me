import { supabase } from './supabase';

export type PorConocer = { id: string; nombre: string; direccion: string; lat: number; lng: number; nota: string; creado_por: string; categoria_slug: string | null };

// Coordenada redondeada (~10 m): el mismo sitio es un solo punto en el mapa
export const claveLugar = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

// Los lugares que todavía no conocemos: se descartan los que ya tienen una cita
// (confirmada o vivida) o un recuerdo en ese mismo punto
export async function cargarPorConocer(): Promise<PorConocer[]> {
  const [{ data: deseos }, { data: citas }, { data: recs }] = await Promise.all([
    supabase.from('lugares_por_conocer').select('*').order('created_at', { ascending: false }),
    supabase.from('citas').select('lugar_lat, lugar_lng, lugares(lat, lng)').in('estado', ['confirmada', 'vivida']),
    supabase.from('recuerdos').select('lat, lng').not('lat', 'is', null),
  ]);
  const idos = new Set<string>();
  for (const c of citas ?? []) {
    const lat = c.lugar_lat ?? c.lugares?.lat, lng = c.lugar_lng ?? c.lugares?.lng;
    if (lat != null && lng != null) idos.add(claveLugar(lat, lng));
  }
  for (const r of recs ?? []) if (r.lat != null && r.lng != null) idos.add(claveLugar(r.lat, r.lng));
  return ((deseos ?? []) as PorConocer[]).filter((d) => !idos.has(claveLugar(d.lat, d.lng)));
}
