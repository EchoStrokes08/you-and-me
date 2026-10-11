import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { duracionDe, duracionTxt, guardarAudioBorrador, leerAudioBorrador, puedeGrabar, urlAdjunto, useGrabadora, type Audio } from '../lib/voz';
import { IconoMicro, IconoParar, IconoPausa, IconoPlay } from './ui';

/* Grabadora: botón para grabar, parar, escuchar y volver a grabar.
   Avisa con onCambio(audio | null) cada vez que hay (o deja de haber) un audio listo.
   Con `borrador`, el audio se guarda en el teléfono con esa clave y se recupera al volver. */
export function Grabadora({ onCambio, maxSegundos = 90, etiqueta = 'Grabar una nota de voz', borrador }: {
  onCambio: (a: Audio | null) => void; maxSegundos?: number; etiqueta?: string; borrador?: string;
}) {
  const g = useGrabadora(maxSegundos);
  const [url, setUrl] = useState<string | null>(null);
  // Hasta leer el borrador no se guarda nada: si no, el "sin audio" del inicio lo borraría
  const borradorLeido = useRef(!borrador);
  const [recuperado, setRecuperado] = useState(false);

  useEffect(() => {
    if (!borrador) return;
    let vivo = true;
    leerAudioBorrador(borrador).then((a) => {
      if (!vivo) return;
      if (a) { g.restaurar(a); setRecuperado(true); }
      borradorLeido.current = true;
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador]);

  useEffect(() => {
    if (borrador && borradorLeido.current) guardarAudioBorrador(borrador, g.audio);
    if (!g.audio) setRecuperado(false);
    onCambio(g.audio);
    if (!g.audio) { setUrl(null); return; }
    const u = URL.createObjectURL(g.audio.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
    // onCambio cambia en cada render del padre: solo importa cuando cambia el audio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.audio]);

  if (!puedeGrabar()) return <p className="text-sm text-salvia">Este navegador no deja grabar audio.</p>;

  if (g.estado === 'grabando') {
    return (
      <button type="button" onClick={g.detener} className="flex items-center gap-3 rounded-2xl border-2 border-alerta bg-durazno/25 p-3 text-left w-full" aria-label="Terminar de grabar">
        <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-4 h-4 rounded-full bg-alerta shrink-0 ml-1" />
        <span className="flex-1 font-bold text-coral">Grabando… {duracionTxt(g.segundos)} <span className="text-sm font-semibold text-salvia">/ {duracionTxt(g.maxSegundos)}</span></span>
        <span className="badge bg-alerta text-white py-1.5 px-3 text-sm"><IconoParar className="w-4 h-4" /> Parar</span>
      </button>
    );
  }

  if (g.audio && url) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-esmeralda bg-seleccion p-3">
        {recuperado && <p className="text-sm font-bold text-bosque">Recuperé la nota de voz que habías grabado</p>}
        <Reproductor src={url} segundos={g.audio.segundos} />
        <div className="flex items-center gap-4 text-sm font-bold">
          <button type="button" onClick={() => { g.descartar(); g.grabar(); }} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoMicro className="w-4 h-4" /> Grabar otra vez</button>
          <button type="button" onClick={g.descartar} className="text-coral ml-auto min-h-11 px-2 -mr-2">Quitar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={g.grabar} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-menta bg-tarjeta p-3 text-left w-full">
        <span className="w-11 h-11 shrink-0 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoMicro className="w-5 h-5" /></span>
        <span className="flex-1">
          <span className="block font-bold text-bosque">{etiqueta}</span>
          <span className="block text-sm text-salvia">Hasta {duracionTxt(maxSegundos)} min</span>
        </span>
      </button>
      {g.error && <p role="alert" className="text-sm text-coral font-bold">{g.error}</p>}
    </div>
  );
}

/* Reproductor sencillo: play/pausa, barra y tiempo. Con `ruta` carga el audio del bucket "adjuntos".
   Sin `segundos` (cartas, cápsulas) se descarga el audio para medir cuánto dura de verdad:
   la duración que trae el archivo grabado en el navegador suele estar mal. */
export function NotaDeVoz({ ruta, segundos, className = '' }: { ruta: string; segundos?: number | null; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [medida, setMedida] = useState<number | undefined>(segundos ?? undefined);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    let vivo = true;
    let local: string | null = null;
    (async () => {
      const u = await urlAdjunto(ruta);
      if (!vivo) return;
      if (!u) { setFalla(true); return; }
      if (segundos) { setSrc(u); return; }
      try {
        const blob = await fetch(u).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
        const d = await duracionDe(blob);
        if (!vivo) return;
        local = URL.createObjectURL(blob);
        if (d) setMedida(d);
        setSrc(local);
      } catch {
        if (vivo) setSrc(u);
      }
    })();
    return () => { vivo = false; if (local) URL.revokeObjectURL(local); };
  }, [ruta, segundos]);
  if (falla) return <p className={`text-sm text-salvia ${className}`}>No pude cargar la nota de voz.</p>;
  if (!src) return <div className={`h-11 rounded-full bg-seleccion animate-pulse ${className}`} />;
  return <Reproductor src={src} segundos={medida} className={className} />;
}

export function Reproductor({ src, segundos, className = '' }: { src: string; segundos?: number; className?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [actual, setActual] = useState(0);
  const [total, setTotal] = useState(segundos ?? 0);
  const midiendo = useRef(false);

  // Los WebM grabados en el navegador dicen durar "Infinity": saltar al final obliga a calcular la real.
  // Si ya se sabe la duración real (medida al grabar o al decodificar), la del archivo no se usa.
  const leerDuracion = (a: HTMLAudioElement) => {
    if (segundos) return;
    const d = a.duration;
    if (d === Infinity) {
      if (!midiendo.current) { midiendo.current = true; a.currentTime = 1e101; }
      return;
    }
    if (midiendo.current) { midiendo.current = false; a.currentTime = 0; setActual(0); }
    if (Number.isFinite(d) && d > 0) setTotal(d);
  };

  const alternar = () => {
    const a = ref.current;
    if (!a || midiendo.current) return;
    if (a.paused) a.play().catch(() => setSonando(false));
    else a.pause();
  };

  return (
    <div className={`flex items-center gap-3 rounded-full bg-tarjeta border border-menta pl-1.5 pr-4 py-1.5 ${className}`}>
      <audio ref={ref} src={src} preload="metadata"
        onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => { setSonando(false); setActual(0); }}
        onTimeUpdate={(e) => { if (!midiendo.current) setActual(e.currentTarget.currentTime); }}
        onLoadedMetadata={(e) => leerDuracion(e.currentTarget)}
        onDurationChange={(e) => leerDuracion(e.currentTarget)} />
      <button type="button" onClick={alternar} aria-label={sonando ? 'Pausar' : 'Escuchar'}
        className="w-11 h-11 shrink-0 rounded-full bg-hondo text-white flex items-center justify-center">
        {sonando ? <IconoPausa className="w-5 h-5" /> : <IconoPlay className="w-5 h-5" />}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-menta overflow-hidden">
        <div className="h-full bg-esmeralda transition-[width] duration-200" style={{ width: total ? `${Math.min(100, (actual / total) * 100)}%` : '0%' }} />
      </div>
      <span className="text-sm font-bold text-salvia tabular-nums">{duracionTxt(sonando || actual ? actual : total)}</span>
    </div>
  );
}
