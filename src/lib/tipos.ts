// El vocabulario de la app con nombre propio (una línea por tabla).
import type { Database, Tables } from './database.types';

/* El vocabulario de la app: las cosas de las que hablan las pantallas, con nombre propio.
   Salen de los tipos de la base (database.types.ts), así que si una columna cambia, TypeScript avisa. */

export type Configuracion = Tables<'configuracion'>;
export type Lugar = Tables<'lugares'>;
export type Actividad = Tables<'actividades'>;
export type Franja = Tables<'franjas'>;
export type CategoriaCita = Tables<'categorias_cita'>;
export type Recuerdo = Tables<'recuerdos'>;
export type FotoRecuerdo = Tables<'fotos_recuerdo'>;
export type Pregunta = Tables<'preguntas'>;
export type DiaImportante = Tables<'dias_importantes'>;
export type Vale = Tables<'vales'>;

export type EstadoCita = 'pendiente' | 'confirmada' | 'vivida' | 'cancelada';

/** Una cita con lo que suele acompañarla. Cada pantalla trae solo una parte, por eso todo es opcional */
export type Cita = Tables<'citas'> & {
  lugares?: Pick<Lugar, 'nombre'> & Partial<Pick<Lugar, 'emoji' | 'lat' | 'lng'>> | null;
  actividades?: Pick<Actividad, 'nombre'> | null;
  franjas?: Pick<Franja, 'nombre'> | null;
  categorias_cita?: Pick<CategoriaCita, 'nombre' | 'emoji'> | null;
  recuerdos?: { id: string }[];
};

/** En la base la fecha puede faltar, pero toda cita se crea con una: las pantallas trabajan con estas */
export type CitaConFecha = Cita & { fecha: string };
export const tieneFecha = <T extends { fecha: string | null }>(c: T): c is T & { fecha: string } => c.fecha !== null;

export type Peli = Tables<'pelis'>;
export type CalificacionPeli = Tables<'pelis_calificacion'>;
export type Pensamiento = Tables<'pensamientos'>;
/** Una canción; en Juntos viene con el título del recuerdo al que se ligó */
export type DatosCancion = Tables<'canciones'> & { recuerdos?: { titulo: string } | null };

type Funciones = Database['public']['Functions'];
/** Lo que devuelve una función de la base (supabase.rpc) */
export type DeLaFuncion<F extends keyof Funciones> = Funciones[F]['Returns'];

export type CategoriaPregunta = Tables<'categorias_preguntas'>;
export type Respuesta = DeLaFuncion<'obtener_respuestas'>[number];

export type CartaEscrita = Tables<'cartas'>;
/** Una carta que me escribieron: si todavía no se puede abrir, llega sin contenido ni audio.
    (Los tipos generados no saben qué columnas de una función pueden venir vacías: se dicen aquí) */
export type CartaRecibida = Omit<DeLaFuncion<'cartas_recibidas'>[number], 'abierta_en' | 'abrir_desde' | 'audio' | 'contenido' | 'momento'> &
  Pick<CartaEscrita, 'abierta_en' | 'abrir_desde' | 'audio' | 'momento'> & { contenido: string | null };
/** Lo que tienen en común las cartas que escribo y las que recibo */
export type Carta = Pick<CartaEscrita, 'id' | 'de' | 'titulo' | 'emoji' | 'momento' | 'abrir_desde' | 'abierta_en' | 'audio'> & { contenido: string | null };

export type Capsula = Tables<'capsulas'>;
export type ItemCapsula = Tables<'capsula_items'>;

export type Sueno = Tables<'suenos'>;
export type Regalo = Tables<'regalos'>;
