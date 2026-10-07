// Función de Vercel: la base de datos la llama (pg_net) cuando hay algo que avisar
// y esta le manda la notificación push al celular del otro.
import webpush, { type PushSubscription } from 'web-push';

type Sub = PushSubscription & { rol?: 'admin' | 'pareja' };
type Aviso = { evento: string; nombre: string; datos: Record<string, any>; subs: Sub[] };

const fechaBonita = (f?: string) =>
  f ? new Date(f + 'T00:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';

const lugarCita = (d: Record<string, any>) => (d.sorpresa ? 'Cita sorpresa 🎁' : d.lugar ?? 'Lugar sorpresa 🎁');

function mensaje({ evento, nombre, datos: d }: Aviso, rol?: string) {
  const cuando = fechaBonita(d.fecha);
  const citas = rol === 'admin' ? '/admin' : '/citas';
  switch (evento) {
    case 'cita_nueva':
      return { titulo: `💌 ${nombre} propuso una cita`, cuerpo: `${lugarCita(d)} · ${cuando}`, url: citas };
    case 'cita_confirmada':
      return { titulo: '💚 ¡Cita confirmada!', cuerpo: `${lugarCita(d)} · ${cuando}${d.hora ? ` a las ${String(d.hora).slice(0, 5)}` : ''}`, url: '/citas' };
    case 'cita_cancelada':
      return { titulo: '😢 Se canceló una cita', cuerpo: `${lugarCita(d)} · ${cuando}`, url: '/citas' };
    case 'cita_editada':
      return { titulo: `✏️ ${nombre} cambió una cita`, cuerpo: `${lugarCita(d)} · ${cuando}`, url: citas };
    case 'respuesta':
      return {
        titulo: `💬 ${nombre} respondió la pregunta del día`,
        cuerpo: d.ya_respondio ? 'Ya pueden ver lo que respondieron 💚' : 'Responde tú para ver lo que dijo 👀',
        url: '/preguntas',
      };
    case 'recuerdo':
      return { titulo: `📸 ${nombre} guardó un recuerdo`, cuerpo: d.titulo ?? '', url: '/historia' };
    case 'nota':
      return { titulo: `💭 ${nombre} dejó una nota`, cuerpo: d.titulo ? `En «${d.titulo}»` : '', url: '/historia' };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const { NOTIF_SECRETO, VAPID_PRIVATE_KEY, VITE_VAPID_PUBLIC_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
  if (!NOTIF_SECRETO || request.headers.get('x-secreto') !== NOTIF_SECRETO) return new Response('No autorizado', { status: 401 });
  if (!VAPID_PRIVATE_KEY || !VITE_VAPID_PUBLIC_KEY) return new Response('Faltan las claves VAPID', { status: 500 });

  const aviso = (await request.json()) as Aviso;
  webpush.setVapidDetails(new URL(request.url).origin, VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const vencidas: string[] = [];
  await Promise.all(
    aviso.subs.map(async (s) => {
      const m = mensaje(aviso, s.rol);
      if (!m) return;
      try {
        await webpush.sendNotification(s, JSON.stringify({ ...m, tag: aviso.evento }), { TTL: 60 * 60 * 24 });
      } catch (e: any) {
        // 404/410: el celular ya no acepta notificaciones de esta suscripción
        if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(s.endpoint);
        else console.error('push', e?.statusCode, e?.body ?? e?.message);
      }
    }),
  );

  if (vencidas.length && VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) {
    await fetch(`${VITE_SUPABASE_URL}/rest/v1/rpc/borrar_suscripciones_vencidas`, {
      method: 'POST',
      headers: { apikey: VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_endpoints: vencidas, p_secreto: NOTIF_SECRETO }),
    });
  }

  return Response.json({ ok: true, vencidas: vencidas.length });
}
