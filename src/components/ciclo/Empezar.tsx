import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { fuerzaClave } from '../../lib/ciclo/cripto';
import { ANTICONCEPTIVOS, CONDICIONES, CON_PAQUETE } from '../../lib/ciclo/catalogo';
import { ajustesIniciales, MAX_CICLO, MAX_PERIODO, MIN_CICLO, VERSION_CONSENTIMIENTO, type Anticonceptivo, type Condicion } from '../../lib/ciclo/tipos';
import { useAvisos } from '../../lib/avisos';
import { hoyStr } from '../../lib/utils';
import { IconoCandado, IconoCheck } from '../ui';
import { CampoDias, Grupo, Interruptor, Opciones } from './comunes';
import { PoliticaCiclo } from './Politica';

type Paso = 'bienvenida' | 'consentimiento' | 'lugar' | 'codigo' | 'preguntas' | 'compromiso';

// Primera vez: para llevar el propio ciclo o para recibir lo que la pareja comparta
// onEmpezar y onTerminar: la página deja este flujo en pantalla aunque la llave ya exista (falta el código o las preguntas)
export default function Empezar({ ciclo, pareja, nombreAdmin, soloRegistro, soloRecibe, onEmpezar, onTerminar }: {
  ciclo: Ciclo; pareja: string; nombreAdmin: string; soloRegistro?: boolean; soloRecibe?: boolean; onEmpezar: () => void; onTerminar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>(soloRegistro ? 'consentimiento' : 'bienvenida');
  const [para, setPara] = useState<'llevar' | 'recibir'>('llevar');
  const [codigo, setCodigo] = useState<string | null>(null);

  if (paso === 'bienvenida' && soloRecibe) return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <span className="w-12 h-12 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCandado className="w-6 h-6" /></span>
        <h2 className="text-2xl font-bold">Lo que {pareja} te comparta</h2>
        <p>Si {pareja} lleva su ciclo aquí, puede elegir qué contarte: cómo se siente, cuándo le llega, qué le ayuda. Ella decide qué ves y lo apaga cuando quiera.</p>
        <p className="text-sm text-salvia">Para que te llegue cifrado solo a ti, necesitas una llave: se crea en el siguiente paso.</p>
      </section>
      <button className="btn-primary" onClick={() => { onEmpezar(); setPara('recibir'); setPaso('compromiso'); }}>Crear mi llave</button>
    </div>
  );

  if (paso === 'bienvenida') return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <span className="w-12 h-12 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCandado className="w-6 h-6" /></span>
        <h2 className="text-2xl font-bold">Tu ciclo, con llave</h2>
        <p>Lo que registres aquí se cifra en tu celular antes de salir. Nadie más lo puede leer, tampoco quien administra la app. Tú decides si {pareja} ve algo, qué ve, y lo apagas cuando quieras.</p>
      </section>
      <button className="btn-primary" onClick={() => { onEmpezar(); setPara('llevar'); setPaso('consentimiento'); }}>Llevar mi ciclo</button>
      <button className="btn-soft" onClick={() => { onEmpezar(); setPara('recibir'); setPaso('compromiso'); }}>Ver lo que {pareja} me comparta</button>
      <p className="text-sm text-salvia text-center px-4">Para que {pareja} te pueda compartir algo, tú también necesitas tu llave: se crea en el siguiente paso.</p>
    </div>
  );

  if (paso === 'compromiso') return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Antes de empezar</h2>
        <p>Si {pareja} decide compartir algo de su ciclo, te llegará cifrado solo para este perfil. Es información íntima que te confía:</p>
        <ul className="flex flex-col gap-2 text-sm">
          {['Úsala para acompañar, no para vigilar ni sacar conclusiones por ella.', 'No la compartas con nadie ni le tomes capturas.', 'Si deja de compartir, es su decisión: no hace falta preguntar por qué.'].map((t) => (
            <li key={t} className="flex gap-2"><IconoCheck className="w-4 h-4 mt-1 text-bosque shrink-0" />{t}</li>
          ))}
        </ul>
      </section>
      <button className="btn-primary" onClick={() => setPaso('lugar')}>Entendido</button>
      <button className="btn-soft" onClick={() => { setPaso('bienvenida'); onTerminar(); }}>Atrás</button>
    </div>
  );

  if (paso === 'consentimiento') return <Consentimiento nombreAdmin={nombreAdmin} onAceptar={() => setPaso(soloRegistro ? 'preguntas' : 'lugar')} onAtras={() => { if (!soloRegistro) setPaso('bienvenida'); onTerminar(); }} />;

  if (paso === 'lugar') return <ElegirLugar ciclo={ciclo} onCreada={(c) => { setCodigo(c); if (c) setPaso('codigo'); else if (para === 'llevar') setPaso('preguntas'); else onTerminar(); }} onAtras={() => setPaso(para === 'llevar' ? 'consentimiento' : 'compromiso')} />;

  if (paso === 'codigo' && codigo) return <MostrarCodigo codigo={codigo} onListo={() => (para === 'llevar' ? setPaso('preguntas') : onTerminar())} />;

  return <Preguntas ciclo={ciclo} onListo={onTerminar} />;
}

