// Datos de la pantalla de inicio: próxima cita, la cita pasada que falta guardar como recuerdo,
// pregunta del día (y si cada quien respondió), racha, cartas y cupones por cumplir. Cada parte
// va a su ritmo, con Realtime para refrescarse sin volver a entrar. Solo lee de la base.
import { useEffect, useState } from 'react';
import { supabase, datosDe } from '../../lib/supabase';
import { useRecarga } from '../../lib/useRecarga';
import { fechaStr, hoy, hoyStr } from '../../lib/utils';
import type { Cita, Configuracion, Pregunta } from '../../lib/tipos';

/* Lo que muestra el inicio y de dónde sale cada cosa. Cada parte se pide por su lado y se
   muestra apenas llega: si una falla, las demás se ven igual y se intenta de nuevo al volver a la app. */

export type DatosInicio = {
  config: Configuracion | null;
  proximaCita: Cita | null;
  // La cita pasada más reciente que todavía no se guardó como recuerdo
  citaSinRecuerdo: Cita | null;
  pregunta: Pregunta | null;
  respondieron: { yo: boolean; pareja: boolean };
  racha: number;
  cartas: { porAbrir: number; momento: number };
  // Cupones que el otro ya usó y me toca cumplir
  valesPorCumplir: number;
};

const NADIE_RESPONDIO = { yo: false, pareja: false };

const AL_EMPEZAR: DatosInicio = {
  config: null,
  proximaCita: null,
  citaSinRecuerdo: null,
  pregunta: null,
  respondieron: NADIE_RESPONDIO,
  racha: 0,
  cartas: { porAbrir: 0, momento: 0 },
  valesPorCumplir: 0,
};

// Solo se pide guardar como recuerdo las citas de las últimas semanas
const DIAS_PARA_RECUERDO = 30;

export function useDatosInicio(yo: string | undefined): DatosInicio {
  const [datos, setDatos] = useState(AL_EMPEZAR);
  // Si el otro responde la pregunta o cambia una cita, se ve sin salir y volver
  const [vuelta] = useRecarga('inicio-rt', ['respuestas', 'citas']);

  useEffect(() => {
    let vigente = true;
    const poner = (parte: Partial<DatosInicio>) => { if (vigente) setDatos((d) => ({ ...d, ...parte })); };

    const partes = [
      leerConfiguracion().then((config) => poner({ config })),
      leerProximaCita().then((proximaCita) => poner({ proximaCita })),
      leerCitaSinRecuerdo().then((citaSinRecuerdo) => poner({ citaSinRecuerdo })),
      leerPreguntaDeHoy().then(poner),
      leerRacha().then((racha) => poner({ racha })),
      leerCartas().then((cartas) => poner({ cartas })),
      ...(yo ? [contarValesPorCumplir(yo).then((valesPorCumplir) => poner({ valesPorCumplir }))] : []),
    ];

    void Promise.allSettled(partes).then((resultados) => {
      const fallas = resultados.filter((r) => r.status === 'rejected').map((r) => r.reason);
      if (vigente && fallas.length) console.error('No se pudieron cargar todos los datos del inicio', fallas);
    });
    return () => { vigente = false; };
  }, [vuelta, yo]);

  return datos;
}

async function leerConfiguracion() {
  return datosDe(await supabase.from('configuracion').select('*').eq('id', 1).single());
}

async function leerProximaCita(): Promise<Cita | null> {
  return datosDe(await supabase.from('citas')
    .select('*, lugares(nombre,emoji), actividades(nombre), franjas(nombre)')
    .eq('estado', 'confirmada').gte('fecha', hoyStr())
    .order('fecha').limit(1).maybeSingle());
}

async function leerCitaSinRecuerdo(): Promise<Cita | null> {
  const desde = hoy();
  desde.setDate(desde.getDate() - DIAS_PARA_RECUERDO);
  const recientes = datosDe(await supabase.from('citas')
    .select('*, lugares(nombre), recuerdos(id)')
    .eq('estado', 'confirmada').lt('fecha', hoyStr()).gte('fecha', fechaStr(desde))
    .order('fecha', { ascending: false }).limit(5));
  return recientes.find((cita) => !cita.recuerdos.length) ?? null;
}

async function leerPreguntaDeHoy(): Promise<Pick<DatosInicio, 'pregunta' | 'respondieron'>> {
  const pregunta = datosDe(await supabase.rpc('obtener_pregunta_del_dia'));
  if (!pregunta?.id) return { pregunta: null, respondieron: NADIE_RESPONDIO };
  const [respondieron] = datosDe(await supabase.rpc('estado_respuestas', { p_pregunta_id: pregunta.id }));
  return { pregunta, respondieron: respondieron ?? NADIE_RESPONDIO };
}

async function leerRacha() {
  const [racha] = datosDe(await supabase.rpc('racha_preguntas'));
  return racha?.dias ?? 0;
}

async function leerCartas() {
  const sinAbrir = datosDe(await supabase.rpc('cartas_recibidas')).filter((carta) => !carta.abierta_en);
  return {
    porAbrir: sinAbrir.filter((carta) => carta.disponible).length,
    momento: sinAbrir.filter((carta) => carta.momento).length,
  };
}

async function contarValesPorCumplir(yo: string) {
  const { count, error } = await supabase.from('vales')
    .select('id', { count: 'exact', head: true })
    .eq('de', yo).not('redimido_en', 'is', null).is('cumplido_en', null);
  if (error) throw error;
  return count ?? 0;
}
