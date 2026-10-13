import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { urlsFirmadas } from '../lib/fotos';
import { fechaBonita, fechaStr, nombreLugar } from '../lib/utils';
import { MascotaPrimaria, Acompanantes, Mar } from '../components/MascotaDinamica';
import { Cargando, Corazon, Hoja, IconoAtras, IconoDescarga, IconoDestello, IconoFlecha, Vacio, IconoFuego, IconoPin } from '../components/ui';
import { crearTarjetaResumen } from '../lib/tarjetaResumen';
import { useAvisos } from '../lib/avisos';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Racha más larga de días seguidos en una lista de fechas 'YYYY-MM-DD'
function rachaMasLarga(fechas: string[]) {
  const dias = [...new Set(fechas)].sort().map((f) => new Date(f + 'T12:00:00').getTime() / 86400000);
  let mejor = 0, actual = 0;
  dias.forEach((d, i) => { actual = i > 0 && Math.round(d - dias[i - 1]) === 1 ? actual + 1 : 1; mejor = Math.max(mejor, actual); });
  return mejor;
}

const masFrecuente = <T,>(lista: T[]) => {
  const conteo = new Map<T, number>();
  for (const x of lista) conteo.set(x, (conteo.get(x) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
};

export default function Resumen() {
  const { perfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const [hoyResumen] = useState(() => new Date());
  const anioActual = hoyResumen.getFullYear();
  const anio = Number(params.get('anio')) || anioActual;
  const [datos, setDatos] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const { aviso } = useAvisos();
  // La imagen del resumen, ya dibujada, lista para compartir o guardar
  const [tarjeta, setTarjeta] = useState<{ archivo: File; url: string } | null>(null);
  const [dibujando, setDibujando] = useState(false);

  useEffect(() => { supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data)); }, []);

  useEffect(() => {
    if (!perfil) return;
    setDatos(null);
    const desde = `${anio}-01-01`, hasta = `${anio}-12-31`;
    const desdeTs = new Date(anio, 0, 1).toISOString(), hastaTs = new Date(anio + 1, 0, 1).toISOString();
    (async () => {
      const [citas, todasVividas, recuerdos, preguntas, respuestas, pensamientos, canciones, suenos, cartasMias, cartasRecibidas, animos] = await Promise.all([
        supabase.from('citas').select('fecha, lugar_id, lugar_personalizado, lugares(nombre, emoji), actividades(nombre)').eq('estado', 'vivida').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('citas').select('fecha, lugar_id, lugar_personalizado, lugares(nombre)').eq('estado', 'vivida').lt('fecha', desde),
        supabase.from('recuerdos').select('id, titulo, fecha, calificacion, lugar_texto, fotos_recuerdo(ruta, orden, tipo)').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('pregunta_del_dia').select('fecha, pregunta_id').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('respuestas').select('pregunta_id, usuario_id'),
        supabase.from('pensamientos').select('de').gte('created_at', desdeTs).lt('created_at', hastaTs),
        supabase.from('canciones').select('titulo, artista, created_at').gte('created_at', desdeTs).lt('created_at', hastaTs).order('created_at'),
        supabase.from('suenos').select('titulo, emoji, cumplido_en').gte('cumplido_en', desde).lte('cumplido_en', hasta),
        supabase.from('cartas').select('id').gte('created_at', desdeTs).lt('created_at', hastaTs),
        supabase.rpc('cartas_recibidas'),
        supabase.from('estados_animo').select('usuario_id, emoji, etiqueta').gte('fecha', desde).lte('fecha', hasta),
      ]);

      const vividas = (citas.data ?? []) as any[];
      const lugarDe = (c: any) => nombreLugar(c);
      const antes = new Set(((todasVividas.data ?? []) as any[]).map(lugarDe).filter(Boolean));
      const lugares = [...new Set(vividas.map(lugarDe).filter(Boolean))] as string[];
      const nuevos = lugares.filter((l) => !antes.has(l));
      const lugarEstrella = masFrecuente(vividas.map(lugarDe).filter(Boolean));
      const mesEstrella = masFrecuente(vividas.map((c) => Number(c.fecha.slice(5, 7)) - 1));

      // Días en que los dos respondieron (solo se ven las del otro si una respondió: cuentan igual)
      const porPregunta = new Map<string, Set<string>>();
      for (const r of (respuestas.data ?? []) as any[]) (porPregunta.get(r.pregunta_id) ?? porPregunta.set(r.pregunta_id, new Set()).get(r.pregunta_id)!).add(r.usuario_id);
      const diasJuntos = ((preguntas.data ?? []) as any[]).filter((p) => (porPregunta.get(p.pregunta_id)?.size ?? 0) >= 2).map((p) => p.fecha);

      const recs = (recuerdos.data ?? []) as any[];
      const fotos = recs.reduce((n, r) => n + (r.fotos_recuerdo?.length ?? 0), 0);
      const top = [...recs].sort((a, b) => b.calificacion - a.calificacion || (b.fotos_recuerdo?.length ?? 0) - (a.fotos_recuerdo?.length ?? 0))[0] ?? null;
      const rutaTop = top?.fotos_recuerdo?.filter((f: any) => f.tipo !== 'video').sort((a: any, b: any) => a.orden - b.orden)[0]?.ruta;
      const fotoTop = rutaTop ? (await urlsFirmadas([rutaTop]))[rutaTop] : null;

      const pens = (pensamientos.data ?? []) as any[];
      const an = (animos.data ?? []) as any[];
      const animoDe = (mio: boolean) => masFrecuente(an.filter((a) => (a.usuario_id === perfil.id) === mio).map((a) => `${a.emoji} ${a.etiqueta}`))?.[0] ?? null;
      const recibidas = ((cartasRecibidas.data ?? []) as any[]).filter((c) => new Date(c.created_at).getFullYear() === anio);

      setDatos({
        citas: vividas.length, lugares, nuevos, lugarEstrella, mesEstrella,
        recuerdos: recs.length, fotos, top, fotoTop,
        diasPreguntas: diasJuntos.length, racha: rachaMasLarga(diasJuntos),
        pensamientos: { mios: pens.filter((p) => p.de === perfil.id).length, suyos: pens.filter((p) => p.de !== perfil.id).length },
        canciones: (canciones.data ?? []) as any[],
        suenos: (suenos.data ?? []) as any[],
        cartas: { escritas: cartasMias.data?.length ?? 0, recibidas: recibidas.length },
        animo: { mio: animoDe(true), suyo: animoDe(false) },
      });
    })();
  }, [anio, perfil]);

  const anios = useMemo(() => {
    const inicio = config?.fecha_inicio ? Number(config.fecha_inicio.slice(0, 4)) : anioActual;
    return Array.from({ length: anioActual - inicio + 1 }, (_, i) => anioActual - i);
  }, [config, anioActual]);

  const pareja = (perfil?.rol === 'admin' ? config?.nombre_ella : config?.nombre_el) ?? 'tu amor';
  const vacio = datos && !datos.citas && !datos.recuerdos && !datos.diasPreguntas && !datos.pensamientos.mios && !datos.pensamientos.suyos;
  const enCurso = anio === anioActual;

  // Primero se dibuja y se muestra; compartir va en un segundo toque (el celular lo exige recién tocado)
  const crearTarjeta = async () => {
    if (!datos || dibujando) return;
    setDibujando(true);
    try {
      const pens = datos.pensamientos.mios + datos.pensamientos.suyos;
      const blob = await crearTarjetaResumen({
        anio, enCurso,
        cifras: [
          { n: datos.citas, txt: datos.citas === 1 ? 'cita vivida' : 'citas vividas' },
          { n: datos.lugares.length, txt: datos.lugares.length === 1 ? 'lugar' : 'lugares' },
          { n: datos.recuerdos, txt: datos.recuerdos === 1 ? 'recuerdo guardado' : 'recuerdos guardados' },
          { n: datos.fotos, txt: datos.fotos === 1 ? 'foto' : 'fotos' },
          { n: datos.diasPreguntas, txt: datos.diasPreguntas === 1 ? 'pregunta respondida por los dos' : 'preguntas respondidas por los dos' },
          { n: pens, txt: pens === 1 ? '"pienso en ti"' : 'veces "pienso en ti"' },
          { n: datos.suenos.length, txt: datos.suenos.length === 1 ? 'plan cumplido' : 'planes cumplidos' },
        ],
        recuerdo: datos.top ? { titulo: datos.top.titulo, foto: datos.fotoTop } : null,
      });
      setTarjeta({ archivo: new File([blob], `nuestro-${anio}.png`, { type: 'image/png' }), url: URL.createObjectURL(blob) });
    } catch {
      aviso('No pude crear la imagen 😢 Intenta de nuevo.', 'error');
    }
    setDibujando(false);
  };
  const cerrarTarjeta = () => { if (tarjeta) URL.revokeObjectURL(tarjeta.url); setTarjeta(null); };
  const puedeCompartir = !!tarjeta && typeof navigator.canShare === 'function' && navigator.canShare({ files: [tarjeta.archivo] });
  const compartir = async () => {
    if (!tarjeta) return;
    // Si cierra la hoja de compartir sin escoger nada no es un error
    try { await navigator.share({ files: [tarjeta.archivo], title: `Nuestro ${anio}` }); } catch (e: any) { if (e?.name !== 'AbortError') aviso('No pude compartirla 😢 Prueba guardándola.', 'error'); }
  };

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link to="/historia" className="btn-icon" aria-label="Volver a Historia"><IconoAtras /></Link>
        {anios.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {anios.map((a) => <button key={a} onClick={() => setParams(a === anioActual ? {} : { anio: String(a) }, { replace: true })} data-active={a === anio} className="chip py-1.5 px-3 text-sm shrink-0">{a}</button>)}
          </div>
        )}
      </header>

      <Mar className="min-h-[168px]">
        <h1 className="relative font-titulo text-7xl font-bold leading-none tabular-nums">{anio}</h1>
        <p className="relative font-bold mt-2 max-w-[55%]">{enCurso ? `Lo que llevamos de ${anio}, en resumen` : 'Nuestro año, en resumen'}</p>
        <MascotaPrimaria className="absolute -right-2 bottom-3 w-44" />
        <Acompanantes className="absolute right-8 top-0 w-28" />
      </Mar>

      {!datos ? <Cargando /> : vacio ? (
        <Vacio titulo={`Aún no hay nada de ${anio}`} texto="Cuando vivan citas, guarden recuerdos y respondan preguntas, aquí estará su año." />
      ) : (
        <div className="flex flex-col gap-3">
          <Bloque>
            <Grande n={datos.citas} txt={datos.citas === 1 ? 'cita vivida' : 'citas vividas'} />
            {datos.mesEstrella && <p className="text-sm text-salvia mt-2">El mes con más citas fue <b className="text-bosque">{MESES[datos.mesEstrella[0]]}</b> ({datos.mesEstrella[1]}).</p>}
          </Bloque>

          {datos.lugares.length > 0 && (
            <Bloque>
              <Grande n={datos.lugares.length} txt={datos.lugares.length === 1 ? 'lugar' : 'lugares'} />
              {datos.nuevos.length > 0 && <p className="text-sm text-salvia mt-1">{datos.nuevos.length === datos.lugares.length ? 'Todos nuevos para nosotros' : `${datos.nuevos.length} por primera vez`}</p>}
              {datos.lugarEstrella && datos.lugarEstrella[1] > 1 && <p className="text-sm text-salvia">Volvimos {datos.lugarEstrella[1]} veces a <b className="text-bosque">{datos.lugarEstrella[0]}</b>.</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">{datos.lugares.slice(0, 12).map((l: string) => <span key={l} className="badge bg-seleccion text-bosque border border-menta text-sm"><IconoPin className="w-3.5 h-3.5" /> {l}</span>)}</div>
            </Bloque>
          )}

          {datos.recuerdos > 0 && (
            <Bloque>
              <div className="grid grid-cols-2 gap-3">
                <Grande n={datos.recuerdos} txt={datos.recuerdos === 1 ? 'recuerdo' : 'recuerdos'} />
                <Grande n={datos.fotos} txt={datos.fotos === 1 ? 'foto' : 'fotos'} />
              </div>
              {datos.top && (
                <Link to="/historia" state={{ abrir: datos.top.id }} className="block mt-4 rounded-2xl overflow-hidden border border-menta">
                  {datos.fotoTop && <img src={datos.fotoTop} className="w-full h-44 object-cover" alt="" />}
                  <div className="p-3 bg-seleccion">
                    <p className="text-sm font-bold text-salvia">El recuerdo del año</p>
                    <p className="font-titulo text-lg font-semibold leading-tight">{datos.top.titulo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-salvia first-letter:uppercase">{fechaBonita(datos.top.fecha)}</span>
                      <span className="flex text-esmeralda">{Array.from({ length: datos.top.calificacion }).map((_, i) => <Corazon key={i} className="w-3 h-3" />)}</span>
                    </div>
                  </div>
                </Link>
              )}
            </Bloque>
          )}

          {datos.diasPreguntas > 0 && (
            <Bloque>
              <Grande n={datos.diasPreguntas} txt={datos.diasPreguntas === 1 ? 'pregunta respondida por los dos' : 'preguntas respondidas por los dos'} />
              {datos.racha > 1 && <p className="text-sm text-salvia mt-2 flex items-center gap-1.5"><IconoFuego className="w-4 h-4 text-coral shrink-0" /> La racha más larga: <b className="text-bosque">{datos.racha} días seguidos</b>.</p>}
            </Bloque>
          )}

          {(datos.pensamientos.mios + datos.pensamientos.suyos) > 0 && (
            <Bloque>
              <h2 className="text-xl font-semibold mb-2">Pienso en ti</h2>
              <div className="grid grid-cols-2 gap-3">
                <Grande n={datos.pensamientos.mios} txt="veces le dijiste" />
                <Grande n={datos.pensamientos.suyos} txt={`veces te dijo ${pareja}`} />
              </div>
            </Bloque>
          )}

          {(datos.cartas.escritas + datos.cartas.recibidas) > 0 && (
            <Bloque>
              <h2 className="text-xl font-semibold mb-2">Cartas</h2>
              <div className="grid grid-cols-2 gap-3">
                <Grande n={datos.cartas.escritas} txt="escribiste" />
                <Grande n={datos.cartas.recibidas} txt="recibiste" />
              </div>
            </Bloque>
          )}

          {datos.suenos.length > 0 && (
            <Bloque>
              <Grande n={datos.suenos.length} txt={datos.suenos.length === 1 ? 'plan cumplido' : 'planes cumplidos'} />
              <ul className="mt-2 flex flex-col gap-1">{datos.suenos.map((s: any) => <li key={s.titulo} className="text-sm font-semibold">{s.emoji} {s.titulo}</li>)}</ul>
            </Bloque>
          )}

          {datos.canciones.length > 0 && (
            <Bloque>
              <h2 className="text-xl font-semibold mb-2">La banda sonora del año</h2>
              <ul className="flex flex-col gap-1">{datos.canciones.slice(0, 8).map((c: any) => <li key={c.created_at} className="text-sm"><b>{c.titulo}</b>{c.artista ? <span className="text-salvia"> · {c.artista}</span> : null}</li>)}</ul>
            </Bloque>
          )}

          {(datos.animo.mio || datos.animo.suyo) && (
            <Bloque>
              <h2 className="text-xl font-semibold mb-2">Cómo nos sentimos casi siempre</h2>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-seleccion border border-menta p-3"><p className="font-bold">{datos.animo.mio ?? '—'}</p><p className="text-sm text-salvia">tú</p></div>
                <div className="rounded-2xl bg-crema border border-menta p-3"><p className="font-bold">{datos.animo.suyo ?? '—'}</p><p className="text-sm text-salvia">{pareja}</p></div>
              </div>
            </Bloque>
          )}

          <button onClick={crearTarjeta} disabled={dibujando} className="btn-primary mt-1">
            <IconoDestello className="w-5 h-5" /> {dibujando ? 'Dibujando…' : 'Crear imagen para compartir'}
          </button>

          <p className="text-center text-sm text-salvia mt-2">
            {enCurso ? `Al ${fechaBonita(fechaStr(hoyResumen))}. Lo que falta del año aún está por escribirse.` : 'Gracias por este año juntos.'}
          </p>
        </div>
      )}

      <Hoja abierta={!!tarjeta} onClose={cerrarTarjeta} titulo={`Nuestro ${anio}`}>
        {tarjeta && (
          <>
            <img src={tarjeta.url} alt={`Imagen con el resumen de ${anio}`} className="w-full max-w-[16rem] mx-auto rounded-3xl border border-menta shadow-soft" />
            <div className="flex flex-col gap-2">
              {puedeCompartir && <button onClick={compartir} className="btn-primary">Compartir <IconoFlecha /></button>}
              <a href={tarjeta.url} download={tarjeta.archivo.name} className={puedeCompartir ? 'btn-soft' : 'btn-primary'}><IconoDescarga className="w-5 h-5" /> Guardar en el celular</a>
            </div>
          </>
        )}
      </Hoja>
    </div>
  );
}

function Bloque({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, ease: 'easeOut' }} className="card">
      {children}
    </motion.div>
  );
}

function Grande({ n, txt }: { n: number; txt: string }) {
  return (
    <div>
      <p className="font-titulo text-5xl font-bold text-bosque leading-none tabular-nums">{n}</p>
      <p className="font-semibold text-salvia mt-1 leading-tight">{txt}</p>
    </div>
  );
}