function Consentimiento({ nombreAdmin, onAceptar, onAtras }: { nombreAdmin: string; onAceptar: () => void; onAtras?: () => void }) {
  const [acepto, setAcepto] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Tus datos de salud</h2>
        <PoliticaCiclo nombreAdmin={nombreAdmin} />
      </section>
      <label className="card flex gap-3 items-start cursor-pointer">
        <input type="checkbox" className="w-6 h-6 mt-0.5 shrink-0" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        <span className="text-sm">Autorizo de forma libre, previa, expresa e informada el tratamiento de mis datos de salud para lo que se explica arriba. Sé que es voluntario y que puedo revocarlo cuando quiera.</span>
      </label>
      <button className="btn-primary" disabled={!acepto} onClick={onAceptar}>Acepto y sigo</button>
      {onAtras && <button className="btn-soft" onClick={onAtras}>Ahora no</button>}
    </div>
  );
}

export function ElegirLugar({ ciclo, onCreada, onAtras }: { ciclo: Ciclo; onCreada: (codigo: string | null) => void; onAtras: () => void }) {
  const { aviso } = useAvisos();
  const [lugar, setLugar] = useState<'nube' | 'local'>('nube');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [creando, setCreando] = useState(false);
  const fuerza = fuerzaClave(clave);
  const lista = lugar === 'local' || (fuerza.puntos >= 1 && clave === repetida);

  const crear = async () => {
    setCreando(true);
    try { onCreada(await ciclo.crear(lugar, lugar === 'nube' ? clave : null, recordar)); }
    catch { aviso('No pude crear tu llave. Revisa tu conexión.', 'error'); }
    setCreando(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold px-1">¿Dónde se guarda?</h2>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Dónde se guarda">
        {([
          ['nube', 'En la nube, cifrado', 'Lo ves desde cualquier celular con tu clave del ciclo. El servidor solo guarda datos que no puede leer.'],
          ['local', 'Solo en este celular', 'No se sube nada de lo que registres. Si borras la app o pierdes el celular, se pierde (puedes descargar copias cifradas).'],
        ] as const).map(([k, t, d]) => (
          <button key={k} role="radio" aria-checked={lugar === k} onClick={() => setLugar(k)}
            className={`card text-left flex gap-3 items-start ${lugar === k ? 'ring-2 ring-bosque' : ''}`}>
            <span className={`mt-1 w-5 h-5 rounded-full border-2 shrink-0 ${lugar === k ? 'border-bosque bg-hondo' : 'border-menta'}`} aria-hidden="true" />
            <span><span className="block font-bold">{t}</span><span className="block text-sm text-salvia">{d}</span></span>
          </button>
        ))}
      </div>

      {lugar === 'nube' && (
        <section className="card flex flex-col gap-3">
          <label htmlFor="clave-ciclo" className="font-bold">Tu clave del ciclo</label>
          <p className="text-sm text-salvia -mt-2">Es distinta a la contraseña de la app y nunca sale de tu celular. Una frase de cuatro palabras es fácil de recordar y difícil de adivinar.</p>
          <input id="clave-ciclo" type="password" autoComplete="new-password" className="input" value={clave} onChange={(e) => setClave(e.target.value)} />
          {clave && <p className={`text-sm font-bold ${fuerza.puntos === 0 ? 'text-coral' : 'text-bosque'}`} aria-live="polite">{fuerza.texto}</p>}
          <label htmlFor="clave-ciclo-2" className="font-bold">Repítela</label>
          <input id="clave-ciclo-2" type="password" autoComplete="new-password" className="input" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          {repetida && repetida !== clave && <p className="text-sm text-coral">No coinciden.</p>}
          <Grupo><Interruptor activo={recordar} onCambio={setRecordar} titulo="Recordarla en este celular" detalle="Si la apagas, te la pido cada vez que abras esta sección." /></Grupo>
        </section>
      )}
      <button className="btn-primary" disabled={!lista || creando} onClick={crear}>{creando ? 'Creando tu llave…' : 'Crear mi llave'}</button>
      <button className="btn-soft" onClick={onAtras}>Atrás</button>
    </div>
  );
}

export function MostrarCodigo({ codigo, onListo }: { codigo: string; onListo: () => void }) {
  const { aviso } = useAvisos();
  const [guardado, setGuardado] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Tu código de recuperación</h2>
        <p>Si olvidas tu clave del ciclo, con este código entras y pones una nueva. Sin la clave y sin el código, nadie puede recuperar tus datos, ni siquiera quien administra la app.</p>
        <p className="font-mono text-xl font-bold text-center tracking-wider bg-seleccion rounded-2xl py-4 px-2 select-all break-all">{codigo}</p>
        <button className="btn-soft" onClick={() => navigator.clipboard?.writeText(codigo).then(() => aviso('Código copiado. Guárdalo fuera de esta app 🔐'), () => {})}>Copiar</button>
        <p className="text-sm text-salvia">Guárdalo en un lugar seguro fuera de esta app: en tu gestor de contraseñas o en un papel. No se vuelve a mostrar.</p>
      </section>
      <label className="card flex gap-3 items-center cursor-pointer">
        <input type="checkbox" className="w-6 h-6 shrink-0" checked={guardado} onChange={(e) => setGuardado(e.target.checked)} />
        <span className="font-bold">Ya lo guardé</span>
      </label>
      <button className="btn-primary" disabled={!guardado} onClick={onListo}>Seguir</button>
    </div>
  );
}

