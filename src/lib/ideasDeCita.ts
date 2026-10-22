// Qué ideas de cita tienen sentido en un lugar.
//  · propias: las que van con ese lugar. En uno del catálogo, las que se le anotaron;
//    en uno del mapa (no tiene ideas anotadas), las de su mismo tipo de plan.
//  · otras: en uno del catálogo, las ideas generales de su tipo de plan; en uno del mapa, todas las demás.
// Una idea general ("comodín") sirve en cualquier lugar de sus tipos de plan, no en cualquier lugar.
type Lugar = { id: string; es_mapa?: boolean; categorias?: string[] | null };
// Lo mínimo que se necesita de una idea (actividad) y de cada vínculo lugar ↔ idea
type Idea = { id: string; es_sorpresa?: boolean; es_comodin?: boolean; categorias?: string[] | null };
type Vinculo = { lugar_id: string; actividad_id: string };

export function ideasPara<I extends Idea>(lugar: Lugar | null, actividades: I[], vinculos: Vinculo[]): { propias: I[]; otras: I[] } {
  const ideas = actividades.filter((a) => !a.es_sorpresa);
  if (!lugar) return { propias: [], otras: ideas.filter((a) => a.es_comodin) };

  const tiposDelLugar = lugar.categorias ?? [];
  const esAfin = (a: I) => !!a.es_comodin && (a.categorias ?? []).some((tipo) => tiposDelLugar.includes(tipo));
  if (lugar.es_mapa) return { propias: ideas.filter(esAfin), otras: ideas.filter((a) => !esAfin(a)) };

  const anotadas = new Set(vinculos.filter((v) => v.lugar_id === lugar.id).map((v) => v.actividad_id));
  return { propias: ideas.filter((a) => anotadas.has(a.id)), otras: ideas.filter((a) => !anotadas.has(a.id) && esAfin(a)) };
}
