// El libro de nosotros: un PDF de 20 × 20 cm para mandar a imprimir como fotolibro, armado en el
// celular con los recuerdos, las mejores preguntas del día, las cartas abiertas (si quieren), la
// música y los lugares de un rango. Antes de armarlo se escogen a mano las preguntas que entran (vienen
// marcadas las sugeridas). No escribe en la base. Se llega desde Historia y desde el Resumen.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import { entregarArchivo } from '../lib/copia';
import { imagenDeSvg } from '../lib/pelicula';
import { planDelLibro, preguntasSugeridas, traerDatos, type DatosLibro, type ParPregunta, type Rango } from '../lib/libro/datos';
import { armarLibro, CM } from '../lib/libro/paginas';
import { pdfDeImagenes } from '../lib/libro/pdf';
import { MascotaPrimaria, Mar, Olas } from '../components/mascotas/MascotaDinamica';
import { Encabezado, IconoAtras, IconoDescarga } from '../components/ui';

type Eleccion = 'todo' | string; // string = un año
type Hecho = { pdf: Blob; paginas: number; vistas: string[]; nombre: string };

const VISTAS = 6;

export default function Libro() {
  const { perfil } = useAuth();
  const { aviso } = useAvisos();
  const [params] = useSearchParams();
  const [anios, setAnios] = useState<string[]>([]);
  const [eleccion, setEleccion] = useState<Eleccion>(() => params.get('anio') ?? 'todo');
  const [conPreguntas, setConPreguntas] = useState(true);
  const [conCartas, setConCartas] = useState(false);
  const [armando, setArmando] = useState<{ hechas: number; total: number } | null>(null);
  const [hecho, setHecho] = useState<Hecho | null>(null);
  // Paso de escoger preguntas: los datos ya traídos y las fechas de las preguntas marcadas
  const [escogiendo, setEscogiendo] = useState<{ datos: DatosLibro; elegidas: Set<string> } | null>(null);
  const mascota = useRef<HTMLDivElement>(null);
  // Si cambian el rango o las opciones, la lista de preguntas ya no sirve
  useEffect(() => { setEscogiendo(null); }, [eleccion, conPreguntas, conCartas]);

  useEffect(() => {
    supabase.from('recuerdos').select('fecha').then(({ data }) => setAnios([...new Set((data ?? []).map((r) => r.fecha.slice(0, 4)))].sort().reverse()));
  }, []);
  // Las vistas previas se sueltan al salir o al armar otro
  useEffect(() => () => hecho?.vistas.forEach((u) => URL.revokeObjectURL(u)), [hecho]);

  const rango = (): Rango => (eleccion === 'todo'
    ? { desde: null, hasta: null, etiqueta: 'toda nuestra historia' }
    : { desde: `${eleccion}-01-01`, hasta: `${eleccion}-12-31`, etiqueta: eleccion });

  // Primer paso: traer lo del rango; si van preguntas, se muestran para escogerlas antes de armar
  const preparar = async () => {
    if (!perfil) return;
    setHecho(null);
    setArmando({ hechas: 0, total: 0 });
    let datos: DatosLibro | null = null;
    try {
      datos = await traerDatos(rango(), perfil.id);
    } catch (e) {
      console.error(e);
    }
    setArmando(null);
    if (!datos) { aviso('No encontré recuerdos ni preguntas en ese tiempo 😢 Prueba con otro.', 'error'); return; }
    if (conPreguntas && datos.preguntas.length) setEscogiendo({ datos, elegidas: preguntasSugeridas(datos.preguntas) });
    else crear(datos);
  };

  const crear = async (datos: DatosLibro, elegidas?: Set<string>) => {
    setHecho(null);
    setArmando({ hechas: 0, total: 0 });
    try {
      const plan = planDelLibro(datos, { preguntas: conPreguntas, cartas: conCartas, elegidas });
      const svgs = [...(mascota.current?.querySelectorAll('svg') ?? [])];
      const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
      const ballena = await imagenDeSvg(svgs.sort((x, y) => area(y) - area(x))[0] ?? null);
      const paginas = await armarLibro(datos, plan, ballena, (hechas, total) => setArmando({ hechas, total }));
      const pdf = new Blob([pdfDeImagenes(paginas, CM, CM) as BlobPart], { type: 'application/pdf' });
      const vistas = paginas.slice(0, VISTAS).map((p) => URL.createObjectURL(new Blob([p.jpeg as BlobPart], { type: 'image/jpeg' })));
      setHecho({ pdf, paginas: paginas.length, vistas, nombre: `nuestro-libro-${eleccion === 'todo' ? 'completo' : eleccion}.pdf` });
    } catch (e) {
      console.error(e);
      aviso('No pude armar el libro 😢 Si son muchas fotos, prueba con un solo año.', 'error');
    } finally {
      setArmando(null);
    }
  };

  const descargar = async () => {
    if (!hecho) return;
    const r = await entregarArchivo(hecho.pdf, hecho.nombre, 'application/pdf');
    if (r === 'descargado') aviso('Libro descargado 📖');
  };

  const opciones: [Eleccion, string][] = [['todo', 'Toda la historia'], ...anios.map((a) => [a, a] as [string, string])];
  const mb = hecho ? (hecho.pdf.size / 1_048_576).toFixed(hecho.pdf.size > 10_485_760 ? 0 : 1) : '';

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/historia" className="btn-icon" aria-label="Volver a nuestra historia"><IconoAtras /></Link>
      <Encabezado eyebrow="Para tenerlo en las manos" titulo="El libro de nosotros" />

      <Mar className="h-[200px] p-0">
        <div ref={mascota} className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-[64%]">
          <MascotaPrimaria className="w-full" />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-5" color="#CFE9E4" opacidad={0.14} />
        <p className="absolute left-5 top-4 right-5 text-white text-sm font-bold opacity-90">Un libro con sus fotos, lo que se han dicho y lo que han vivido, listo para imprimir.</p>
      </Mar>

      <section className="card flex flex-col gap-3" aria-label="Qué va en el libro">
        <p className="font-titulo text-xl font-semibold">¿De cuándo?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rango de fechas">
          {opciones.map(([k, l]) => (
            <button key={k} onClick={() => setEleccion(k)} data-active={eleccion === k} aria-pressed={eleccion === k} className="chip text-sm">{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-3 min-h-11 cursor-pointer">
          <input type="checkbox" checked={conPreguntas} onChange={(e) => setConPreguntas(e.target.checked)} className="w-5 h-5 accent-[var(--color-hondo)]" />
          <span className="text-sm font-bold">Las mejores preguntas del día <span className="text-salvia font-semibold">(hasta 3 por mes, primero las que tienen corazón)</span></span>
        </label>
        <label className="flex items-center gap-3 min-h-11 cursor-pointer">
          <input type="checkbox" checked={conCartas} onChange={(e) => setConCartas(e.target.checked)} className="w-5 h-5 accent-[var(--color-hondo)]" />
          <span className="text-sm font-bold">Las cartas que ya abrieron <span className="text-salvia font-semibold">(son íntimas: inclúyanlas solo si los dos quieren)</span></span>
        </label>
        {!escogiendo && (
          <button onClick={preparar} disabled={!!armando} className="btn-primary">
            {armando ? (armando.total ? `Armando la página ${armando.hechas} de ${armando.total}…` : 'Buscando recuerdos…') : conPreguntas ? 'Siguiente: escoger las preguntas' : 'Armar el libro'}
          </button>
        )}
        {!escogiendo && armando && armando.total > 0 && (
          <div className="h-1.5 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={armando.total} aria-valuenow={armando.hechas} aria-label="Armando el libro">
            <div className="h-full bg-esmeralda rounded-full transition-[width] duration-300" style={{ width: `${(armando.hechas / armando.total) * 100}%` }} />
          </div>
        )}
      </section>

      {escogiendo && (
        <EscogerPreguntas
          preguntas={escogiendo.datos.preguntas}
          elegidas={escogiendo.elegidas}
          onCambio={(elegidas) => setEscogiendo({ ...escogiendo, elegidas })}
          armando={armando}
          onArmar={() => crear(escogiendo.datos, escogiendo.elegidas)}
        />
      )}

      {hecho && (
        <section className="card flex flex-col gap-3" aria-label="El libro listo">
          <p className="font-titulo text-xl font-semibold">¡Listo! {hecho.paginas} páginas</p>
          <div className="grid grid-cols-3 gap-2">
            {hecho.vistas.map((u, i) => <img key={u} src={u} alt={`Página ${i + 1}`} className="w-full aspect-square rounded-lg shadow-sm object-cover" />)}
          </div>
          {hecho.paginas > VISTAS && <p className="text-sm text-salvia text-center">y {hecho.paginas - VISTAS} páginas más</p>}
          <button onClick={descargar} className="btn-primary"><IconoDescarga className="w-5 h-5" /> Guardar el PDF ({mb} MB)</button>
          <div className="text-sm text-salvia flex flex-col gap-1">
            <p><span className="font-bold text-bosque-oscuro">Para imprimirlo:</span> pídelo como fotolibro cuadrado de {CM} × {CM} cm, idealmente en tapa dura. Las imprentas piden un número par de páginas; si sobra una, la dejan en blanco.</p>
            <p>Cada uno ve lo suyo: el libro trae lo que tú puedes ver en la app.</p>
          </div>
        </section>
      )}
    </div>
  );
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

// Todas las preguntas que respondieron los dos en el rango, por mes, con sus respuestas a la vista
// para decidir cuáles van a papel. Vienen marcadas las sugeridas (hasta 3 por mes, primero con corazón).
function EscogerPreguntas({ preguntas, elegidas, onCambio, armando, onArmar }: {
  preguntas: ParPregunta[]; elegidas: Set<string>; onCambio: (e: Set<string>) => void;
  armando: { hechas: number; total: number } | null; onArmar: () => void;
}) {
  const [sugeridas] = useState(elegidas);
  const meses = [...new Set(preguntas.map((p) => p.fecha.slice(0, 7)))].sort();
  const alternar = (fecha: string) => {
    const e = new Set(elegidas);
    if (e.has(fecha)) e.delete(fecha); else e.add(fecha);
    onCambio(e);
  };
  return (
    <section className="card flex flex-col gap-3" aria-label="Escoger las preguntas">
      <div>
        <p className="font-titulo text-xl font-semibold">¿Qué preguntas van?</p>
        <p className="text-sm text-salvia mt-1">Marqué las mejores de cada mes. Quita las que sean solo de ustedes: el libro lo van a ver en la imprenta.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onCambio(new Set(sugeridas))} className="chip text-sm">Las sugeridas</button>
        <button onClick={() => onCambio(new Set())} className="chip text-sm">Ninguna</button>
      </div>
      {meses.map((mes) => (
        <div key={mes} className="flex flex-col gap-2">
          <p className="eyebrow mt-1">{nombreMes(mes)}</p>
          {preguntas.filter((p) => p.fecha.startsWith(mes)).map((p) => {
            const marcada = elegidas.has(p.fecha);
            return (
              <label key={p.fecha} className={`flex gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${marcada ? 'border-esmeralda bg-seleccion' : 'border-menta'}`}>
                <input type="checkbox" checked={marcada} onChange={() => alternar(p.fecha)} className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--color-hondo)]" />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold leading-snug">{p.pregunta}{p.corazones > 0 && <span className="text-coral" aria-label={`${p.corazones} corazones`}> ♥</span>}</span>
                  {p.respuestas.map((r) => (
                    <span key={r.quien} className="block text-sm mt-1 whitespace-pre-wrap"><span className="font-bold text-salvia">{r.quien}: </span>{r.texto}</span>
                  ))}
                </span>
              </label>
            );
          })}
        </div>
      ))}
      <div className="sticky bottom-24 pt-2 flex flex-col gap-2 bg-tarjeta">
        <button onClick={onArmar} disabled={!!armando} className="btn-primary">
          {armando ? (armando.total ? `Armando la página ${armando.hechas} de ${armando.total}…` : 'Preparando…') : `Armar el libro con ${elegidas.size === 1 ? '1 pregunta' : `${elegidas.size} preguntas`}`}
        </button>
        {armando && armando.total > 0 && (
          <div className="h-1.5 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={armando.total} aria-valuenow={armando.hechas} aria-label="Armando el libro">
            <div className="h-full bg-esmeralda rounded-full transition-[width] duration-300" style={{ width: `${(armando.hechas / armando.total) * 100}%` }} />
          </div>
        )}
      </div>
    </section>
  );
}
