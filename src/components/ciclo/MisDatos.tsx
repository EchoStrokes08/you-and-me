// "Mis datos" del ciclo: copia de seguridad (cifrada o abierta), huella de la llave, cambiar clave y código de recuperación nuevo.
// La copia sin cifrar queda legible para cualquiera: por eso pide confirmación antes de descargarla.
import { useEffect, useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { abrirCopia, cifrarCopia, fuerzaClave, huella } from '../../lib/ciclo/cripto';
import { olvidarEnEsteCelular, recordadaEnEsteCelular, cambiarClave, codigoNuevo } from '../../lib/ciclo/almacen';
import { useAvisos } from '../../lib/avisos';
import type { Ajustes, Dia } from '../../lib/ciclo/tipos';
import { Hoja } from '../ui';
import { Grupo, Interruptor } from './comunes';
import { descargar } from '../../lib/ciclo/formato';
import { MostrarCodigo } from './Empezar';
import { PoliticaCiclo } from './Politica';

type Copia = { dias: Dia[]; ajustes: Ajustes | null };

export default function MisDatos({ ciclo, uid, nombreAdmin }: { ciclo: Ciclo; uid: string; nombreAdmin: string }) {
  const { aviso, confirmar, pedirTexto } = useAvisos();
  const [miHuella, setMiHuella] = useState('');
  const [recordada, setRecordada] = useState(true);
  const [hoja, setHoja] = useState<null | 'clave' | 'lugar' | 'politica'>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const nube = ciclo.modo === 'nube';

  useEffect(() => { if (ciclo.llaves) huella(ciclo.llaves.publica).then(setMiHuella); }, [ciclo.llaves]);
  useEffect(() => { recordadaEnEsteCelular(uid).then(setRecordada); }, [uid]);

  const alternarRecordar = async (v: boolean) => {
    if (!v) { await olvidarEnEsteCelular(uid); setRecordada(false); aviso('Te la pido la próxima vez que abras Ciclo'); return; }
    aviso('Para recordarla, bloquea y vuelve a entrar con la opción "Recordarla" prendida');
  };

  const nuevoCodigo = async () => {
    const clave = await pedirTexto({ titulo: 'Escribe tu clave del ciclo', texto: 'El código anterior deja de servir.', boton: 'Crear código nuevo', secreto: true });
    if (!clave || !ciclo.fila) return;
    const c = await codigoNuevo(uid, ciclo.fila, clave).catch(() => null);
    if (c) setCodigo(c); else aviso('Esa no es tu clave del ciclo', 'error');
  };

  const exportarClaro = async () => {
    if (!(await confirmar({ titulo: '¿Descargar sin cifrar?', texto: 'El archivo queda legible para cualquiera que lo abra. Sirve para llevar tus datos a otra app; guárdalo con cuidado.', boton: 'Descargar' }))) return;
    const copia: Copia = { dias: [...ciclo.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), ajustes: ciclo.ajustes };
    descargar(JSON.stringify(copia, null, 2), `mi-ciclo-${ciclo.hoy}.json`, 'application/json');
  };

  const exportarCifrado = async () => {
    const clave = await pedirTexto({ titulo: 'Clave para esta copia', texto: 'La vas a necesitar para abrirla. Usa al menos 10 caracteres.', boton: 'Descargar copia', secreto: true });
    if (!clave) return;
    if (fuerzaClave(clave).puntos === 0) { aviso('Esa clave es muy corta o fácil', 'error'); return; }
    const copia = await cifrarCopia({ dias: [...ciclo.dias.values()], ajustes: ciclo.ajustes } satisfies Copia, clave);
    descargar(JSON.stringify(copia), `copia-ciclo-${ciclo.hoy}.cifrada.json`, 'application/json');
  };

  const importar = async (f: File) => {
    try {
      const json = JSON.parse(await f.text());
      let copia: Copia | null = null;
      if (json.app === 'you-and-me/ciclo') {
        const clave = await pedirTexto({ titulo: 'Clave de la copia', boton: 'Abrir', secreto: true });
        if (!clave) return;
        copia = await abrirCopia<Copia>(json, clave);
        if (!copia) { aviso('Esa no es la clave de la copia', 'error'); return; }
      } else if (Array.isArray(json.dias)) copia = json;
      if (!copia) throw new Error();
      // Lo de la copia no pisa lo que ya está registrado
      const nuevos = copia.dias.filter((d) => d?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && !ciclo.dias.has(d.fecha));
      await ciclo.guardarVarios(nuevos);
      if (!ciclo.ajustes && copia.ajustes) await ciclo.guardarAjustes(copia.ajustes);
      aviso(`Listo: ${nuevos.length} días recuperados 🔒`);
    } catch { aviso('No pude leer esa copia', 'error'); }
  };

  const dejar = async () => {
    if (await confirmar({ titulo: '¿Dejar de llevar tu ciclo?', texto: 'Se borran todos tus registros y lo que compartías. Tu llave se queda por si quieres seguir recibiendo. No se puede deshacer.', boton: 'Borrar mis registros', peligro: true })) {
      try { await ciclo.dejarDeRegistrar(); aviso('Tus registros se borraron'); } catch { aviso('No pude borrarlos. Revisa tu conexión.', 'error'); }
    }
  };

  const borrarTodo = async () => {
    if (await confirmar({ titulo: '¿Borrar todo?', texto: 'Se borran tus registros, tu llave, lo que compartías y lo que te compartieron, aquí y en el servidor. No se puede deshacer.', boton: 'Borrar todo', peligro: true })) {
      try { await ciclo.borrarTodo(); aviso('Todo se borró'); } catch { aviso('No pude borrar todo. Revisa tu conexión.', 'error'); }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2">
        <h2 className="text-xl font-bold">Mi llave</h2>
        <p className="text-sm">{nube ? 'Tus datos están en la nube, cifrados con tu clave del ciclo.' : 'Tus registros están solo en este celular, cifrados.'}</p>
        <p className="text-sm text-salvia">Código para comparar con tu pareja:</p>
        <p className="font-mono font-bold break-all">{miHuella}</p>
      </section>

      <Grupo>
        {nube && <Interruptor activo={recordada} onCambio={alternarRecordar} titulo="Recordar mi clave en este celular" detalle="Si la apagas, te la pido cada vez que abras Ciclo" />}
        {nube && <button className="w-full text-left px-4 py-3 min-h-14 font-bold" onClick={() => setHoja('clave')}>Cambiar mi clave del ciclo</button>}
        {nube && <button className="w-full text-left px-4 py-3 min-h-14 font-bold" onClick={nuevoCodigo}>Crear un código de recuperación nuevo</button>}
        <button className="w-full text-left px-4 py-3 min-h-14 font-bold" onClick={() => setHoja('lugar')}>{nube ? 'Guardar solo en este celular' : 'Guardar en la nube, cifrado'}</button>
        {nube && <button className="w-full text-left px-4 py-3 min-h-14 font-bold" onClick={() => ciclo.bloquear()}>Bloquear ahora</button>}
      </Grupo>

      <h2 className="text-xl font-bold px-1 mt-2">Tus datos</h2>
      <Grupo>
        <button className="w-full text-left px-4 py-3 min-h-14" onClick={exportarCifrado}><span className="block font-bold">Descargar copia cifrada</span><span className="block text-sm text-salvia">Para guardarla o pasarla a otro celular</span></button>
        <button className="w-full text-left px-4 py-3 min-h-14" onClick={exportarClaro}><span className="block font-bold">Descargar mis datos (JSON)</span><span className="block text-sm text-salvia">Sin cifrar, para llevarlos a otra app</span></button>
        <label className="w-full text-left px-4 py-3 min-h-14 block cursor-pointer"><span className="block font-bold">Importar una copia</span><span className="block text-sm text-salvia">Cifrada o JSON de esta app</span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importar(f); }} />
        </label>
        <button className="w-full text-left px-4 py-3 min-h-14 font-bold" onClick={() => setHoja('politica')}>Cómo se tratan mis datos</button>
      </Grupo>

      <Grupo>
        {ciclo.ajustes && <button className="w-full text-left px-4 py-3 min-h-14 font-bold text-coral" onClick={dejar}>Dejar de llevar mi ciclo</button>}
        <button className="w-full text-left px-4 py-3 min-h-14 font-bold text-coral" onClick={borrarTodo}>Borrar todo, también mi llave</button>
      </Grupo>
      <p className="text-xs text-salvia px-1">Borrar también revoca tu autorización para tratar estos datos.</p>

      <Hoja abierta={hoja === 'clave'} onClose={() => setHoja(null)} titulo="Cambiar mi clave del ciclo">
        <CambiarClaveCiclo ciclo={ciclo} uid={uid} onListo={() => setHoja(null)} />
      </Hoja>
      <Hoja abierta={hoja === 'lugar'} onClose={() => setHoja(null)} titulo={nube ? 'Solo en este celular' : 'En la nube, cifrado'}>
        <CambiarLugar ciclo={ciclo} onListo={(c) => { setHoja(null); if (c) setCodigo(c); }} />
      </Hoja>
      <Hoja abierta={hoja === 'politica'} onClose={() => setHoja(null)} titulo="Cómo se tratan tus datos">
        <PoliticaCiclo nombreAdmin={nombreAdmin} />
      </Hoja>
      <Hoja abierta={!!codigo} onClose={() => setCodigo(null)} titulo="Código nuevo">
        {codigo && <MostrarCodigo codigo={codigo} onListo={() => setCodigo(null)} />}
      </Hoja>
    </div>
  );
}

