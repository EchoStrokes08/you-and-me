// Pantalla donde quien lleva el ciclo decide qué verá su pareja: permisos por tema y avisos automáticos.
// Apagar el último permiso es revocar todo de un toque, sin confirmación ni aviso a la pareja.
import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import type { Alertas, Permisos } from '../../lib/ciclo/tipos';
import { PERMISOS_NADA } from '../../lib/ciclo/tipos';
import { armarVista } from '../../lib/ciclo/compartir';
import { resumenPareja } from '../../lib/ciclo/acciones';
import { useAvisos } from '../../lib/avisos';
import { Grupo, Interruptor, Opciones, Rotulo } from './comunes';
import { VistaResumen } from './ParaTi';

const PERMISOS: [keyof Omit<Permisos, 'activo'>, string, string][] = [
  ['periodo', 'Fechas del periodo', 'Cuándo fue y cuándo se espera el próximo'],
  ['fase', 'Fase del ciclo', 'En qué parte del ciclo vas, con consejos para acompañarte. Incluye cuándo estás con el periodo'],
  ['animo', 'Estado de ánimo', 'Lo que registres de los últimos 7 días'],
  ['sintomas', 'Síntomas y dolor', 'Lo de los últimos 7 días y lo que suele pasarte en cada fase'],
  ['fertil', 'Ventana fértil', 'Los días de mayor probabilidad de embarazo'],
  ['planificacion', 'Planificación familiar', 'Pruebas de ovulación, temperatura y pruebas de embarazo (solo si buscan embarazo)'],
];

