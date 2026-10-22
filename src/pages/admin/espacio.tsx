import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAvisos } from '../../lib/avisos';
import { olvidarDondeVan, pedirAlServidor } from '../../lib/archivos';

// Lo que permite el plan gratis de Supabase. Si se cambia de plan, se ajusta aquí
const CUPO_ARCHIVOS = 1024 ** 3; // 1 GB
const CUPO_BASE = 500 * 1024 ** 2; // 500 MB
const AVISAR_DESDE = 0.7;

const NOMBRE_CARPETA: Record<string, string> = { recuerdos: 'Fotos y videos', adjuntos: 'Audios y adjuntos' };
const tamano = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

type Uso = {
  base: number; carpetas: { carpeta: string; archivos: number; bytes: number }[]; pesados: { carpeta: string; ruta: string; bytes: number; fecha: string }[];
  externo?: { archivos: number; bytes: number };
};

// Cuánto ocupa la app frente a lo que permite el plan, con aviso cuando se va llenando
export function Espacio() {
  const [uso, setUso] = useState<Uso | null>(null);
  const cargar = useCallback(() => { supabase.rpc('uso_espacio').then(({ data }) => setUso(data as Uso)); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!uso) return null;

  const archivos = uso.carpetas.reduce((t, c) => t + c.bytes, 0);
  const barras = [
    { nombre: 'Archivos (fotos, videos, audios)', usado: archivos, cupo: CUPO_ARCHIVOS },
    { nombre: 'Base de datos (textos)', usado: uso.base, cupo: CUPO_BASE },
  ];
  const peor = Math.max(...barras.map((b) => b.usado / b.cupo));

  return (
    <section className="card p-4 flex flex-col gap-4 mt-4" aria-labelledby="titulo-espacio">
      <p id="titulo-espacio" className="eyebrow">Espacio</p>
      {peor >= AVISAR_DESDE && (
        <div className={`rounded-2xl p-3 text-sm ${peor >= 0.9 ? 'bg-coral/15 text-coral' : 'bg-seleccion text-bosque'}`} role="alert">
          <p className="font-bold">{peor >= 0.9 ? 'Ya casi no queda espacio' : 'El espacio se está llenando'}</p>
          <p>Van en el {Math.round(peor * 100)} % del plan gratis. Cuando llegue al tope, no se podrán subir más fotos, videos ni audios. Se puede pasar a un plan con más espacio o mover los archivos a otro almacenamiento sin perder nada.</p>
        </div>
      )}
      {barras.map((b) => {
        const p = Math.min(1, b.usado / b.cupo);
        return (
          <div key={b.nombre} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-bold">{b.nombre}</span>
              <span className="text-salvia shrink-0">{tamano(b.usado)} de {tamano(b.cupo)}</span>
            </div>
            <div className="h-2 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={`${b.nombre}: ${Math.round(p * 100)} % usado`}>
              <div className={`h-full rounded-full ${p >= 0.9 ? 'bg-coral' : p >= AVISAR_DESDE ? 'bg-durazno' : 'bg-esmeralda'}`} style={{ width: `${Math.max(2, p * 100)}%` }} />
            </div>
          </div>
        );
      })}
      {uso.carpetas.length > 0 && (
        <ul className="text-sm flex flex-col gap-1">
          {uso.carpetas.map((c) => (
            <li key={c.carpeta} className="flex justify-between gap-3">
              <span>{NOMBRE_CARPETA[c.carpeta] ?? c.carpeta} <span className="text-salvia">· {c.archivos} {c.archivos === 1 ? 'archivo' : 'archivos'}</span></span>
              <span className="text-salvia shrink-0">{tamano(c.bytes)}</span>
            </li>
          ))}
        </ul>
      )}
      {uso.pesados.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">Los más pesados</p>
          <ul className="text-sm flex flex-col gap-1">
            {uso.pesados.map((f) => (
              <li key={f.carpeta + f.ruta} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{/\.(mp4|mov|webm|m4v|3gp)$/i.test(f.ruta) ? 'Video' : (NOMBRE_CARPETA[f.carpeta] ?? 'Archivo')} del {new Date(f.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="text-salvia shrink-0">{tamano(f.bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(uso.externo?.archivos ?? 0) > 0 && (
        <p className="text-sm flex justify-between gap-3">
          <span>En el almacenamiento nuevo <span className="text-salvia">· {uso.externo!.archivos} archivos</span></span>
          <span className="text-salvia shrink-0">{tamano(uso.externo!.bytes)}</span>
        </p>
      )}
      <p className="text-xs text-salvia">Los videos nuevos se achican en el celular antes de subir, así que ocupan mucho menos.</p>
      <MoverArchivos onCambio={cargar} />
    </section>
  );
}

type EstadoMigracion = { por_mover: number; por_mover_bytes: number; movidos: number; movidos_bytes: number; por_liberar: number; archivos_en: 'supabase' | 'externo' };
const ERROR_ARCHIVOS: Record<string, string> = {
  sin_almacen: 'Faltan las llaves del almacenamiento en Vercel.',
  sin_servicio: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.',
  sin_permiso: 'Solo el admin puede hacer esto.',
};
const VARIABLES_ALMACEN = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];

// Mover fotos, videos y audios a un almacenamiento compatible con S3 (R2, Firebase/Google Cloud…), en dos pasos:
// primero se copian y se verifican; solo después, y si se pide, se borran de Supabase
function MoverArchivos({ onCambio }: { onCambio: () => void }) {
  const { aviso, confirmar } = useAvisos();
  const [info, setInfo] = useState<{ almacen: boolean; servicio: boolean; estado: EstadoMigracion | null } | null>(null);
  const [falla, setFalla] = useState('');
  const [trabajando, setTrabajando] = useState<null | 'probar' | 'mover' | 'liberar'>(null);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [fallidos, setFallidos] = useState<string[]>([]);

  const consultar = useCallback(async () => {
    try { setInfo(await pedirAlServidor({ accion: 'estado' })); setFalla(''); }
    catch { setFalla('No pude consultar el servidor. Esto solo funciona en la app publicada en Vercel.'); }
  }, []);
  useEffect(() => { consultar(); }, [consultar]);

  const probar = async () => {
    setTrabajando('probar');
    try {
      const r = await pedirAlServidor<{ ok: boolean; cors: boolean; detalle: string }>({ accion: 'probar' });
      if (!r.ok) aviso(r.detalle, 'error');
      else if (!r.cors) aviso('La conexión funciona, pero no pude darle permiso al navegador (CORS). Configúralo en el bucket.', 'error');
      else aviso('La conexión funciona ✓');
    } catch (e) { aviso(ERROR_ARCHIVOS[(e as Error).message] ?? 'La prueba falló', 'error'); }
    setTrabajando(null);
  };

  const mover = async () => {
    const e = info?.estado;
    if (!e) return;
    if (!(await confirmar({ titulo: '¿Mover los archivos?', texto: `Se copian ${e.por_mover} archivos (${tamano(e.por_mover_bytes)}) y desde ya las fotos, videos y audios nuevos se guardan allá. En este paso no se borra nada de Supabase.`, boton: 'Mover' }))) return;
    setTrabajando('mover');
    const total = e.por_mover;
    let hechos = 0;
    const saltar: string[] = [];
    try {
      // Cada llamada mueve lo que alcanza en unos 45 s; se sigue hasta que no quede nada o deje de avanzar
      for (;;) {
        const r = await pedirAlServidor<{ movidos: number; fallidos: string[]; estado: EstadoMigracion }>({ accion: 'migrar', saltar });
        hechos += r.movidos;
        saltar.push(...r.fallidos);
        setAvance({ hechos, total });
        setInfo((i) => (i ? { ...i, estado: r.estado } : i));
        if (r.estado.por_mover - saltar.length <= 0 || (r.movidos === 0 && !r.fallidos.length)) break;
      }
      olvidarDondeVan();
      setFallidos(saltar);
      if (saltar.length) aviso(`Moví ${hechos}; ${saltar.length} no se pudieron mover`, 'error');
      else aviso(`Listo: ${hechos} archivos movidos ✓`);
    } catch (err) { aviso(ERROR_ARCHIVOS[(err as Error).message] ?? 'Se cortó la migración. Puedes seguir donde quedó.', 'error'); }
    setTrabajando(null);
    setAvance(null);
    consultar();
    onCambio();
  };

  const liberar = async () => {
    const e = info?.estado;
    if (!e) return;
    if (!(await confirmar({ titulo: '¿Borrar las copias de Supabase?', texto: `Se borran de Supabase ${e.por_liberar} archivos que ya están en el almacenamiento nuevo. Antes de borrar cada uno reviso que allá esté completo. Después solo quedarán allá y en tus copias de seguridad.`, boton: 'Borrar de Supabase', peligro: true }))) return;
    setTrabajando('liberar');
    try {
      let liberados = 0;
      for (;;) {
        const r = await pedirAlServidor<{ liberados: number; dudosos: string[]; estado: EstadoMigracion }>({ accion: 'liberar' });
        liberados += r.liberados;
        setInfo((i) => (i ? { ...i, estado: r.estado } : i));
        if (r.liberados === 0 || r.estado.por_liberar === 0) {
          if (r.dudosos.length) aviso(`${r.dudosos.length} archivos no los borré porque allá no se ven completos`, 'error');
          break;
        }
      }
      aviso(`Liberé ${liberados} archivos de Supabase ✓`);
    } catch (err) { aviso(ERROR_ARCHIVOS[(err as Error).message] ?? 'Se cortó. Puedes intentarlo otra vez.', 'error'); }
    setTrabajando(null);
    consultar();
    onCambio();
  };

  const e = info?.estado;
  return (
    <div className="flex flex-col gap-3 border-t border-menta pt-4">
      <p className="font-bold">Mover archivos a otro almacenamiento</p>
      {falla && <p className="text-sm text-salvia">{falla}</p>}
      {info && (!info.almacen || !info.servicio) && (
        <div className="text-sm flex flex-col gap-2">
          <p>Para activarlo, crea un bucket en un almacenamiento compatible con S3 (Cloudflare R2 da 10 GB gratis y no cobra por ver las fotos) y pon estas variables en Vercel → Settings → Environment Variables. Luego vuelve a desplegar.</p>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {VARIABLES_ALMACEN.map((v) => <li key={v} className={info.almacen ? 'text-salvia' : 'text-coral'}>{info.almacen ? '✓' : '✗'} {v}</li>)}
            <li className={info.servicio ? 'text-salvia' : 'text-coral'}>{info.servicio ? '✓' : '✗'} SUPABASE_SERVICE_ROLE_KEY</li>
          </ul>
        </div>
      )}
      {info?.almacen && info.servicio && e && (
        <>
          <ul className="text-sm flex flex-col gap-1">
            <li className="flex justify-between gap-3"><span>Por mover</span><span className="text-salvia">{e.por_mover} · {tamano(e.por_mover_bytes)}</span></li>
            <li className="flex justify-between gap-3"><span>Ya movidos</span><span className="text-salvia">{e.movidos} · {tamano(e.movidos_bytes)}</span></li>
            <li className="flex justify-between gap-3"><span>Copias viejas en Supabase</span><span className="text-salvia">{e.por_liberar}</span></li>
            <li className="flex justify-between gap-3"><span>Lo nuevo se guarda en</span><span className="text-salvia">{e.archivos_en === 'externo' ? 'el almacenamiento nuevo' : 'Supabase'}</span></li>
          </ul>
          {avance && avance.total > 0 && (
            <div className="h-2 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={avance.total} aria-valuenow={avance.hechos} aria-label="Archivos movidos">
              <div className="h-full rounded-full bg-esmeralda" style={{ width: `${Math.min(100, (avance.hechos / avance.total) * 100)}%` }} />
            </div>
          )}
          {fallidos.length > 0 && <p className="text-sm text-coral">No se pudieron mover: {fallidos.slice(0, 5).join(', ')}{fallidos.length > 5 ? '…' : ''}</p>}
          <div className="flex flex-col gap-2">
            <button className="btn-soft" disabled={!!trabajando} onClick={probar}>{trabajando === 'probar' ? 'Probando…' : 'Probar la conexión'}</button>
            {e.por_mover > 0 && (
              <button className="btn-primary" disabled={!!trabajando} onClick={mover}>
                {trabajando === 'mover' ? `Moviendo…${avance ? ` ${avance.hechos} de ${avance.total}` : ''}` : `Mover ${e.por_mover} archivos`}
              </button>
            )}
            {e.por_liberar > 0 && (
              <button className="btn-soft text-coral" disabled={!!trabajando} onClick={liberar}>
                {trabajando === 'liberar' ? 'Liberando…' : `Liberar espacio en Supabase (${e.por_liberar})`}
              </button>
            )}
          </div>
          <p className="text-xs text-salvia">Las reglas de quién ve qué (cartas sin abrir, cápsulas cerradas) se siguen cumpliendo igual. El catálogo de lugares se queda en Supabase.</p>
        </>
      )}
    </div>
  );
}
