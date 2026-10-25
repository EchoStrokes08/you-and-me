// Tipos locales de la pantalla Historia (recuerdos, notas, canciones y con qué estados se llega).
import type { Tables } from '../../lib/database.types';
import type { Foto } from '../../lib/fotos';

/** Lo que la base llama "recuerdos" (las entradas de la historia). */
export type Recuerdo = Tables<'recuerdos'>;
/** Fila de configuracion (una sola, id = 1): nombres, apodos, fecha de inicio… */
export type Configuracion = Tables<'configuracion'>;
/** Nota de "Lo mejor para mí fue…" escrita por cualquiera de los dos. */
export type NotaRecuerdo = Tables<'notas_recuerdo'>;
/** Canción ligada a un recuerdo. */
export type CancionRecuerdo = Tables<'canciones'>;

/** Lo que se trae de fotos_recuerdo antes de firmar las URLs (uno por carpeta) */
export type FotoSinUrl = Omit<Foto, 'url'>;

/** Cita pasada que aún no tiene recuerdo, tal como la trae el select con los joins que usa la historia:
    fecha siempre viene (la pantalla filtra por días), por eso se deja como string */
export type CitaVivible = {
  id: string;
  fecha: string;
  lugar_personalizado: string | null;
  lugar_direccion: string | null;
  lugar_lat: number | null;
  lugar_lng: number | null;
  lugares: { nombre: string; lat: number | null; lng: number | null } | null;
  actividades: { nombre: string | null } | null;
  recuerdos: { id: string }[];
};

/** Los números que salen de las citas ya vividas: cuántas hay y qué se repite. */
export type EstadisticasCitas = { total: number; topCat?: string; topLugar?: string };

/** Sueno o reto del mes que llega a medias, listo para guardarse como recuerdo. */
export type RecuerdoInicial = { id?: string; mes?: string; titulo?: string; fecha?: string | null; archivos?: File[] };

/** Con qué "estado" de navegación se puede abrir Historia: guardar un sueno/reto,
    abrir una cita que pasó, abrir un recuerdo puntual o bajar hasta la copia de seguridad */
export type EstadoHistoria = {
  sueno?: RecuerdoInicial;
  reto?: RecuerdoInicial;
  /** id de la cita vivida a convertir en recuerdo */
  cita?: string;
  /** id del recuerdo que se quiere ver de una vez ("Un día como hoy") */
  abrir?: string;
  /** true: baja hasta el bloque de copia de seguridad */
  copia?: boolean;
};