function CambiarClaveCiclo({ ciclo, uid, onListo }: { ciclo: Ciclo; uid: string; onListo: () => void }) {
  const { aviso } = useAvisos();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const f = fuerzaClave(nueva);
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciclo.fila) return;
    setGuardando(true);
    const ok = await cambiarClave(uid, ciclo.fila, actual, nueva).catch(() => false);
    setGuardando(false);
    if (!ok) { aviso('La clave actual no es correcta', 'error'); return; }
    await ciclo.iniciar();
    aviso('Clave cambiada 🔐');
    onListo();
  };
  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1"><span className="font-bold">Clave actual</span><input type="password" autoComplete="current-password" className="input" value={actual} onChange={(e) => setActual(e.target.value)} /></label>
      <label className="flex flex-col gap-1"><span className="font-bold">Clave nueva</span><input type="password" autoComplete="new-password" className="input" value={nueva} onChange={(e) => setNueva(e.target.value)} /></label>
      {nueva && <p className={`text-sm font-bold ${f.puntos ? 'text-bosque' : 'text-coral'}`}>{f.texto}</p>}
      <button type="submit" className="btn-primary" disabled={!actual || f.puntos === 0 || guardando}>{guardando ? 'Guardando…' : 'Cambiar'}</button>
    </form>
  );
}

