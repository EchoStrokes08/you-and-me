// Un solo reloj para lo que se anima con JavaScript en el fondo (el pulpo y su caminata).
// Pide un cuadro cada 1/FPS s en vez de en cada refresco de pantalla: cada cuadro pedido obliga
// al navegador a recalcular todo lo que se anima en la página, así que pedir 60–120 por segundo
// (aunque luego no se pinte nada) tenía el teléfono ocupado todo el tiempo.

const FPS = 15;
const PASO_MS = 1000 / FPS;

type Tic = (ahora: number) => void;
const suscritos = new Set<Tic>();
let temporizador: number | undefined;
let cuadro = 0;
let ultimo = 0;

function programar() {
  if (temporizador !== undefined || cuadro || !suscritos.size) return;
  const espera = Math.max(0, PASO_MS - (performance.now() - ultimo));
  temporizador = window.setTimeout(() => {
    temporizador = undefined;
    cuadro = requestAnimationFrame((ahora) => {
      cuadro = 0;
      ultimo = ahora;
      for (const tic of [...suscritos]) tic(ahora);
      programar();
    });
  }, espera);
}

/** Llama a `tic` unas FPS veces por segundo, todos en el mismo cuadro. Devuelve con qué dejar de escuchar. */
export function alCompas(tic: Tic): () => void {
  suscritos.add(tic);
  programar();
  return () => {
    suscritos.delete(tic);
    if (suscritos.size) return;
    window.clearTimeout(temporizador);
    cancelAnimationFrame(cuadro);
    temporizador = undefined;
    cuadro = 0;
  };
}
