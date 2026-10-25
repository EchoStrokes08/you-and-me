// Comprime videos en el celular antes de subirlos: 720p y ~2 Mbps (un video de 30 s pasa de ~35 MB a ~8 MB).
// Usa el codificador del propio celular (WebCodecs) con mediabunny, que se carga solo cuando hay un video.
// Si el navegador no puede (o el resultado no sale más liviano), se sube el original.

const LADO_MAX = 1280;
const BITRATE = 2_000_000;
// Por debajo de esto no vale la pena esperar a comprimir
const MIN_MB = 8;

export const puedeComprimirVideo = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window;

export async function comprimirVideo(file: File, onProgreso?: (p: number) => void): Promise<Blob> {
  if (!puedeComprimirVideo() || file.size < MIN_MB * 1024 * 1024) return file;
  try {
    const mb = await import('mediabunny');
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const pista = await input.getPrimaryVideoTrack();
    if (!pista) return file;
    const horizontal = pista.displayWidth >= pista.displayHeight;
    const lado = horizontal ? pista.displayWidth : pista.displayHeight;
    const tam = lado > LADO_MAX ? (horizontal ? { width: LADO_MAX } : { height: LADO_MAX }) : {};
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
    const conversion = await mb.Conversion.init({
      input, output, showWarnings: false,
      video: { ...tam, codec: 'avc', quality: new mb.Quality({ bitrate: BITRATE }), forceTranscode: true },
      // El audio de los celulares ya es AAC liviano: se copia tal cual si se puede
    });
    // Sin pista de video en la salida (no la pudo decodificar o codificar) no sirve
    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.isVideoTrack())) return file;
    if (onProgreso) conversion.onProgress = (p) => onProgreso(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength >= file.size) return file;
    return new Blob([buffer], { type: 'video/mp4' });
  } catch (e) {
    console.warn('No pude comprimir el video, va el original', e);
    return file;
  }
}
