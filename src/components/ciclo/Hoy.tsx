import { useMemo, useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { NECESIDADES } from '../../lib/ciclo/catalogo';
import { fechaCorta, resumenPermisos } from '../../lib/ciclo/formato';
import { proximaInyeccion } from '../../lib/ciclo/prediccion';
import { useAvisos } from '../../lib/avisos';
import { Hoja } from '../ui';
import RegistroDia from './RegistroDia';
import Pronostico from './Pronostico';
import type { EntradaPronostico } from '../../lib/ciclo/pronostico';

const CONFIANZA_CORTA = { alta: 'Confiable', media: 'Aproximada', baja: 'Poca certeza' };

export default function Hoy({ ciclo, pareja, irA }: { ciclo: Ciclo; pareja: string; irA: (tab: 'compartir') => void }) {
  const p = ciclo.prediccion!;
  const a = ciclo.ajustes!;

  // La ventana fértil solo se muestra si le sirve: cuando buscan o evitan un embarazo
  const entrada = useMemo<EntradaPronostico | null>(() => p.actual ? {
    hoy: ciclo.hoy, tramos: p.tramos, inicioCiclo: p.actual.inicio, proximo: p.proximo, retraso: p.retraso, enPeriodo: p.enPeriodo,
    fertil: a.modo !== 'ninguno' && !p.sinVentana ? p.fertil : undefined,
  } : null, [p, ciclo.hoy, a.modo]);
  const energia = useMemo(() => new Map([...ciclo.dias.values()].filter((d) => d.energia).map((d) => [d.fecha, d.energia!])), [ciclo.dias]);

  const deHoy = (
    <>
      {p.notas.length > 0 && (
        <details className="card text-sm">
          <summary className="font-bold cursor-pointer min-h-6">Sobre esta predicción</summary>
          <ul className="flex flex-col gap-2 mt-3 text-salvia">{p.notas.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
      {a.modo === 'evitar' && (
        <p className="text-sm text-coral font-bold px-1">Recuerda: esta app no es un método anticonceptivo.</p>
      )}

      <ProximaInyeccion ciclo={ciclo} />

      <Necesidades ciclo={ciclo} pareja={pareja} />

      <section className="card flex flex-col gap-4" aria-labelledby="hoy-titulo">
        <h2 id="hoy-titulo" className="text-xl font-bold">Hoy</h2>
        <RegistroDia ciclo={ciclo} fecha={ciclo.hoy} key={ciclo.hoy} />
      </section>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {entrada ? (
        <Pronostico entrada={entrada} paraPareja={false} nombre={pareja} energiaReal={energia}
          confianza={p.regularidad === 'aprendiendo' ? 'Aprendiendo' : CONFIANZA_CORTA[p.confianza]}>
          {deHoy}
        </Pronostico>
      ) : (
        <>
          <section className="card-hero flex flex-col gap-3" aria-label="Tu ciclo hoy">
            <p className="font-titulo text-2xl font-bold">Registra tu próximo periodo</p>
            <p className="text-sm opacity-90">Marca "Sangrado" el primer día y desde ahí empiezo a predecir.</p>
          </section>
          {deHoy}
        </>
      )}

      <button className="fila-aviso text-left min-h-14" onClick={() => irA('compartir')}>
        <span className="flex-1">
          <span className="block font-bold">{a.compartir.activo ? `Compartiendo con ${pareja}` : `${pareja} no ve nada`}</span>
          <span className="block text-sm text-salvia">{a.compartir.activo ? resumenPermisos(a.compartir) : 'Toca para escoger qué compartir'}</span>
        </span>
      </button>
    </div>
  );
}

function Necesidades({ ciclo, pareja }: { ciclo: Ciclo; pareja: string }) {
  const { aviso } = useAvisos();
  const [elegida, setElegida] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviadasHoy = ciclo.dias.get(ciclo.hoy)?.necesidades ?? [];

  const enviar = async () => {
    if (!elegida) return;
    setEnviando(true);
    try {
      const r = await ciclo.enviarNecesidad(elegida, nota);
      if (r === 'ok') { aviso(`Le avisé a ${pareja} 💚`); setElegida(null); setNota(''); }
      else if (r === 'sin-llave') aviso(`${pareja} todavía no ha activado su llave: pídele que entre una vez a Ciclo.`, 'error');
      else if (r === 'llave-cambio') aviso(`La llave de ${pareja} cambió. Revísala en Compartir antes de mandar algo.`, 'error');
      else aviso('No pude mandarlo. Revisa tu conexión.', 'error');
    } catch { aviso('No pude mandarlo. Revisa tu conexión.', 'error'); }
    setEnviando(false);
  };

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="necesidades-titulo">
      <div>
        <h2 id="necesidades-titulo" className="text-xl font-bold">Contarle a {pareja}</h2>
        <p className="text-sm text-salvia">Le llega un aviso que solo dice que le dejaste algo; lo demás lo ve al abrir.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {NECESIDADES.map(([id, texto]) => (
          <button key={id} className="chip" data-active={enviadasHoy.includes(id)} onClick={() => setElegida(id)}>{texto}</button>
        ))}
      </div>
      <Hoja abierta={!!elegida} onClose={() => setElegida(null)} titulo={NECESIDADES.find(([k]) => k === elegida)?.[1] ?? ''}>
        <label className="flex flex-col gap-1">
          <span className="font-bold">¿Quieres agregar algo? (opcional)</span>
          <input className="input" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Por ejemplo: llámame en la noche" />
        </label>
        <button className="btn-primary" disabled={enviando} onClick={enviar}>{enviando ? 'Mandando…' : `Mandárselo a ${pareja}`}</button>
      </Hoja>
    </section>
  );
}

function ProximaInyeccion({ ciclo }: { ciclo: Ciclo }) {
  const { aviso } = useAvisos();
  const a = ciclo.ajustes!;
  const p = proximaInyeccion(a, ciclo.hoy);
  if (!p) return null;
  const texto = p.dias > 1 ? `Te toca en ${p.dias} días` : p.dias === 1 ? 'Te toca mañana' : p.dias === 0 ? 'Te toca hoy' : `Se pasó hace ${-p.dias} ${p.dias === -1 ? 'día' : 'días'}`;
  const aplicada = async () => {
    try { await ciclo.guardarAjustes({ ...a, inyeccion: { ...a.inyeccion!, ultima: ciclo.hoy } }); aviso('Anotada 💉'); }
    catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
  };
  return (
    <section className="card flex flex-col gap-2" aria-labelledby="inyeccion-titulo">
      <h2 id="inyeccion-titulo" className="text-lg font-bold">Próxima inyección</h2>
      <p className={p.dias < 0 ? 'text-coral font-bold' : ''}>{texto} · {fechaCorta(p.fecha)}</p>
      {p.dias < -3 && <p className="text-sm">Si pasaron más de 3 días, puede que ya no proteja igual: usa condón y consulta antes de ponerte la siguiente.</p>}
      {p.dias <= 3 && <button className="btn-soft self-start" onClick={aplicada}>Me la puse hoy</button>}
    </section>
  );
}