export default function Compartir({ ciclo, pareja, yo }: { ciclo: Ciclo; pareja: string; yo: string }) {
  const { aviso } = useAvisos();
  const a = ciclo.ajustes!;
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const per = a.compartir;

  const guardar = async (compartir: Permisos, alertas: Alertas = a.alertas) => {
    try { await ciclo.guardarAjustes({ ...a, compartir, alertas }); }
    catch { aviso('No pude guardar el cambio. Revisa tu conexión.', 'error'); }
  };

  // Lo más importante: dejar de compartir es un toque, sin confirmación y sin aviso a la pareja
  const dejarDeCompartir = async () => {
    try {
      await ciclo.guardarAjustes({ ...a, compartir: { ...PERMISOS_NADA } }, { revocar: true });
      aviso(`Listo: ${pareja} ya no ve nada 🔒`);
    } catch { aviso('No pude revocarlo. Revisa tu conexión e intenta otra vez.', 'error'); }
  };

  const cambiarPermiso = (k: keyof Omit<Permisos, 'activo'>, v: boolean) => {
    const nuevo = { ...per, [k]: v };
    nuevo.activo = Object.entries(nuevo).some(([x, y]) => x !== 'activo' && y);
    // Si apaga lo último que compartía, es revocar
    if (!nuevo.activo && per.activo) return dejarDeCompartir();
    guardar(nuevo);
  };

  const cambiarAlerta = <K extends keyof Alertas>(k: K, v: Alertas[K]) => guardar(per, { ...a.alertas, [k]: v });

  const previa = ciclo.prediccion ? armarVista(ciclo.prediccion, [...ciclo.dias.values()], a, ciclo.hoy) : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Qué ve {pareja}</h2>
        <p className="text-sm text-salvia">Tú escoges cada cosa. Lo compartido viaja cifrado para su celular, y lo que no actives no sale del tuyo.</p>
        {per.activo ? (
          <button className="btn-primary" onClick={dejarDeCompartir}>Dejar de compartir ahora</button>
        ) : (
          <p className="font-bold">Ahora no ve nada.</p>
        )}
        {per.activo && <p className="text-xs text-salvia -mt-1">Se borra al instante de su lado. No le llega ninguna notificación: solo deja de ver la información.</p>}
      </section>

      {ciclo.compartir === 'sin-llave' && per.activo && (
        <p className="card text-sm" role="status"><b>{pareja} todavía no ha activado su llave.</b> Pídele que entre a Ciclo y toque "Ver lo que me compartas". Mientras tanto no le llega nada.</p>
      )}
      {ciclo.compartir === 'llave-cambio' && (
        <LlaveCambio ciclo={ciclo} pareja={pareja} />
      )}
      {ciclo.compartir === 'error' && per.activo && <p className="text-sm text-coral px-1" role="alert">No pude actualizar lo compartido. Se intenta de nuevo al guardar algo o al volver a abrir.</p>}

      <Grupo>
        {PERMISOS.map(([k, titulo, detalle]) => {
          const noAplica = (k === 'planificacion' && a.modo !== 'buscar') || ((k === 'fertil' || k === 'planificacion') && ciclo.prediccion?.sinVentana);
          return <Interruptor key={k} activo={per[k] && !noAplica} deshabilitado={!!noAplica} onCambio={(v) => cambiarPermiso(k, v)} titulo={titulo}
            detalle={noAplica ? (ciclo.prediccion?.sinVentana ? 'No aplica con anticonceptivo hormonal' : 'Se activa en modo "Buscamos embarazo"') : detalle} />;
        })}
      </Grupo>

      {per.activo && previa && (
        <section className="card flex flex-col gap-3">
          <button onClick={() => setVistaPrevia(!vistaPrevia)} aria-expanded={vistaPrevia} className="font-bold text-left text-bosque">
            {vistaPrevia ? 'Ocultar' : 'Ver'} exactamente lo que ve {pareja}
          </button>
          {vistaPrevia && <VistaResumen resumen={resumenPareja(previa, ciclo.hoy, yo)} vista={previa} hoy={ciclo.hoy} nombre={yo} />}
        </section>
      )}

      <h2 className="text-xl font-bold px-1 mt-2">Avisos para {pareja}</h2>
      <p className="text-sm text-salvia px-1 -mt-3">Opcionales. La notificación solo dice que le dejaste algo; el servidor sabe la hora, nunca el motivo.</p>
      <Grupo>
        <Interruptor activo={a.alertas.antesPeriodo} deshabilitado={!per.periodo} onCambio={(v) => cambiarAlerta('antesPeriodo', v)}
          titulo="Antes del periodo" detalle={per.periodo ? `Le avisa ${a.alertas.diasAntes === 1 ? 'un día' : `${a.alertas.diasAntes} días`} antes, a las 9 a. m.` : 'Necesita compartir las fechas del periodo'} />
        {a.alertas.antesPeriodo && per.periodo && (
          <div className="px-4 py-3 flex flex-col gap-2">
            <Rotulo>Cuántos días antes</Rotulo>
            <Opciones etiqueta="Días antes" multiple={false} opciones={[['1', '1 día'], ['2', '2 días'], ['3', '3 días']] as const}
              elegidas={[String(a.alertas.diasAntes) as '1']} onCambio={(v) => v[0] && cambiarAlerta('diasAntes', Number(v[0]) as 1 | 2 | 3)} />
          </div>
        )}
        <Interruptor activo={a.alertas.compras} deshabilitado={!per.periodo} onCambio={(v) => cambiarAlerta('compras', v)}
          titulo="Recordar compras" detalle="Productos de higiene, analgésico o lo que tú le digas, unos días antes" />
        {a.alertas.compras && per.periodo && <Productos valor={a.alertas.productos} onGuardar={(t) => cambiarAlerta('productos', t)} />}
        <Interruptor activo={a.alertas.diaDificil} deshabilitado={!per.activo} onCambio={(v) => cambiarAlerta('diaDificil', v)}
          titulo="Cuando registro un día difícil" detalle="Dolor fuerte, o dolor con el ánimo bajo" />
        {a.modo === 'buscar' && (
          <Interruptor activo={a.alertas.ventanaFertil} deshabilitado={!per.fertil} onCambio={(v) => cambiarAlerta('ventanaFertil', v)}
            titulo="Cuando empieza la ventana fértil" detalle={per.fertil ? 'El primer día, a las 9 a. m.' : 'Necesita compartir la ventana fértil'} />
        )}
      </Grupo>

      {ciclo.pareja && (
        <details className="card text-sm">
          <summary className="font-bold cursor-pointer">Verificar la llave de {pareja}</summary>
          <p className="mt-2 text-salvia">Para estar seguros de que nadie se metió en medio, comparen este código con el que {pareja} ve en su Ciclo, en "Mi llave". Deben ser iguales.</p>
          <p className="font-mono font-bold mt-2 break-all">{ciclo.pareja.huella}</p>
        </details>
      )}
    </div>
  );
}

function Productos({ valor, onGuardar }: { valor: string; onGuardar: (t: string) => void }) {
  const [t, setT] = useState(valor);
  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <label htmlFor="productos" className="eyebrow">Qué conviene tener en casa (opcional)</label>
      <div className="flex gap-2">
        <input id="productos" className="input" maxLength={120} placeholder="Toallas, ibuprofeno, chocolate" value={t} onChange={(e) => setT(e.target.value)} />
        <button className="btn-soft shrink-0" disabled={t === valor} onClick={() => onGuardar(t)}>Guardar</button>
      </div>
    </div>
  );
}

function LlaveCambio({ ciclo, pareja }: { ciclo: Ciclo; pareja: string }) {
  const { confirmar } = useAvisos();
  const aceptar = async () => {
    if (await confirmar({ titulo: `¿Confías en la llave nueva de ${pareja}?`, texto: `Antes de aceptar, pregúntale si cambió de celular o empezó de nuevo, y comparen el código: ${ciclo.pareja?.huella}`, boton: 'Sí, es su llave' })) await ciclo.aceptarLlaveNueva();
  };
  return (
    <section className="card flex flex-col gap-2 border-coral" role="alert">
      <p className="font-bold">La llave de {pareja} cambió</p>
      <p className="text-sm">Pasa si cambió de celular o empezó de nuevo. Mientras no lo confirmes, no se le envía nada.</p>
      <button className="btn-soft" onClick={aceptar}>Revisar y aceptar</button>
    </section>
  );
}
