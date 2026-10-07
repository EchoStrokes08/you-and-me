import { supabase } from './supabase';

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type EstadoPush = 'no-soportado' | 'instalar-ios' | 'bloqueado' | 'inactivo' | 'activo';

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

// La clave VAPID viene en base64url; pushManager la quiere en bytes
const aBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

// En desarrollo no hay service worker registrado: se trata como no soportado
const registro = () => navigator.serviceWorker?.getRegistration();

async function guardar(sub: PushSubscription) {
  const j = sub.toJSON();
  await supabase.from('suscripciones_push').upsert({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth });
}

export async function estadoPush(): Promise<EstadoPush> {
  // En iPhone solo hay notificaciones con la app instalada en la pantalla de inicio
  if (esIOS() && !instalada()) return 'instalar-ios';
  if (!CLAVE_PUBLICA || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado';
  const reg = await registro();
  if (!reg) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const sub = await reg.pushManager.getSubscription();
  if (Notification.permission === 'granted' && sub) {
    await guardar(sub); // por si cambió de cuenta o se borró la fila
    return 'activo';
  }
  return 'inactivo';
}

// Debe llamarse desde un toque del usuario (iOS lo exige para pedir permiso)
export async function activarPush(): Promise<EstadoPush> {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo';
  const reg = await registro();
  if (!reg || !CLAVE_PUBLICA) return 'no-soportado';
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));
  await guardar(sub);
  return 'activo';
}

// Al cerrar sesión: que este celular deje de recibir los avisos de esa cuenta
export async function desactivarPush() {
  const sub = await (await registro())?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('suscripciones_push').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
