// Explicaciones cortas para entender el ciclo y acompañar sin invadir.
// Información general basada en guías de ginecología; no reemplaza una consulta.

export type Tema = { id: string; titulo: string; resumen: string; parrafos: string[]; puntos?: string[]; consultar?: string[] };

export const TEMAS: Tema[] = [
  {
    id: 'fases',
    titulo: 'Las fases del ciclo',
    resumen: 'Qué pasa en el cuerpo de un periodo al siguiente.',
    parrafos: [
      'Un ciclo va desde el primer día de un periodo hasta el día antes del siguiente. En adultas suele durar entre 21 y 35 días, y es normal que varíe unos días de un mes a otro.',
      'Menstruación (días 1 a 5, más o menos): el útero suelta la capa que preparó el ciclo anterior. Puede haber cólicos, cansancio y dolor de espalda.',
      'Fase folicular: el estrógeno sube y un óvulo madura. Muchas personas sienten más energía y mejor ánimo.',
      'Ovulación (a mitad del ciclo, aunque varía): se libera el óvulo. Los días anteriores y ese día son los de mayor probabilidad de embarazo.',
      'Fase lútea: la progesterona sube, la temperatura del cuerpo aumenta unas décimas y, si no hay embarazo, al final bajan las hormonas y llega el periodo. Suele durar entre 10 y 16 días y varía poco en cada persona.',
    ],
  },
  {
    id: 'spm',
    titulo: 'Síndrome premenstrual (SPM)',
    resumen: 'Los días antes del periodo pueden pesar, y no es "drama".',
    parrafos: [
      'El SPM son síntomas físicos y emocionales que aparecen en los días antes del periodo y se van cuando empieza o poco después: cansancio, hinchazón, senos sensibles, antojos, irritabilidad, tristeza o ansiedad.',
      'Se relaciona con cómo el cerebro responde a los cambios hormonales; no es algo que ella escoja ni "exagere".',
      'Ayudan el ejercicio suave, dormir bien, reducir sal, cafeína y alcohol, y que la carga de la casa no caiga toda en ella esos días.',
      'Cuando los cambios de ánimo son muy fuertes (tristeza profunda, desesperanza, ataques de rabia) y afectan su vida, puede ser trastorno disfórico premenstrual (TDPM), que tiene tratamiento.',
    ],
    consultar: ['Los síntomas le impiden trabajar, estudiar o estar con otros', 'Hay tristeza muy profunda o pensamientos de hacerse daño (en Colombia: línea 192, opción 4)'],
  },
  {
    id: 'dismenorrea',
    titulo: 'Dolor menstrual (dismenorrea)',
    resumen: 'Cuándo el cólico es común y cuándo hay que consultar.',
    parrafos: [
      'El cólico menstrual es muy común: lo causan sustancias (prostaglandinas) que hacen contraer el útero. Suele empezar uno o dos días antes o con el sangrado y dura dos o tres días.',
      'Ayudan el calor en el abdomen o la espalda, moverse suave y los antiinflamatorios que le haya indicado su médico, tomados apenas empieza el dolor.',
      'Si el dolor es tan fuerte que no la deja hacer su vida, empeora con los años o aparece en otros momentos del ciclo, puede ser dismenorrea secundaria (por ejemplo, endometriosis o miomas) y vale la pena consultar. No es normal "aguantarse" un dolor que incapacita.',
    ],
    consultar: ['Dolor que no mejora con analgésicos', 'Dolor con fiebre, desmayo o sangrado muy abundante', 'Dolor en las relaciones o al ir al baño', 'Dolor que cada vez es peor'],
  },
  {
    id: 'acompanar',
    titulo: 'Cómo acompañar sin invadir',
    resumen: 'Lo que suma y lo que mejor no.',
    parrafos: [
      'Lo que ves en esta sección es lo que ella decidió compartir. Úsalo para estar más atento, no para vigilar ni para sacar conclusiones por ella.',
      'Pregunta antes de suponer: "¿te traigo algo?" funciona mejor que "estás así por el periodo".',
      'Nunca uses la fase del ciclo para restarle importancia a lo que siente o a lo que dice. Si está molesta por algo, el motivo merece atención igual.',
      'Encárgate de cosas concretas sin que te lo pida: la comida, una vuelta, que haya analgésicos y productos en casa.',
      'Si ella deja de compartir algo, es su decisión y está bien. No hace falta preguntar por qué.',
    ],
    puntos: ['Sí: calor, comida, paciencia, escuchar, hacerse cargo', 'No: comentarios sobre su cuerpo, chistes sobre el periodo, "cálmate"'],
  },
  {
    id: 'fertil',
    titulo: 'La ventana fértil',
    resumen: 'Por qué son seis días y por qué no es exacta.',
    parrafos: [
      'Los espermatozoides pueden vivir hasta cinco días dentro del cuerpo y el óvulo unas 12 a 24 horas. Por eso la ventana fértil son los cinco días antes de la ovulación y el día de la ovulación.',
      'Los dos días antes de la ovulación y el mismo día son los de mayor probabilidad.',
      'La ovulación cambia de un ciclo a otro. Las pruebas de ovulación (LH) avisan uno o dos días antes, y la temperatura basal confirma después que ya ocurrió.',
    ],
  },
  {
    id: 'irregular',
    titulo: 'Ciclos irregulares',
    resumen: 'SOP, posparto, perimenopausia y anticonceptivos.',
    parrafos: [
      'Un ciclo se considera irregular cuando la duración varía más de 7 a 9 días entre un mes y otro, o cuando dura menos de 21 o más de 35 días.',
      'SOP (síndrome de ovario poliquístico): es común; los ciclos pueden ser largos o saltarse porque la ovulación no ocurre todos los meses.',
      'Posparto y lactancia: el periodo puede tardar meses en volver y los primeros ciclos son irregulares. Se puede ovular antes del primer periodo.',
      'Perimenopausia: desde los 40 más o menos, los ciclos se acortan, se alargan o se saltan.',
      'Anticonceptivos hormonales: con pastilla, anillo o parche el sangrado es por retiro, no un periodo natural. Con implante, inyección o DIU hormonal el sangrado puede cambiar o desaparecer.',
    ],
    consultar: ['Ciclos de menos de 21 días o más de 35 de forma repetida', 'Tres meses sin periodo sin estar en embarazo', 'Sangrado entre periodos o después de las relaciones'],
  },
];
