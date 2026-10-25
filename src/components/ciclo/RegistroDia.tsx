// El formulario para registrar cómo va un día del ciclo: ánimo, flujo, dolores, síntomas, temperatura y demás.
// Vive en "Hoy" y en el calendario del ciclo; guardar sin datos borra el día.
import { useEffect, useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import type { Dia, Flujo, Moco, ResultadoLH } from '../../lib/ciclo/tipos';
import { ANIMOS, DOLORES, FLUJOS, MOCOS, SINTOMAS } from '../../lib/ciclo/catalogo';
import { useAvisos } from '../../lib/avisos';
import { IconoAdelante } from '../ui';
import { Opciones, Rotulo } from './comunes';

const DOLOR_OPCIONES = DOLORES.map((d, i) => [String(i), d] as const);

// Lo que se registra de un día. Se guarda con el botón; si queda vacío, el día se borra
export default function RegistroDia({ ciclo, fecha, onGuardado }: { ciclo: Ciclo; fecha: string; onGuardado?: () => void }) {
  const { aviso } = useAvisos();
  const original = ciclo.dias.get(fecha);
  const [d, setD] = useState<Dia>(() => original ?? { fecha, actualizado: 0 });
  const [mas, setMas] = useState(() => !!(original?.temperatura || original?.lh || original?.moco || original?.embarazo));
  const [guardando, setGuardando] = useState(false);
  const buscando = ciclo.ajustes?.modo === 'buscar';

  // Si cambia la fecha (en el calendario), se carga lo de ese día
  useEffect(() => { setD(ciclo.dias.get(fecha) ?? { fecha, actualizado: 0 }); }, [fecha]); // oxlint-disable-line react-hooks/exhaustive-deps

  const poner = <K extends keyof Dia>(k: K, v: Dia[K] | undefined) => setD((x) => {
    const n = { ...x };
    if (v === undefined || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v;
    // Lo que ella toca a mano deja de contar como importado
    if (n.fuentes?.[k]) { n.fuentes = { ...n.fuentes }; delete n.fuentes[k]; }
    return n;
  });

  const cambio = JSON.stringify({ ...d, actualizado: 0 }) !== JSON.stringify({ ...(original ?? { fecha, actualizado: 0 }), actualizado: 0 });

  const guardar = async () => {
    setGuardando(true);
    try { await ciclo.guardarDia(d); aviso('Guardado 🔒'); onGuardado?.(); }
    catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Rotulo>Sangrado</Rotulo>
        <Opciones etiqueta="Sangrado" multiple={false} opciones={FLUJOS} elegidas={d.flujo ? [d.flujo] : []} onCambio={(v) => poner('flujo', v[0] as Flujo | undefined)} />
      </div>
      <div className="flex flex-col gap-2">
        <Rotulo>Dolor</Rotulo>
        <Opciones etiqueta="Dolor" multiple={false} opciones={DOLOR_OPCIONES} elegidas={d.dolor != null ? [String(d.dolor)] : []} onCambio={(v) => poner('dolor', v[0] != null ? (Number(v[0]) as Dia['dolor']) : undefined)} />
      </div>
      <div className="flex flex-col gap-2">
        <Rotulo>Síntomas</Rotulo>
        <Opciones etiqueta="Síntomas" opciones={SINTOMAS} elegidas={d.sintomas ?? []} onCambio={(v) => poner('sintomas', v)} />
      </div>
      <div className="flex flex-col gap-2">
        <Rotulo>Cómo me siento</Rotulo>
        <Opciones etiqueta="Ánimo" opciones={ANIMOS} elegidas={d.animo ?? []} onCambio={(v) => poner('animo', v)} />
      </div>

      <button type="button" onClick={() => setMas(!mas)} aria-expanded={mas} className="fila-aviso min-h-12 text-left">
        <span className="flex-1 font-bold">Temperatura, pruebas y más</span>
        <IconoAdelante className={`w-4 h-4 text-bosque transition-transform ${mas ? 'rotate-90' : ''}`} />
      </button>
      {mas && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="eyebrow px-1">Temperatura basal (°C)</span>
            <input type="number" inputMode="decimal" step="0.01" min={34} max={39} placeholder="36.45" className="input"
              value={d.temperatura ?? ''} onChange={(e) => poner('temperatura', e.target.value ? Number(e.target.value) : undefined)} />
            <span className="text-xs text-salvia px-1">Al despertar, antes de levantarte, a la misma hora.{d.fuentes?.temperatura ? ' (Importada)' : ''}</span>
          </label>
          <div className="flex flex-col gap-2">
            <Rotulo>Prueba de ovulación (LH)</Rotulo>
            <Opciones etiqueta="Prueba de ovulación" multiple={false} opciones={[['negativo', 'Negativa'], ['positivo', 'Positiva'], ['pico', 'Pico']] as const}
              elegidas={d.lh ? [d.lh] : []} onCambio={(v) => poner('lh', v[0] as ResultadoLH | undefined)} />
          </div>
          <div className="flex flex-col gap-2">
            <Rotulo>Flujo cervical</Rotulo>
            <Opciones etiqueta="Flujo cervical" multiple={false} opciones={MOCOS} elegidas={d.moco ? [d.moco] : []} onCambio={(v) => poner('moco', v[0] as Moco | undefined)} />
          </div>
          <div className="flex flex-col gap-2">
            <Rotulo>Prueba de embarazo</Rotulo>
            <Opciones etiqueta="Prueba de embarazo" multiple={false} opciones={[['negativo', 'Negativa'], ['positivo', 'Positiva']] as const}
              elegidas={d.embarazo ? [d.embarazo] : []} onCambio={(v) => poner('embarazo', v[0] as Dia['embarazo'])} />
          </div>
          {buscando && (
            <div className="flex flex-col gap-2">
              <Rotulo>Relaciones (nunca se comparte)</Rotulo>
              <Opciones etiqueta="Relaciones" multiple={false} opciones={[['si', 'Sí']] as const} elegidas={d.relaciones ? ['si'] : []} onCambio={(v) => poner('relaciones', v.length ? true : undefined)} />
            </div>
          )}
          {(d.tempMuneca != null || d.fcReposo != null) && (
            <p className="text-sm text-salvia px-1">
              Del reloj o anillo: {[d.tempMuneca != null ? `temperatura ${d.tempMuneca}` : null, d.fcReposo != null ? `pulso en reposo ${d.fcReposo} lpm` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="eyebrow px-1">Nota (solo para ti)</span>
        <textarea rows={2} maxLength={1000} className="input" value={d.nota ?? ''} onChange={(e) => poner('nota', e.target.value || undefined)} />
      </label>

      <button className="btn-primary" disabled={!cambio || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
}
