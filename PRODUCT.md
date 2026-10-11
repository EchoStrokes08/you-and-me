# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos personas: Oscar (cuenta admin) y su pareja (cuenta pareja). Nadie más la usa ni la va a usar. La abren en el celular, instalada como PWA, en ratos cortos del día: responder la pregunta, mandar un "Pienso en ti", planear una cita, guardar un recuerdo después de salir. Viven y salen en Bogotá.

## Product Purpose

Un lugar privado de los dos para cuidar la relación en lo cotidiano: planear citas, conocerse más con una pregunta diaria, guardar lo vivido con fotos, y dejarse cosas para después (cartas, cápsulas, regalos). El éxito no es engagement: es que a los dos les den ganas de abrirla y que lo guardado se sienta valioso con los años.

## Positioning

No es un producto para "parejas" en general: está hecha para estas dos personas, con sus apodos, sus lugares de Bogotá, sus ballenas y sus flores amarillas. Todo lo que parezca plantilla o app de catálogo traiciona eso.

## Operating Context

- Celular, 360 a 430 px de ancho, PWA instalada (iPhone con safe areas y Android).
- Modo claro y oscuro automáticos según el sistema, con opción manual en Ajustes.
- Notificaciones push cuando el otro hace algo (cita, respuesta, recuerdo, nota, carta disponible).
- Rituales reales: la pregunta del día (cada uno responde antes de ver la del otro), cartas que solo se abren en una fecha o en un momento ("cuando estés triste"), cápsulas del tiempo, "Un día como hoy", resumen del año en diciembre y enero.

## Capabilities and Constraints

- Secciones: Inicio, Citas (asistente para proponer, confirmar, editar), Preguntas (pregunta del día y modo cartas), Historia (recuerdos con fotos, notas, canciones, copia de seguridad), Nuestros lugares (mapa Leaflet), Cartas y cápsulas, Juntos (por hacer, regalos secretos, canciones), Resumen del año, Admin, Ajustes.
- Stack: React + TypeScript + Vite, Tailwind v4, Framer Motion, Supabase.
- El rediseño es solo de presentación: no se tocan lógica de negocio, consultas a Supabase, migraciones, `api/`, `public/push-sw.js` ni `scripts/`.
- Textos en español de Colombia.
- Colores como tokens semánticos en `src/index.css`, redefinidos para modo oscuro. `hondo` y `alerta` llevan texto blanco encima y no cambian entre modos.
- Fuentes con `font-display: swap` y solo los pesos usados. Sin librerías pesadas nuevas sin consultar.
- Pendiente aparte (lógica, no hace parte del rediseño): generalizar las ideas de cita del catálogo y permitir proponer una idea propia con presupuesto.

## Brand Commitments

- Nombre: "You and me".
- El verde es parte de la identidad.
- Las ballenas son muy importantes y se quedan; a ella le encantan las ballenas azules. Deben estar mejor dibujadas, menos genéricas.
- El saludo y los apodos ("Hiii, Ma vie") y el tono cariñoso e informal se conservan.
- La sección especial de flores amarillas (`/flores`) no se toca.
- No debe parecer una app genérica ni una plantilla de SaaS: debe verse diseñada a mano para dos personas específicas.

## Evidence on Hand

Datos reales de la pareja en Supabase (citas, respuestas, recuerdos con fotos, cartas, lugares). Las capturas de la app real viven en `.design/antes/` y `.design/despues/` y no se versionan. Las maquetas usan contenido de ejemplo, no datos reales.

## Product Principles

1. Hecha para dos: cada pantalla debe poder reconocerse como suya aunque se le quite el logo.
2. Lo guardado es valioso: recuerdos, cartas y cápsulas se tratan como objetos que se conservan, no como filas de una lista.
3. Los momentos mandan: abrir una carta, ver la respuesta del otro, abrir una cápsula, guardar un recuerdo y recibir un "Pienso en ti" merecen más cuidado que cualquier pantalla de gestión.
4. El estilo nunca le gana a la lectura: contraste, tamaño táctil y claridad primero.

## Accessibility & Inclusion

Contraste AA en ambos modos, foco visible, etiquetas en botones de solo icono, zonas táctiles de mínimo 44 px, y alternativa sin movimiento con `prefers-reduced-motion`.
