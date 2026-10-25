// Catálogo de opciones del ciclo: flujos, dolores, síntomas, ánimos, necesidades (lo que ella
// puede mandarle a la pareja con un toque) y lo demás que se puede registrar. Solo etiquetas
// legibles; lo usa la pantalla Ciclo y el formulario de registro diario.
import type { Anticonceptivo, Condicion, Fase, Flujo, Moco } from './tipos';

export const FLUJOS: [Flujo, string][] = [
  ['manchado', 'Manchado'],
  ['leve', 'Leve'],
  ['medio', 'Medio'],
  ['abundante', 'Abundante'],
];

export const DOLORES = ['Nada', 'Leve', 'Moderado', 'Fuerte'] as const;

export const SINTOMAS: [string, string][] = [
  ['colicos', 'Cólicos'],
  ['cabeza', 'Dolor de cabeza'],
  ['espalda', 'Dolor de espalda'],
  ['cansancio', 'Cansancio'],
  ['hinchazon', 'Hinchazón'],
  ['senos', 'Senos sensibles'],
  ['antojos', 'Antojos'],
  ['nauseas', 'Náuseas'],
  ['acne', 'Granitos'],
  ['insomnio', 'Dormí mal'],
  ['digestion', 'Digestión rara'],
  ['mareo', 'Mareo'],
];

export const ANIMOS: [string, string][] = [
  ['bien', 'Bien'],
  ['energia', 'Con energía'],
  ['tranquila', 'Tranquila'],
  ['sensible', 'Sensible'],
  ['irritable', 'Irritable'],
  ['triste', 'Triste'],
  ['ansiosa', 'Con ansiedad'],
  ['estres', 'Con estrés'],
  ['cariñosa', 'Cariñosa'],
];

// Lo que se le puede mandar a la pareja con un toque
export const NECESIDADES: [string, string][] = [
  ['espacio', 'Necesito espacio'],
  ['compania', 'Quiero compañía'],
  ['abrazo', 'Necesito un abrazo'],
  ['dulce', 'Antojo de algo dulce'],
  ['dolor', 'Tengo dolor fuerte'],
  ['descanso', 'Necesito descansar'],
  ['hablar', 'Quiero hablar'],
  ['mimos', 'Quiero mimos'],
];

export const MOCOS: [Moco, string][] = [
  ['seco', 'Seco'],
  ['pegajoso', 'Pegajoso'],
  ['cremoso', 'Cremoso'],
  ['clara', 'Como clara de huevo'],
  ['acuoso', 'Acuoso'],
];

export const CONDICIONES: [Condicion, string, string][] = [
  ['sop', 'SOP (ovario poliquístico)', 'Los ciclos pueden ser largos o variar mucho'],
  ['endometriosis', 'Endometriosis', 'Sirve para el informe y para avisos de dolor'],
  ['posparto', 'Posparto', 'Los primeros ciclos después de un parto son difíciles de predecir'],
  ['lactancia', 'Lactancia', 'La lactancia puede retrasar o espaciar los periodos'],
  ['perimenopausia', 'Perimenopausia', 'Ciclos que se acortan, se alargan o se saltan'],
];

export const ANTICONCEPTIVOS: [Anticonceptivo, string][] = [
  ['ninguno', 'Ninguno'],
  ['pastilla', 'Pastilla'],
  ['anillo', 'Anillo'],
  ['parche', 'Parche'],
  ['inyeccion', 'Inyección'],
  ['implante', 'Implante'],
  ['diu_hormonal', 'DIU hormonal'],
  ['diu_cobre', 'DIU de cobre'],
  ['otro', 'Otro'],
];

export const ES_HORMONAL = (a: Anticonceptivo) => !['ninguno', 'diu_cobre'].includes(a);
// Métodos con paquete de días activos y de descanso, donde el sangrado por retiro se puede predecir
export const CON_PAQUETE = (a: Anticonceptivo) => a === 'pastilla' || a === 'anillo' || a === 'parche';

export const NOMBRE_FASE: Record<Fase, string> = {
  menstrual: 'Menstruación',
  folicular: 'Fase folicular',
  ovulatoria: 'Mitad del ciclo',
  lutea: 'Fase lútea',
  premenstrual: 'Días antes del periodo',
  hormonal: 'Con anticonceptivo hormonal',
};

export const etiqueta = (lista: [string, string, ...unknown[]][], id: string) => lista.find(([k]) => k === id)?.[1] ?? id;
