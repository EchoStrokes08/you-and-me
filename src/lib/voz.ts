import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// iPhone graba en MP4/AAC y Chrome reciente también; WebM queda de respaldo
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
const formato = () => (typeof MediaRecorder === 'undefined' ? null : FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? '');
export const puedeGrabar = () => !!navigator.mediaDevices?.getUserMedia && formato() !== null;

export type Audio = { blob: Blob; segundos: number };
type Estado = 'listo' | 'grabando' | 'grabado' | 'error';

export function useGrabadora(maxSegundos = 90) {
  const [estado, setEstado] = useState<Estado>('listo');
  const [segundos, setSegundos] = useState(0);
  const [audio, setAudio] = useState<Audio | null>(null);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const reloj = useRef<number | null>(null);
  const inicio = useRef(0);

  const limpiar = () => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  };

  const detener = useCallback(() => {
    if (rec.current?.state === 'recording') rec.current.stop();
  }, []);

  const grabar = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = formato() || undefined;
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      const partes: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      r.onstart = () => { inicio.current = Date.now(); };
      r.onstop = async () => {
        limpiar();
        const blob = new Blob(partes, { type: r.mimeType || tipo || 'audio/mp4' });
        // El reloj incluye lo que tarda el micrófono en arrancar y en cerrar; la duración real sale del audio
        const real = await duracionDe(blob);
        const s = Math.max(1, Math.round(real ?? (Date.now() - inicio.current) / 1000));
        setAudio({ blob, segundos: s });
        setEstado('grabado');
      };
      rec.current = r;
      inicio.current = Date.now();
      setSegundos(0);
      r.start();
      setEstado('grabando');
      reloj.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - inicio.current) / 1000);
        setSegundos(s);
        if (s >= maxSegundos) r.stop();
      }, 250);
    } catch (e: any) {
      limpiar();
      setEstado('error');
      setError(e?.name === 'NotAllowedError' ? 'Necesito permiso para usar el micrófono 🎙️' : 'No pude usar el micrófono 😢');
    }
  }, [maxSegundos]);

  const descartar = useCallback(() => { setAudio(null); setSegundos(0); setEstado('listo'); }, []);
  // Vuelve a poner un audio guardado como borrador
  const restaurar = useCallback((a: Audio) => { setAudio(a); setEstado('grabado'); }, []);

  // Si se sale de la app grabando, se termina la grabación para que quede guardada
  useEffect(() => {
    const alSalir = () => { if (document.visibilityState === 'hidden' && rec.current?.state === 'recording') rec.current.stop(); };
    document.addEventListener('visibilitychange', alSalir);
    return () => document.removeEventListener('visibilitychange', alSalir);
  }, []);

  // Si se cierra la pantalla grabando, soltar el micrófono
  useEffect(() => () => { if (rec.current?.state === 'recording') { rec.current.onstop = null; rec.current.stop(); } limpiar(); }, []);

  return { estado, segundos, audio, error, grabar, detener, descartar, restaurar, maxSegundos };
}

// Decodifica el audio para saber cuánto dura de verdad (los WebM de MediaRecorder no traen duración)
export async function duracionDe(blob: Blob): Promise<number | null> {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  const ctx: AudioContext = new Ctx();
  try {
    const datos = await ctx.decodeAudioData(await blob.arrayBuffer());
    return datos.duration;
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }
}

const extension =(tipo: string) => (tipo.includes('webm') ? 'webm' : tipo.includes('ogg') ? 'ogg' : 'm4a');

// Sube un audio al bucket "adjuntos" dentro de la carpeta dada; devuelve la ruta
export async function subirAudio(carpeta: string, a: Audio): Promise<string | null> {
  const ruta = `${carpeta}/${Date.now()}.${extension(a.blob.type)}`;
  const { error } = await supabase.storage.from('adjuntos').upload(ruta, a.blob, { contentType: a.blob.type || 'audio/mp4' });
  return error ? null : ruta;
}

export async function urlAdjunto(ruta: string, segundos = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from('adjuntos').createSignedUrl(ruta, segundos);
  return data?.signedUrl ?? null;
}

export const duracionTxt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* Borradores de audio en el teléfono (IndexedDB: localStorage no sirve para archivos).
   Si el sistema cierra la app, la nota de voz grabada no se pierde, igual que el texto de las cartas. */
const BD = 'borradores-voz';
const abrirBD = () => new Promise<IDBDatabase>((ok, falla) => {
  const r = indexedDB.open(BD, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('audios');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => falla(r.error);
});

export async function guardarAudioBorrador(clave: string, a: Audio | null) {
  try {
    const bd = await abrirBD();
    await new Promise<void>((ok, falla) => {
      const tx = bd.transaction('audios', 'readwrite');
      if (a) tx.objectStore('audios').put({ blob: a.blob, segundos: a.segundos }, clave);
      else tx.objectStore('audios').delete(clave);
      tx.oncomplete = () => ok();
      tx.onerror = () => falla(tx.error);
    });
    bd.close();
  } catch { /* sin almacenamiento: solo se pierde el borrador */ }
}

export async function leerAudioBorrador(clave: string): Promise<Audio | null> {
  try {
    const bd = await abrirBD();
    const a = await new Promise<Audio | undefined>((ok, falla) => {
      const r = bd.transaction('audios').objectStore('audios').get(clave);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falla(r.error);
    });
    bd.close();
    return a?.blob instanceof Blob && a.blob.size ? a : null;
  } catch {
    return null;
  }
}
