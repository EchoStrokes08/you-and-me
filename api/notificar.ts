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
    case 'carta_nueva':
      return {
        titulo: `💌 ${nombre} te escribió una carta`,
        cuerpo: d.momento ? `Ábrela ${d.momento}` : d.disponible ? 'Ya la puedes abrir ✨' : `Se abre el ${fechaBonita(d.abrir_desde)} 🔒`,
        url: '/cartas',
      };
    case 'carta_disponible':
      return { titulo: `💌 Ya puedes abrir la carta de ${nombre}`, cuerpo: `«${d.titulo}»`, url: '/cartas' };
    case 'carta_abierta':
      return { titulo: `💚 ${nombre} abrió tu carta`, cuerpo: `«${d.titulo}»`, url: '/cartas' };
    case 'pienso_en_ti':
      return { titulo: `💚 ${nombre} está pensando en ti`, cuerpo: 'Toca para mandarle uno de vuelta 🥰', url: '/' };
    case 'recordatorio_cita': {
      const hora = d.hora ? String(d.hora).slice(0, 5) : null;
      const titulo = d.cuando === 'manana' ? '🌙 Mañana tenemos cita' : hora ? `⏰ Hoy a las ${hora} tenemos cita` : '☀️ Hoy tenemos cita';
      // Si es sorpresa, ella no ve a dónde van
      const oculto = d.sorpresa && rol !== 'admin';
      const partes = [
        oculto ? 'Sorpresa 🎁' : [d.lugar ?? 'Sorpresa 🎁', d.actividad].filter(Boolean).join(' · '),
        !hora && d.franja ? d.franja : null,
        d.vestimenta ? `👗 ${d.vestimenta}` : null,
        rol === 'admin' && d.detalles?.length ? `🎁 Llevar: ${d.detalles.join(', ')}` : null,
      ];
      return { titulo, cuerpo: partes.filter(Boolean).join('\n'), url: '/citas' };
    }
    case 'mesiversario': {
      const anios = d.meses / 12;
      return Number.isInteger(anios)
        ? { titulo: '🎉 ¡Feliz aniversario!', cuerpo: `Hoy cumplimos ${anios} ${anios === 1 ? 'año' : 'años'} juntos 💚`, url: '/' }
        : { titulo: '💚 ¡Feliz mesiversario!', cuerpo: `Hoy cumplimos ${d.meses} meses juntos`, url: '/' };
    }
    case 'cumple_tuyo':
      return { titulo: `🎂 ¡Feliz cumpleaños, ${nombre}!`, cuerpo: 'Hoy es tu día 💚', url: '/' };
    case 'cumple_pareja':
      return { titulo: `🎂 Hoy es el cumpleaños de ${nombre}`, cuerpo: 'No olvides felicitarle 💚', url: '/' };
    case 'racha':
      return d.dias > 0
        ? { titulo: `🔥 Llevan ${d.dias} ${d.dias === 1 ? 'día' : 'días'} de racha`, cuerpo: 'Te falta la pregunta de hoy: ¡no la rompas!', url: '/preguntas' }
        : { titulo: '💭 Te falta la pregunta del día', cuerpo: 'Respóndela hoy y empiezan una racha 🔥', url: '/preguntas' };
    case 'animo':
      return {
        titulo: `${d.emoji} ${nombre} hoy se siente ${d.etiqueta}`,
        cuerpo: ['triste', 'con estrés', 'sin energía'].includes(d.etiqueta) ? 'Mándale un poquito de amor 💚' : 'Cuéntale cómo te sientes tú',
        url: '/',
      };
    case 'sueno_nuevo':
      return { titulo: `✨ ${nombre} agregó algo por hacer juntos`, cuerpo: `${d.emoji} ${d.titulo}`, url: '/juntos' };
    case 'sueno_cumplido':
      return { titulo: '🎉 ¡Cumplimos uno de nuestros planes!', cuerpo: `${d.emoji} ${d.titulo}`, url: '/juntos' };
    case 'regalo_nuevo':
      return { titulo: `🎁 ${nombre} agregó algo a su lista de deseos`, cuerpo: d.nombre, url: '/juntos?tab=regalos' };
    case 'cumple_pronto':
      return { titulo: `🎁 En 3 días es el cumpleaños de ${nombre}`, cuerpo: '¿Ya tienes el regalo? 🤫', url: '/' };
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
