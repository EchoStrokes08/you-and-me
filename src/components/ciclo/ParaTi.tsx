import { useMemo, useState } from 'react';
import { resumenPareja, textoAviso, type Resumen } from '../../lib/ciclo/acciones';
import type { VistaCompartida } from '../../lib/ciclo/compartir';
import type { AvisoRecibido } from '../../lib/ciclo/almacen';
import { ANIMOS, SINTOMAS, etiqueta } from '../../lib/ciclo/catalogo';
import { entre } from '../../lib/ciclo/prediccion';
import { Corazon, IconoCheck } from '../ui';
import { GraficaTemperatura } from './comunes';
import { fechaCorta } from '../../lib/ciclo/formato';
import type { EntradaPronostico } from '../../lib/ciclo/pronostico';
import Pronostico from './Pronostico';

const cuando = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const mismo = d.toDateString() === hoy.toDateString();
  return mismo ? `hoy, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}` : d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
};

// Lo que ve la pareja: avisos que le dejó y su ciclo traducido a cosas que puede hacer
export default function ParaTi({ vista, avisos, hoy, pareja, cargado, onDescartar }: {
  vista: { vista: VistaCompartida; actualizado: string } | null; avisos: AvisoRecibido[]; hoy: string; pareja: string; cargado: boolean; onDescartar: (id: string) => void;
}) {
  const [ahora] = useState(() => Date.now());
  if (!cargado) return <div className="esqueleto h-40" aria-hidden="true" />;
  // Solo los de los últimos tres días: lo viejo ya no sirve para acompañar
  const recientes = avisos.filter((a) => ahora - Date.parse(a.enviarEn) < 3 * 86400000);
  return (
    <div className="flex flex-col gap-4">
      {recientes.map((a) => {
        const t = textoAviso(a.contenido, pareja);
        return (
          <section key={a.id} className="card flex flex-col gap-2" aria-label={t.titulo}>
            <p className="eyebrow">{cuando(a.enviarEn)}</p>
            <p className="font-titulo text-xl font-semibold leading-snug">{t.titulo}</p>
            {t.texto && <p className="whitespace-pre-line">{t.texto}</p>}
            <button className="btn-soft self-start mt-1" onClick={() => onDescartar(a.id)}><IconoCheck className="w-4 h-4" />Listo</button>
          </section>
        );
      })}

      {vista ? (
        <VistaResumen resumen={resumenPareja(vista.vista, hoy, pareja)} vista={vista.vista} hoy={hoy} actualizado={vista.actualizado} nombre={pareja} />
      ) : (
        // Igual si nunca compartió o si dejó de hacerlo: no se deja ver la diferencia
        <section className="card flex flex-col gap-2 items-start">
          <span className="w-12 h-12 rounded-full bg-seleccion text-bosque flex items-center justify-center"><Corazon className="w-6 h-6" lleno={false} /></span>
          <p className="font-titulo text-xl font-semibold">Aquí verás lo que {pareja} decida compartir contigo</p>
          <p className="text-sm text-salvia">Mientras tanto, en "Aprender" hay ideas para acompañar mejor.</p>
        </section>
      )}
    </div>
  );
}

