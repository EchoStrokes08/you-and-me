// Qué ideas de cita tienen sentido en un lugar.
//  · propias: las que van con ese lugar. En uno del catálogo, las que se le anotaron;
//    en uno del mapa (no tiene ideas anotadas), las de su mismo tipo de plan.
//  · otras: en uno del catálogo, las ideas generales de su tipo de plan; en uno del mapa, todas las demás.
// Una idea general ("comodín") sirve en cualquier lugar de sus tipos de plan, no en cualquier lugar.
type Lugar = { id: string; es_mapa?: boolean; categorias?: string[] | null };

export function ideasPara(lugar: Lugar | null, actividades: any[], vinculos: any[]): { propias: any[]; otras: any[] } {
  const ideas = actividades.filter((a) => !a.es_sorpresa);
  if (!lugar) return { propias: [], otras: ideas.filter((a) => a.es_comodin) };
  const tipos = lugar.categorias ?? [];
  const afin = (a: any) => a.es_comodin && (a.categorias ?? []).some((c: string) => tipos.includes(c));
  if (lugar.es_mapa) return { propias: ideas.filter(afin), otras: ideas.filter((a) => !afin(a)) };
  const vinc = new Set(vinculos.filter((v) => v.lugar_id === lugar.id).map((v) => v.actividad_id));
  return { propias: ideas.filter((a) => vinc.has(a.id)), otras: ideas.filter((a) => !vinc.has(a.id) && afin(a)) };
}
