// Música de "Nuestra película", compuesta en el momento con Web Audio (nada de archivos ni derechos):
// acordes suaves, un arpegio que va y viene, el rumor de las olas y, al empezar, el canto de una ballena.
// Todo se agenda de una vez sobre el reloj del AudioContext, que también es el reloj de la película.

// Re mayor, tranquilo: Dmaj9 – Bm7 – Gmaj7 – A6sus (frecuencias en Hz)
const ACORDES = [
  [146.83, 220.0, 277.18, 329.63, 369.99],
  [123.47, 185.0, 220.0, 293.66, 369.99],
  [98.0, 196.0, 246.94, 293.66, 369.99],
  [110.0, 164.81, 246.94, 293.66, 329.63],
];
const PULSO = 60 / 70; // 70 pulsos por minuto
const COMPAS = PULSO * 4;

function azar(semilla: number) {
  return () => {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Una sala grande: ruido que se apaga en 3,5 segundos
function reverberacion(ac: BaseAudioContext) {
  const largo = Math.floor(ac.sampleRate * 3.5);
  const buf = ac.createBuffer(2, largo, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2.6);
  }
  const conv = ac.createConvolver();
  conv.buffer = buf;
  return conv;
}

function nota(ac: AudioContext, salida: AudioNode, frec: number, inicio: number, dur: number, vol: number, tipo: OscillatorType, ataque: number, detune = 0) {
  const osc = ac.createOscillator();
  osc.type = tipo;
  osc.frequency.value = frec;
  osc.detune.value = detune;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, inicio);
  g.gain.linearRampToValueAtTime(vol, inicio + ataque);
  g.gain.setTargetAtTime(0, inicio + dur, dur * 0.35 + 0.2);
  osc.connect(g).connect(salida);
  osc.start(inicio);
  osc.stop(inicio + dur * 2.5 + 1.5);
}

/** Agenda la música desde `inicio` (tiempo del AudioContext) durante `duracion` segundos. Devuelve el nodo final. */
export function musicaDelMar(ac: AudioContext, destinos: AudioNode[], inicio: number, duracion: number) {
  const rnd = azar(2026);
  const fin = inicio + duracion;

  const master = ac.createGain();
  master.gain.setValueAtTime(0, inicio);
  master.gain.linearRampToValueAtTime(0.9, inicio + 2.5);
  master.gain.setValueAtTime(0.9, Math.max(inicio + 2.5, fin - 3.5));
  master.gain.linearRampToValueAtTime(0, fin);
  destinos.forEach((d) => master.connect(d));

  // Compresor suave para que nada reviente en los parlantes del celular
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  comp.connect(master);

  const sala = reverberacion(ac);
  const humedo = ac.createGain(); humedo.gain.value = 0.55;
  sala.connect(humedo).connect(comp);
  const seco = ac.createGain(); seco.gain.value = 0.7;
  seco.connect(comp);

  // Los acordes, filtrados para que suenen lejanos, como bajo el agua
  const filtroPad = ac.createBiquadFilter();
  filtroPad.type = 'lowpass'; filtroPad.frequency.value = 900; filtroPad.Q.value = 0.4;
  filtroPad.connect(seco); filtroPad.connect(sala);

  const arpegio = ac.createGain(); arpegio.gain.value = 1;
  arpegio.connect(sala); arpegio.connect(seco);

  let compas = 0;
  for (let t = inicio; t < fin; t += COMPAS, compas++) {
    const acorde = ACORDES[compas % ACORDES.length];
    for (const f of acorde.slice(0, 4)) {
      nota(ac, filtroPad, f, t, COMPAS * 0.95, 0.035, 'triangle', 1.4, -6);
      nota(ac, filtroPad, f, t, COMPAS * 0.95, 0.03, 'sine', 1.6, 7);
    }
    // El arpegio entra después de la presentación y descansa uno de cada cuatro compases
    if (t - inicio < COMPAS * 2 || compas % 4 === 3) continue;
    const agudas = acorde.slice(1).map((f) => f * 2);
    for (let i = 0; i < 8; i++) {
      if (rnd() < 0.28) continue;
      const f = agudas[Math.floor(rnd() * agudas.length)] * (rnd() < 0.15 ? 2 : 1);
      nota(ac, arpegio, f, t + i * (PULSO / 2), PULSO * 0.9, 0.022 + rnd() * 0.012, 'sine', 0.02);
    }
  }

  // Las olas: ruido filtrado que sube y baja despacio
  const ruido = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const r = ruido.getChannelData(0);
  for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
  const fuente = ac.createBufferSource();
  fuente.buffer = ruido; fuente.loop = true;
  const filtroOla = ac.createBiquadFilter();
  filtroOla.type = 'lowpass'; filtroOla.frequency.value = 420;
  const ola = ac.createGain(); ola.gain.value = 0.035;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
  const lfoG = ac.createGain(); lfoG.gain.value = 0.025;
  lfo.connect(lfoG).connect(ola.gain);
  fuente.connect(filtroOla).connect(ola).connect(comp);
  fuente.start(inicio); lfo.start(inicio);
  fuente.stop(fin + 1); lfo.stop(fin + 1);

  // El canto de la ballena, al empezar: un sonido que baja, tiembla y se pierde en la sala
  const canto = (t: number, desde: number, hasta: number, dur: number) => {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(desde, t);
    o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    const vib = ac.createOscillator(); vib.frequency.value = 5.5;
    const vibG = ac.createGain(); vibG.gain.value = 6;
    vib.connect(vibG).connect(o.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(sala);
    o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  };
  canto(inicio + 0.8, 420, 240, 2.4);
  canto(inicio + 3.6, 300, 380, 1.8);
  // Y otra vez al final, como despedida
  if (duracion > 20) canto(fin - 4.5, 360, 210, 2.8);

  return master;
}
