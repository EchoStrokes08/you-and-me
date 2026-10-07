import { nombreLugar } from './utils';

// Datos de una cita para el calendario. Una cita sin hora queda como evento de todo el día;
// con hora, dura 3 horas. Bogotá no tiene horario de verano: siempre UTC-5.
type Evento = { titulo: string; fecha: string; hora: string | null; lugar: string; detalles: string };

export function eventoDeCita(c: any, ocultarSorpresa: boolean): Evento {
  const sorpresa = c.es_cita_sorpresa && ocultarSorpresa;
  const lugar = sorpresa ? '' : (c.lugar_direccion || nombreLugar(c) || '');
  const mapa = !sorpresa && c.lugar_lat != null ? `https://www.google.com/maps/search/?api=1&query=${c.lugar_lat},${c.lugar_lng}` : '';
  return {
    titulo: sorpresa ? 'Cita sorpresa 🎁💚' : `Cita 💚 ${nombreLugar(c) ?? ''}`.trim(),
    fecha: c.fecha,
    hora: c.hora_confirmada?.slice(0, 5) ?? null,
    lugar,
    detalles: [sorpresa ? null : c.actividades?.nombre, c.franjas?.nombre, c.nota_admin, mapa].filter(Boolean).join('\n'),
  };
}

const compacta = (f: string) => f.replaceAll('-', '');
const diaSiguiente = (f: string) => {
  const d = new Date(f + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function linkGoogle(e: Evento) {
  const fechas = e.hora
    ? (() => {
        const ini = new Date(`${e.fecha}T${e.hora}:00-05:00`);
        const fin = new Date(ini.getTime() + 3 * 3600_000);
        const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
        return `${z(ini)}/${z(fin)}`;
      })()
    // Google pide el día siguiente como fin de un evento de todo el día
    : `${compacta(e.fecha)}/${compacta(diaSiguiente(e.fecha))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.titulo, dates: fechas, location: e.lugar, details: e.detalles, ctz: 'America/Bogota' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// Archivo .ics servido por /api/ics: así el iPhone lo abre directo en Calendario
export function linkIcs(e: Evento) {
  const p = new URLSearchParams({ t: e.titulo, f: e.fecha, l: e.lugar, n: e.detalles });
  if (e.hora) p.set('h', e.hora);
  return `/api/ics?${p}`;
}
