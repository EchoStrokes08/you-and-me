export const hoy = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const fechaStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fechaBonita = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Hoy como 'YYYY-MM-DD' en hora local (toISOString usa UTC: en Bogotá después de las 7 p. m. ya sería mañana)
export const hoyStr = () => fechaStr(hoy());

export const hoyBonito = () => new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export const diasEntre = (s: string) => {
  const a = hoy();
  const b = new Date(s + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

export const precioStr = (n: number) => '💰'.repeat(Math.max(1, Math.min(4, n)));

export const diasLabel = (arr: number[] | null) => {
  if (!arr) return null;
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return arr.map((d) => nombres[d]).join(' y ');
};

// Nombre del lugar de una cita: del catálogo o elegido en el mapa
export const nombreLugar = (c: any): string | undefined => c?.lugares?.nombre ?? c?.lugar_personalizado ?? undefined;

// Link de Google Maps para un lugar elegido en el mapa
export const linkMapa = (c: any): string | null =>
  c?.lugar_lat != null && c?.lugar_lng != null ? `https://www.google.com/maps/search/?api=1&query=${c.lugar_lat},${c.lugar_lng}` : null;

// Quién puede modificar una cita desde la app (debe coincidir con la política citas_update)
export const puedeEditar = (c: any, perfil: { id: string; rol: string } | null) =>
  !!perfil && ['pendiente', 'confirmada'].includes(c.estado) && (perfil.rol === 'admin' || c.creada_por === perfil.id);

// '19:30:00' → '7:30 p. m.'
export const horaBonita = (h?: string | null) => {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  return new Date(2000, 0, 1, hh, mm).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
};