// nombre: de quién es el ciclo. Con fases compartidas se ve el tablero; si no, solo el resumen
export function VistaResumen({ resumen: r, vista: v, hoy, actualizado, nombre }: { resumen: Resumen; vista: VistaCompartida; hoy: string; actualizado?: string; nombre?: string }) {
  const animo = (v.animo ?? []).filter((a) => entre(a.fecha, hoy) <= 2);
  const sintomas = (v.sintomas ?? []).filter((s) => entre(s.fecha, hoy) <= 2);
  // Solo lo que ella compartió: sin "periodo" no hay próximo periodo, sin "fértil" no hay ventana
  const entrada = useMemo<EntradaPronostico | null>(() => v.fases?.length ? {
    hoy, tramos: v.fases, inicioCiclo: v.inicioCiclo, proximo: v.periodo?.proximo, retraso: v.periodo?.retraso ?? 0,
    fertil: v.fertil ? { desde: v.fertil.desde, hasta: v.fertil.hasta } : undefined,
  } : null, [v, hoy]);

  const acciones = r.acciones.length > 0 && (
    <section className="card flex flex-col gap-3" aria-labelledby="acciones-titulo">
      <div>
        <h2 id="acciones-titulo" className="text-xl font-bold">Qué puedes hacer</h2>
        {entrada && <p className="text-sm text-salvia">{r.titular}</p>}
      </div>
      <ul className="flex flex-col gap-3">
        {r.acciones.map((a) => (
          <li key={a.id} className="flex gap-3">
            <span className="mt-1 w-6 h-6 rounded-full bg-seleccion text-bosque flex items-center justify-center shrink-0"><IconoCheck className="w-3.5 h-3.5" /></span>
            <span>{a.texto}{a.detalle && <span className="block text-sm text-salvia">{a.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      {entrada && nombre ? (
        <Pronostico entrada={entrada} paraPareja nombre={nombre}>{acciones}</Pronostico>
      ) : (
        <>
          <section className="card-hero flex flex-col gap-3">
            <p className="font-titulo text-[1.65rem] leading-tight font-semibold">{r.titular}</p>
            {r.contexto && <p className="text-sm opacity-85">{r.contexto}</p>}
          </section>
          {acciones}
          {(r.proximo || r.fertil) && (
            <section className="card flex flex-col gap-2">
              {r.proximo && <p>{r.proximo}</p>}
              {r.fertil && <p>{r.fertil}</p>}
            </section>
          )}
        </>
      )}

      {(animo.length > 0 || sintomas.length > 0) && (
        <section className="card flex flex-col gap-2" aria-labelledby="registro-titulo">
          <h2 id="registro-titulo" className="text-lg font-bold">Lo que registró</h2>
          {[...new Set([...animo.map((a) => a.fecha), ...sintomas.map((s) => s.fecha)])].sort().reverse().map((f) => {
            const an = animo.find((a) => a.fecha === f)?.valores ?? [];
            const si = sintomas.find((s) => s.fecha === f);
            const partes = [...an.map((x) => etiqueta(ANIMOS, x)), ...(si?.lista ?? []).map((x) => etiqueta(SINTOMAS, x)), si?.dolor ? `dolor ${['', 'leve', 'moderado', 'fuerte'][si.dolor]}` : null].filter(Boolean);
            return <p key={f} className="text-sm"><b>{f === hoy ? 'Hoy' : entre(f, hoy) === 1 ? 'Ayer' : fechaCorta(f)}:</b> {partes.join(', ').toLowerCase()}</p>;
          })}
        </section>
      )}

      {v.planificacion && (
        <section className="card flex flex-col gap-3" aria-labelledby="plan-titulo">
          <h2 id="plan-titulo" className="text-lg font-bold">Nuestro proceso</h2>
          <p className="text-sm text-salvia">Ciclo {v.planificacion.ciclosBuscando} buscando embarazo.</p>
          <GraficaTemperatura puntos={v.planificacion.temperaturas} />
          {v.planificacion.lh.length > 0 && <p className="text-sm">Pruebas de ovulación: {v.planificacion.lh.map((l) => `${fechaCorta(l.fecha)} ${l.resultado === 'negativo' ? 'negativa' : l.resultado === 'pico' ? 'pico' : 'positiva'}`).join(' · ')}</p>}
          {v.planificacion.embarazo.length > 0 && <p className="text-sm">Pruebas de embarazo: {v.planificacion.embarazo.map((e) => `${fechaCorta(e.fecha)} ${e.resultado === 'positivo' ? 'positiva' : 'negativa'}`).join(' · ')}</p>}
        </section>
      )}

      {actualizado && <p className="text-xs text-salvia px-1">Actualizado {cuando(actualizado)} · Son estimaciones: nada reemplaza preguntarle cómo está.</p>}
    </div>
  );
}
