import { supabase } from './supabase';

// Lo que Payakan dice cuando algo falla, para el chat y para Aprender
export const ERRORES_PAYAKAN: Record<string, string> = {
  sin_clave: 'Todavía no estoy activado 🐋 Falta ponerme una llave (GROQ_API_KEY, GEMINI_API_KEY o ANTHROPIC_API_KEY) en Vercel y volver a desplegar.',
  tope: 'Por hoy ya hablamos muchísimo 💚 Mañana seguimos.',
  ocupado: 'Estoy un poquito ocupado, inténtalo en un minuto 🐋',
  sin_sesion: 'Tu sesión se venció. Cierra y abre la app otra vez.',
  fallo: 'Algo me falló al pensar 😢 Inténtalo otra vez.',
  red: 'No hay conexión. Cuando vuelva la señal, pregúntame otra vez.',
};

// Una pregunta a /api/asistente con la sesión de quien pregunta. Devuelve la respuesta o el texto del error
export async function preguntarAPayakan(cuerpo: object): Promise<{ ok: true; datos: any } | { ok: false; texto: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/asistente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(cuerpo),
    });
    const j = await r.json().catch(() => ({ error: 'fallo' }));
    if (!r.ok || j.error) return { ok: false, texto: ERRORES_PAYAKAN[j.error] ?? ERRORES_PAYAKAN.fallo };
    return { ok: true, datos: j };
  } catch {
    return { ok: false, texto: ERRORES_PAYAKAN.red };
  }
}