function CambiarLugar({ ciclo, onListo }: { ciclo: Ciclo; onListo: (codigo: string | null) => void }) {
  const { aviso } = useAvisos();
  const [clave, setClave] = useState('');
  const [moviendo, setMoviendo] = useState(false);
  const aLocal = ciclo.modo === 'nube';
  const mover = async () => {
    setMoviendo(true);
    try { onListo(await ciclo.cambiarDeLugar(aLocal ? 'local' : 'nube', aLocal ? undefined : clave)); aviso('Listo 🔒'); }
    catch { aviso('No pude moverlos. No se borró nada.', 'error'); }
    setMoviendo(false);
  };
  return (
    <div className="flex flex-col gap-3">
      {aLocal ? (
        <p>Tus registros se bajan a este celular y se borran del servidor. Si pierdes el celular o borras los datos del navegador, se pierden: descarga copias cifradas de vez en cuando.</p>
      ) : (
        <>
          <p>Se crea una llave nueva protegida con una clave, y tus registros se suben cifrados. Así los ves desde cualquier celular.</p>
          <label className="flex flex-col gap-1"><span className="font-bold">Clave del ciclo</span><input type="password" autoComplete="new-password" className="input" value={clave} onChange={(e) => setClave(e.target.value)} /></label>
          {clave && <p className="text-sm">{fuerzaClave(clave).texto}</p>}
        </>
      )}
      <button className="btn-primary" disabled={moviendo || (!aLocal && fuerzaClave(clave).puntos === 0)} onClick={mover}>{moviendo ? 'Moviendo…' : aLocal ? 'Pasar a este celular' : 'Subir cifrado'}</button>
    </div>
  );
}
