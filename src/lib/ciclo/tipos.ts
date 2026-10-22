// Tipos de la sección del ciclo. Todo esto vive cifrado: el servidor solo guarda sobres que no puede abrir.

export type Flujo = 'manchado' | 'leve' | 'medio' | 'abundante';
export type ResultadoLH = 'negativo' | 'positivo' | 'pico';
export type Moco = 'seco' | 'pegajoso' | 'cremoso' | 'clara' | 'acuoso';
export type Fuente = 'manual' | 'apple' | 'archivo';

// Lo que se registra de un día
export type Dia = {
  fecha: string; // YYYY-MM-DD
  flujo?: Flujo;
  dolor?: 0 | 1 | 2 | 3; // nada, leve, moderado, fuerte
  animo?: string[];
  sintomas?: string[];
  energia?: 1 | 2 | 3;
  temperatura?: number; // basal, °C, al despertar
  tempMuneca?: number; // de un reloj o anillo (absoluta o desviación: solo importan los cambios)
  fcReposo?: number; // pulsaciones en reposo
  lh?: ResultadoLH;
  embarazo?: 'negativo' | 'positivo';
  moco?: Moco;
  relaciones?: boolean; // solo para quien busca embarazo; nunca se comparte
  necesidades?: string[]; // lo que mandó a su pareja ese día
  nota?: string;
  fuentes?: Partial<Record<keyof Dia, Fuente>>;
  actualizado: number;
};

export type Condicion = 'sop' | 'posparto' | 'lactancia' | 'perimenopausia' | 'endometriosis';
export type Anticonceptivo = 'ninguno' | 'pastilla' | 'anillo' | 'parche' | 'inyeccion' | 'implante' | 'diu_hormonal' | 'diu_cobre' | 'otro';
export type Modo = 'ninguno' | 'buscar' | 'evitar';

// Qué ve la pareja. "Nada" es activo = false
export type Permisos = {
  activo: boolean;
  periodo: boolean; // fechas del periodo (pasadas y próximas)
  fase: boolean; // en qué fase va
  animo: boolean;
  sintomas: boolean;
  fertil: boolean; // ventana fértil
  planificacion: boolean; // pruebas de ovulación, temperatura y embarazo (si buscan embarazo)
};

export type Alertas = {
  antesPeriodo: boolean;
  diasAntes: 1 | 2 | 3;
  compras: boolean;
  productos: string; // lo que conviene tener en casa, con sus palabras
  diaDificil: boolean; // avisar cuando registra dolor fuerte o un día pesado
  ventanaFertil: boolean; // solo en modo buscar
};

export type Ajustes = {
  version: 1;
  cicloTipico: number;
  periodoTipico: number;
  condiciones: Condicion[];
  anticonceptivo: Anticonceptivo;
  // Pastilla, anillo o parche: cuándo empezó el paquete actual y cuántos días activos y de descanso tiene
  paquete?: { inicio: string; activos: number; descanso: number };
  // Inyección: cuándo fue la última y cada cuánto toca (mensual o trimestral)
  inyeccion?: { ultima: string; cada: 30 | 90 };
  partoFecha?: string;
  modo: Modo;
  buscandoDesde?: string; // desde cuándo buscan embarazo (para contar los ciclos)
  avisoEvitarAceptado: boolean;
  compartir: Permisos;
  alertas: Alertas;
  // Huella de la llave de la pareja la primera vez que se compartió (si cambia, se pregunta antes de seguir)
  huellaPareja?: string;
  consentimiento: { version: string; fecha: string };
};

export const PERMISOS_NADA: Permisos = { activo: false, periodo: false, fase: false, animo: false, sintomas: false, fertil: false, planificacion: false };

export const ALERTAS_APAGADAS: Alertas = { antesPeriodo: false, diasAntes: 2, compras: false, productos: '', diaDificil: false, ventanaFertil: false };

// Lo que se puede escribir como duración típica: el periodo puede ser de cualquier largo dentro de un ciclo
export const MIN_CICLO = 15;
export const MAX_CICLO = 120;
export const MAX_PERIODO = 30;

export const VERSION_CONSENTIMIENTO = '2026-10-20';

export const ajustesIniciales = (fecha: string): Ajustes => ({
  version: 1,
  cicloTipico: 28,
  periodoTipico: 5,
  condiciones: [],
  anticonceptivo: 'ninguno',
  modo: 'ninguno',
  avisoEvitarAceptado: false,
  compartir: PERMISOS_NADA,
  alertas: ALERTAS_APAGADAS,
  consentimiento: { version: VERSION_CONSENTIMIENTO, fecha },
});

// Una conversación con Payakan desde Aprender. Solo existe cifrada con la llave del ciclo
export type Charla = { id: string; titulo: string; creada: string; actualizada: string; turnos: { rol: 'user' | 'assistant'; contenido: string }[] };

export type Fase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea' | 'premenstrual' | 'hormonal';
export type Tramo = { fase: Fase; desde: string; hasta: string; estimado: boolean };
