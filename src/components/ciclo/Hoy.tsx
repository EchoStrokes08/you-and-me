import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { NECESIDADES, NOMBRE_FASE } from '../../lib/ciclo/catalogo';
import { fechaCorta, resumenPermisos } from '../../lib/ciclo/formato';
import { entre, faseEn } from '../../lib/ciclo/prediccion';
import { useAvisos } from '../../lib/avisos';
import { Contador, Hoja } from '../ui';
import RegistroDia from './RegistroDia';

const CONFIANZA = { alta: 'Predicción confiable', media: 'Predicción aproximada', baja: 'Predicción con poca certeza' };

export default function Hoy({ ciclo, pareja, irA }: { ciclo: Ciclo; pareja: string; irA: (tab: 'compartir') => void }) {
  const p = ciclo.prediccion!;
  const a = ciclo.ajustes!;
  const tramo = faseEn(p.tramos, ciclo.hoy);
  const falta = p.proximo ? entre(ciclo.hoy, p.proximo.probable) : null;
  const enFertil = p.fertil && ciclo.hoy >= p.fertil.desde && ciclo.hoy <= p.fertil.hasta;

  return (
    <div className="flex flex-col gap-4">
      <section className="card-hero flex flex-col gap-3" aria-label="Tu ciclo hoy">
        {p.actual ? (
          <>
            <p className="eyebrow !text-[#CFE6D7]">{p.enPeriodo ? 'Con el periodo' : tramo ? NOMBRE_FASE[tramo.fase] : 'Tu ciclo'}</p>
            <p className="font-titulo text-[3.25rem] leading-none font-bold tabular-nums">Día <Contador valor={p.actual.dia} /></p>
            {p.proximo && !p.enPeriodo && (
              <p className="text-lg">
                {p.retraso > 0 ? `El periodo va ${p.retraso} ${p.retraso === 1 ? 'día' : 'días'} tarde`
                  : falta! <= 0 ? 'El periodo podría llegar hoy' : `Periodo en ${falta} ${falta === 1 ? 'día' : 'días'}`}
                <span className="block text-sm opacity-85">Entre el {fechaCorta(p.proximo.desde)} y el {fechaCorta(p.proximo.hasta)}</span>
              </p>
            )}
            {p.fertil && a.modo !== 'ninguno' && (
              <p className="text-sm">{enFertil ? 'Hoy estás en la ventana fértil' : `Ventana fértil: ${fechaCorta(p.fertil.desde)} a ${fechaCorta(p.fertil.hasta)}`}{p.ovulacion?.confirmada ? ' · ovulación confirmada' : ''}</p>
            )}
            <span className="badge bg-white/15 text-white self-start">{p.regularidad === 'aprendiendo' ? 'Aprendiendo de tus ciclos' : CONFIANZA[p.confianza]}</span>
          </>
        ) : (
          <>
            <p className="font-titulo text-2xl font-bold">Registra tu próximo periodo</p>
            <p className="text-sm opacity-90">Marca "Sangrado" el primer día y desde ahí empiezo a predecir.</p>
          </>
        )}
      </section>

      {p.notas.length > 0 && (
        <details className="card text-sm">
          <summary className="font-bold cursor-pointer min-h-6">Sobre esta predicción</summary>
          <ul className="flex flex-col gap-2 mt-3 text-salvia">{p.notas.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
      {a.modo === 'evitar' && (
        <p className="text-sm text-coral font-bold px-1">Recuerda: esta app no es un método anticonceptivo.</p>
      )}

      <Necesidades ciclo={ciclo} pareja={pareja} />

      <section className="card flex flex-col gap-4" aria-labelledby="hoy-titulo">
        <h2 id="hoy-titulo" className="text-xl font-bold">Hoy</h2>
        <RegistroDia ciclo={ciclo} fecha={ciclo.hoy} key={ciclo.hoy} />
      </section>

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
