// Devuelve una cita como archivo .ics (Calendario del iPhone, Outlook…).
// Recibe todo por la URL: no lee la base ni necesita sesión.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const fecha = q.get('f') ?? '';
  const hora = q.get('h');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || (hora && !/^\d{2}:\d{2}$/.test(hora))) return new Response('Fecha inválida', { status: 400 });
  const titulo = (q.get('t') ?? 'Cita 💚').slice(0, 200);
  const lugar = (q.get('l') ?? '').slice(0, 300);
  const notas = (q.get('n') ?? '').slice(0, 1000);

  let cuando: string[];
  if (hora) {
    // Bogotá es UTC-5 todo el año
    const ini = new Date(`${fecha}T${hora}:00-05:00`);
    const fin = new Date(ini.getTime() + 3 * 3600_000);
    cuando = [`DTSTART:${utc(ini)}`, `DTEND:${utc(fin)}`];
  } else {
    const sig = new Date(fecha + 'T12:00:00Z');
    sig.setUTCDate(sig.getUTCDate() + 1);
    cuando = [`DTSTART;VALUE=DATE:${fecha.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${sig.toISOString().slice(0, 10).replaceAll('-', '')}`];
  }

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//You and me//Citas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${fecha}-${hora ?? 'dia'}-${encodeURIComponent(titulo).slice(0, 40)}@you-and-me`,
    `DTSTAMP:${utc(new Date())}`,
    ...cuando,
    `SUMMARY:${esc(titulo)}`,
    lugar ? `LOCATION:${esc(lugar)}` : '',
    notas ? `DESCRIPTION:${esc(notas)}` : '',
    // Recordatorio 2 horas antes (o la noche anterior si es de todo el día)
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(titulo)}`, `TRIGGER:${hora ? '-PT2H' : '-PT6H'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="cita.ics"', 'Cache-Control': 'no-store' },
  });
}
