import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
import { fechaStr, hoy } from '../lib/utils';
import { ALTO, ANCHO, armarPelicula, dibujar, imagenDeSvg, sincronizarVideos, type Pelicula as Peli, type Rango } from '../lib/pelicula';
import { musicaDelMar } from '../lib/musicaDelMar';
import { arreglarDuracionMp4 } from '../lib/arreglarMp4';
import { MascotaPrimaria, Mar, Olas } from '../components/MascotaDinamica';
import { Encabezado, IconoAtras, IconoCerrar, IconoDescarga, IconoPausa, IconoPlay } from '../components/ui';

type Eleccion = 'todo' | 'mes' | string; // string = un año

// El formato que el celular sabe grabar: MP4 si se puede (WhatsApp lo abre en todos lados), si no WebM
const FORMATOS = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const formato = () => (typeof MediaRecorder === 'undefined' ? null : FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null);

export default function Pelicula() {
  const { aviso } = useAvisos();
  const [params] = useSearchParams();
  const [anios, setAnios] = useState<string[]>([]);
  const [eleccion, setEleccion] = useState<Eleccion>(() => params.get('desde') === 'mes' ? 'mes' : params.get('anio') ?? 'todo');
  const [conVideos, setConVideos] = useState(true);
  const [armando, setArmando] = useState<{ hechas: number; total: number } | null>(null);
  const [peli, setPeli] = useState<Peli | null>(null);
  const mascota = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('recuerdos').select('fecha').then(({ data }) => setAnios([...new Set((data ?? []).map((r) => r.fecha.slice(0, 4)))].sort().reverse()));
  }, []);
  // Al salir se sueltan las fotos de la memoria
  useEffect(() => () => peli?.liberar(), [peli]);

  const rango = (): Rango => {
    if (eleccion === 'mes') { const d = hoy(); d.setMonth(d.getMonth() - 1); return { desde: fechaStr(d), hasta: null, etiqueta: 'el último mes' }; }
    if (eleccion !== 'todo') return { desde: `${eleccion}-01-01`, hasta: `${eleccion}-12-31`, etiqueta: eleccion };
    return { desde: null, hasta: null, etiqueta: 'toda nuestra historia' };
  };

  const crear = async () => {
    setArmando({ hechas: 0, total: 0 });
    // La mascota tiene varios dibujos (el cuerpo, el chorro…): el cuerpo es el más grande
    const svgs = [...(mascota.current?.querySelectorAll('svg') ?? [])];
    const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const ballena = await imagenDeSvg(svgs.sort((x, y) => area(y) - area(x))[0] ?? null);
    const p = await armarPelicula(rango(), ballena, conVideos, (hechas, total) => setArmando({ hechas, total }));
    setArmando(null);
    if (!p) { aviso('No encontré recuerdos con fotos en ese tiempo 😢 Prueba con otro.', 'error'); return; }
    setPeli(p);
  };

  const opciones: [Eleccion, string][] = [['todo', 'Toda la historia'], ...anios.map((a) => [a, a] as [string, string]), ['mes', 'El último mes']];

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/historia" className="btn-icon" aria-label="Volver a nuestra historia"><IconoAtras /></Link>
      <Encabezado eyebrow="Sus recuerdos, con música" titulo="Nuestra película" />

      <Mar className="h-[220px] p-0">
        <div ref={mascota} className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 w-[72%]">
          <MascotaPrimaria className="w-full" />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-5" color="#CFE9E4" opacidad={0.14} />
        <p className="absolute left-5 top-4 right-5 text-white text-sm font-bold opacity-90">La app la arma sola con sus fotos, sus videos y una música del mar hecha para ustedes.</p>
      </Mar>

      <section className="card flex flex-col gap-3" aria-label="Qué recuerdos">
        <p className="font-titulo text-xl font-semibold">¿De cuándo?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rango de fechas">
          {opciones.map(([k, l]) => (
            <button key={k} onClick={() => setEleccion(k)} data-active={eleccion === k} aria-pressed={eleccion === k} className="chip text-sm">{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-3 min-h-11 cursor-pointer">
          <input type="checkbox" checked={conVideos} onChange={(e) => setConVideos(e.target.checked)} className="w-5 h-5 accent-[var(--color-hondo)]" />
          <span className="text-sm font-bold">Incluir clips de sus videos <span className="text-salvia font-semibold">(gasta más datos)</span></span>
        </label>
        <button onClick={crear} disabled={!!armando} className="btn-primary">
          <IconoPlay className="w-5 h-5" /> {armando ? (armando.total ? `Revelando ${armando.hechas} de ${armando.total}…` : 'Buscando recuerdos…') : 'Crear nuestra película'}
        </button>
        {armando && armando.total > 0 && (
          <div className="h-1.5 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={armando.total} aria-valuenow={armando.hechas} aria-label="Bajando las fotos">
            <div className="h-full bg-esmeralda rounded-full transition-[width] duration-300" style={{ width: `${(armando.hechas / armando.total) * 100}%` }} />
          </div>
        )}
      </section>

      <p className="text-sm text-salvia text-center px-4">Al final la pueden guardar como video y mandarla por WhatsApp.</p>

      {peli && <Reproductor peli={peli} onCerrar={() => setPeli(null)} />}
    </div>
  );
}

/* ---------- Reproductor a pantalla completa ---------- */
function Reproductor({ peli, onCerrar }: { peli: Peli; onCerrar: () => void }) {
  const { aviso } = useAvisos();
  const lienzo = useRef<HTMLCanvasElement>(null);
  const audio = useRef<{ ac: AudioContext; t0: number } | null>(null);
  const grabador = useRef<MediaRecorder | null>(null);
  const [andando, setAndando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [grabando, setGrabando] = useState(false);
  const [video, setVideo] = useState<{ archivo: File; url: string } | null>(null);
  const [controles, setControles] = useState(true);
  const salio = useRef(false);
  // Cada arranque tiene su número: si llega otro mientras este espera, este se descarta
  const arranque = useRef(0);

  // Empezar (o volver a empezar) desde el segundo cero; con `grabar`, también se graba
  const empezar = async (grabar: boolean) => {
    const n = ++arranque.current;
    audio.current?.ac.close().catch(() => {});
    audio.current = null;
    const ac = new AudioContext();
    // Sin un toque reciente el navegador no deja sonar: se espera a que la toquen
    await Promise.race([ac.resume(), new Promise((ok) => setTimeout(ok, 400))]);
    if (n !== arranque.current) { ac.close().catch(() => {}); return; }
    if (ac.state !== 'running') { ac.close().catch(() => {}); setAndando(false); setControles(true); return; }
    const destinos: AudioNode[] = [ac.destination];
    let rec: MediaRecorder | null = null;
    if (grabar) {
      const tipo = formato();
      if (!tipo || !lienzo.current?.captureStream) { aviso('Este celular no deja grabar video desde la app 😢', 'error'); return; }
      const salida = ac.createMediaStreamDestination();
      destinos.push(salida);
      const stream = lienzo.current.captureStream(30);
      salida.stream.getAudioTracks().forEach((pista) => stream.addTrack(pista));
      rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 2_500_000 });
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      rec.onstop = async () => {
        const ext = tipo.startsWith('video/mp4') ? 'mp4' : 'webm';
        // El MP4 de Chrome trae mal la duración de cada pista: se corrige antes de compartirlo
        const datos = ext === 'mp4' ? arreglarDuracionMp4(await new Blob(partes).arrayBuffer()) : new Blob(partes);
        const archivo = new File([datos], `nuestra-pelicula.${ext}`, { type: tipo.split(';')[0] });
        setVideo({ archivo, url: URL.createObjectURL(archivo) });
        setGrabando(false);
        if (salio.current) aviso('Saliste de la app mientras se grababa: puede que el video tenga partes quietas.', 'error');
      };
      salio.current = false;
      rec.start();
      setGrabando(true);
    }
    grabador.current = rec;
    const t0 = ac.currentTime + 0.15;
    musicaDelMar(ac, destinos, t0, peli.total);
    audio.current = { ac, t0 };
    setVideo(null);
    setAndando(true);
  };

  const alternar = async () => {
    setControles(true);
    const a = audio.current;
    if (!a) return empezar(false);
    if (grabando) return; // grabando no se pausa: el video saldría cortado
    if (andando) { await a.ac.suspend(); setAndando(false); }
    else if (a.ac.currentTime - a.t0 >= peli.total) empezar(false);
    else { await a.ac.resume(); setAndando(true); }
  };

  // El cuadro de cada momento sale del reloj del audio: la música y la imagen nunca se desfasan
  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0, ultimo = 0;
    const cuadro = () => {
      const a = audio.current;
      const t = a ? Math.max(0, a.ac.currentTime - a.t0) : 0;
      dibujar(ctx, peli, Math.min(t, peli.total - 0.01));
      sincronizarVideos(peli, t, andando);
      if (performance.now() - ultimo > 200) { setTiempo(t); ultimo = performance.now(); }
      if (a && t >= peli.total) {
        setAndando(false); setControles(true);
        if (grabador.current?.state === 'recording') grabador.current.stop();
        grabador.current = null;
        return;
      }
      raf = requestAnimationFrame(cuadro);
    };
    cuadro();
    return () => cancelAnimationFrame(raf);
  }, [peli, andando]);

  // Al cerrar: se calla la música, se corta la grabación y se paran los videos
  const detenerTodo = () => {
    arranque.current++;
    audio.current?.ac.close().catch(() => {});
    audio.current = null;
    if (grabador.current?.state === 'recording') grabador.current.stop();
    peli.videos.forEach((v) => v.pause());
  };

  // Arranca sola al abrir; la pantalla no se apaga mientras se ve
  useEffect(() => {
    empezar(false);
    let bloqueo: WakeLockSentinel | null = null;
    // Safari viejo no tiene wakeLock
    navigator.wakeLock?.request('screen').then((b) => { bloqueo = b; }).catch(() => {});
    const alSalir = () => { if (document.visibilityState === 'hidden') salio.current = true; };
    document.addEventListener('visibilitychange', alSalir);
    return () => {
      detenerTodo();
      void bloqueo?.release();
      document.removeEventListener('visibilitychange', alSalir);
    };
    // Solo al abrir
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los controles se esconden solos mientras se ve
  useEffect(() => {
    if (!andando || !controles) return;
    const t = setTimeout(() => setControles(false), 2500);
    return () => clearTimeout(t);
  }, [andando, controles]);

  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  const compartir = async () => {
    if (!video) return;
    const datos = { files: [video.archivo], title: 'Nuestra película 💚' };
    if (navigator.canShare?.(datos)) { try { await navigator.share(datos); return; } catch { return; } }
    descargar();
  };
  const descargar = () => {
    if (!video) return;
    const a = document.createElement('a');
    a.href = video.url; a.download = video.archivo.name; a.click();
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const termino = !andando && tiempo >= peli.total - 0.1;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] bg-[#06181A] flex items-center justify-center select-none"
      role="dialog" aria-modal="true" aria-label="Nuestra película">
      <canvas ref={lienzo} width={ANCHO} height={ALTO} onClick={alternar} className="max-w-full max-h-full aspect-[9/16] h-full object-contain"
        aria-label={andando ? 'Pausar' : 'Reproducir'} role="button" />

      <AnimatePresence>
        {(controles || !andando) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div className="pointer-events-auto flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
              {grabando ? <span className="badge bg-alerta text-white"><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Grabando · no salgas de la app</span> : <span />}
              <button onClick={onCerrar} className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Cerrar la película"><IconoCerrar /></button>
            </div>

            {!andando && !termino && !grabando && (
              <button onClick={alternar} className="pointer-events-auto self-center w-20 h-20 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-sm" aria-label="Seguir viendo">
                <IconoPlay className="w-9 h-9" />
              </button>
            )}

            <div className="pointer-events-auto px-5 pb-[max(env(safe-area-inset-bottom),18px)] flex flex-col gap-3">
              {termino && !grabando && (
                <div className="flex flex-col gap-2 max-w-sm w-full mx-auto">
                  {video ? (
                    <>
                      <button onClick={compartir} className="btn-primary">Mandarla 💚</button>
                      <button onClick={descargar} className="btn-soft"><IconoDescarga className="w-5 h-5" /> Guardar en el celular</button>
                    </>
                  ) : (
                    <button onClick={() => empezar(true)} className="btn-primary"><IconoDescarga className="w-5 h-5" /> Guardarla como video</button>
                  )}
                  <button onClick={() => empezar(false)} className="btn-soft">Verla otra vez</button>
                  {!video && <p className="text-xs text-white/70 text-center">Para guardarla se vuelve a reproducir de principio a fin ({mmss(peli.total)}).</p>}
                </div>
              )}
              <div className="flex items-center gap-3 text-white text-xs font-bold tabular-nums">
                {andando && !grabando ? <button onClick={alternar} className="w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Pausar"><IconoPausa className="w-5 h-5" /></button> : null}
                <span>{mmss(Math.min(tiempo, peli.total))}</span>
                <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(peli.total)} aria-valuenow={Math.round(tiempo)} aria-label="Avance de la película">
                  <div className="h-full bg-lima rounded-full" style={{ width: `${Math.min(100, (tiempo / peli.total) * 100)}%` }} />
                </div>
                <span>{mmss(peli.total)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