function Preguntas({ ciclo, onListo }: { ciclo: Ciclo; onListo: () => void }) {
  const { aviso } = useAvisos();
  const [ultimo, setUltimo] = useState('');
  const [anteriores, setAnteriores] = useState<string[]>([]);
  const [tipico, setTipico] = useState(28);
  const [periodo, setPeriodo] = useState(5);
  const [condiciones, setCondiciones] = useState<Condicion[]>([]);
  const [anticonceptivo, setAnticonceptivo] = useState<Anticonceptivo>('ninguno');
  const [paquete, setPaquete] = useState({ inicio: '', activos: 21, descanso: 7 });
  const [inyeccion, setInyeccion] = useState<{ ultima: string; cada: 30 | 90 }>({ ultima: '', cada: 30 });
  const [parto, setParto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const hoy = hoyStr();

  const empezar = async () => {
    setGuardando(true);
    const a = {
      ...ajustesIniciales(new Date().toISOString()),
      cicloTipico: tipico, periodoTipico: periodo, condiciones, anticonceptivo,
      ...(CON_PAQUETE(anticonceptivo) && paquete.inicio ? { paquete } : {}),
      ...(anticonceptivo === 'inyeccion' && inyeccion.ultima ? { inyeccion } : {}),
      ...(condiciones.includes('posparto') && parto ? { partoFecha: parto } : {}),
      consentimiento: { version: VERSION_CONSENTIMIENTO, fecha: new Date().toISOString() },
    };
    try { await ciclo.empezarRegistro(a, [ultimo, ...anteriores].filter(Boolean)); onListo(); }
    catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold px-1">Para empezar</h2>
      <p className="text-salvia px-1 -mt-2">Todo es opcional y lo puedes cambiar después. Con cada ciclo que registres, la predicción aprende de ti.</p>
      <section className="card flex flex-col gap-3">
        <label htmlFor="ultimo" className="font-bold">¿Cuándo empezó tu último periodo?</label>
        <input id="ultimo" type="date" max={hoy} className="input" value={ultimo} onChange={(e) => setUltimo(e.target.value)} />
        {ultimo && anteriores.map((f, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label htmlFor={`ant-${i}`} className="text-sm font-bold">El anterior a ese</label>
            <input id={`ant-${i}`} type="date" max={i ? anteriores[i - 1] : ultimo} className="input" value={f} onChange={(e) => setAnteriores(anteriores.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
        {ultimo && anteriores.length < 3 && (anteriores.length === 0 || anteriores[anteriores.length - 1]) && (
          <button className="btn-soft" onClick={() => setAnteriores([...anteriores, ''])}>Agregar uno anterior (mejora la predicción)</button>
        )}
      </section>
      <section className="card grid grid-cols-2 gap-3">
        <CampoDias etiqueta="Tu ciclo suele durar" valor={tipico} onCambio={setTipico} min={MIN_CICLO} max={MAX_CICLO} />
        <CampoDias etiqueta="Tu periodo suele durar" valor={periodo} onCambio={setPeriodo} min={1} max={MAX_PERIODO} />
      </section>
      <section className="card flex flex-col gap-3">
        <p className="font-bold">¿Algo de esto aplica para ti?</p>
        <Opciones etiqueta="Condiciones" opciones={CONDICIONES} elegidas={condiciones} onCambio={setCondiciones} />
        {condiciones.includes('posparto') && (
          <label className="flex flex-col gap-1"><span className="text-sm font-bold">Fecha del parto</span><input type="date" max={hoy} className="input" value={parto} onChange={(e) => setParto(e.target.value)} /></label>
        )}
      </section>
      <section className="card flex flex-col gap-3">
        <p className="font-bold">¿Usas algún anticonceptivo?</p>
        <Opciones etiqueta="Anticonceptivo" multiple={false} opciones={ANTICONCEPTIVOS} elegidas={[anticonceptivo]} onCambio={(v) => setAnticonceptivo(v[0] ?? 'ninguno')} />
        {CON_PAQUETE(anticonceptivo) && <Paquete valor={paquete} onCambio={setPaquete} />}
        {anticonceptivo === 'inyeccion' && <Inyeccion valor={inyeccion} onCambio={setInyeccion} />}
      </section>
      <button className="btn-primary" disabled={guardando} onClick={empezar}>{guardando ? 'Guardando…' : 'Empezar'}</button>
    </div>
  );
}

export function Inyeccion({ valor, onCambio }: { valor: { ultima: string; cada: 30 | 90 }; onCambio: (v: { ultima: string; cada: 30 | 90 }) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Opciones etiqueta="Cada cuánto" multiple={false} opciones={[['30', 'Mensual'], ['90', 'Trimestral']] as const}
        elegidas={[String(valor.cada) as '30']} onCambio={(v) => v[0] && onCambio({ ...valor, cada: Number(v[0]) as 30 | 90 })} />
      <label className="flex flex-col gap-1"><span className="text-sm font-bold">¿Cuándo te pusiste la última?</span>
        <input type="date" max={hoyStr()} className="input" value={valor.ultima} onChange={(e) => onCambio({ ...valor, ultima: e.target.value })} />
      </label>
      <p className="text-xs text-salvia">Te recuerdo cuándo toca la siguiente. Con la inyección el sangrado puede cambiar o no llegar, y eso suele ser normal.</p>
    </div>
  );
}

export function Paquete({ valor, onCambio }: { valor: { inicio: string; activos: number; descanso: number }; onCambio: (v: { inicio: string; activos: number; descanso: number }) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1"><span className="text-sm font-bold">¿Qué día empezaste el paquete actual?</span>
        <input type="date" className="input" value={valor.inicio} onChange={(e) => onCambio({ ...valor, inicio: e.target.value })} />
      </label>
      <Opciones etiqueta="Tipo de paquete" multiple={false}
        opciones={[['21-7', '21 + 7 de descanso'], ['24-4', '24 + 4'], ['28-0', 'Continuo']] as const}
        elegidas={[`${valor.activos}-${valor.descanso}` as '21-7']}
        onCambio={(v) => { if (v[0]) { const [a, d] = v[0].split('-').map(Number); onCambio({ ...valor, activos: a, descanso: d }); } }} />
    </div>
  );
}
