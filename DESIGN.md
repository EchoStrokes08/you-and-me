---
name: You and me
description: Un mar verde y tranquilo, hecho a mano para dos personas
colors:
  crema: "#F1F6EE"
  tarjeta: "#FFFFFD"
  pino: "#0E2A20"
  bosque-oscuro: "#17332A"
  bosque: "#1F6B4A"
  esmeralda: "#2F8F63"
  salvia: "#456B58"
  menta: "#CFE6D7"
  seleccion: "#E6F3EA"
  lima: "#C3E08A"
  durazno: "#F2B8A0"
  coral: "#A94E35"
  hondo: "#1F6B4A"
  alerta: "#B85A40"
  oceano: "#2C6E73"
  espuma: "#CFE9E4"
  ballena: "#4E86B4"
  ballena-panza: "#D8E8F3"
  mar-superficie: "#2B7A5C"
  mar-medio: "#165040"
  mar-fondo: "#0C2F27"
typography:
  display:
    fontFamily: "Fraunces, serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Fraunces, serif"
    fontSize: "1.65rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Fraunces, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  carta:
    fontFamily: "Fraunces, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Nunito, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Nunito, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    letterSpacing: "0.1em"
rounded:
  campo: "1rem"
  boton: "1.25rem"
  tarjeta: "1.75rem"
  mar: "2rem"
  pastilla: "9999px"
spacing:
  entre-tarjetas: "1rem"
  margen-pantalla: "1.25rem"
  dentro-tarjeta: "1.25rem"
  bajo-barra: "8rem"
components:
  button-primary:
    backgroundColor: "{colors.hondo}"
    textColor: "#FFFFFF"
    rounded: "{rounded.boton}"
    padding: "0.8rem 1.25rem"
    height: "3rem"
  button-soft:
    backgroundColor: "{colors.seleccion}"
    textColor: "{colors.bosque}"
    rounded: "{rounded.boton}"
    padding: "0.7rem 1.1rem"
    height: "2.75rem"
  button-soft-active:
    backgroundColor: "{colors.menta}"
  button-icon:
    backgroundColor: "{colors.tarjeta}"
    textColor: "{colors.bosque}"
    rounded: "{rounded.pastilla}"
    size: "2.875rem"
  chip:
    backgroundColor: "{colors.tarjeta}"
    textColor: "{colors.bosque}"
    rounded: "{rounded.pastilla}"
    padding: "0.55rem 1rem"
    height: "2.75rem"
  chip-active:
    backgroundColor: "{colors.hondo}"
    textColor: "#FFFFFF"
  card:
    backgroundColor: "{colors.tarjeta}"
    textColor: "{colors.bosque-oscuro}"
    rounded: "{rounded.tarjeta}"
    padding: "1.25rem"
  card-mar:
    backgroundColor: "{colors.mar-medio}"
    textColor: "#F3FBF5"
    rounded: "{rounded.mar}"
    padding: "1.5rem"
  input:
    backgroundColor: "#FBFDFB"
    textColor: "{colors.bosque-oscuro}"
    rounded: "{rounded.campo}"
    padding: "0.8rem 1rem"
    height: "3rem"
  fila-aviso:
    backgroundColor: "{colors.tarjeta}"
    textColor: "{colors.bosque-oscuro}"
    rounded: "{rounded.boton}"
    padding: "0.7rem 0.9rem 0.7rem 1rem"
  sobre:
    backgroundColor: "{colors.tarjeta}"
    textColor: "{colors.bosque-oscuro}"
    rounded: "{rounded.tarjeta}"
    padding: "4rem 1.25rem 1.1rem"
  sobre-nueva:
    backgroundColor: "{colors.seleccion}"
---

# Design System: You and me

## Overview

**Creative North Star: "Nuestro mar"**

La app es un pedazo de mar verde donde viven una ballena azul y sus acompañantes. Arriba, la superficie: crema clara, tarjetas casi blancas, mucho aire. Abajo, el fondo: algas que se mecen, burbujas, cardúmenes y siluetas que cruzan despacio, tan tenues que son paisaje y no contenido. Entre las dos cosas, el "mar" propiamente dicho: un bloque de degradado verde profundo que aparece una vez por pantalla, donde nada la mascota y van los números que importan (los días juntos).

Todo es redondo, blando y cercano, pero nunca infantil ni de plantilla: la serif Fraunces en cursiva le da voz de carta escrita a mano, y la Nunito redonda lleva lo práctico. El verde es la identidad; los cálidos (durazno, coral) aparecen en dosis muy pequeñas, solo cuando algo pide atención o cariño. Los momentos (abrir una carta, una cápsula, ver nacer un recuerdo, recibir un "Pienso en ti") tienen su propia coreografía; las pantallas de gestión se quedan quietas.

**Key Characteristics:**
- Un solo matiz dominante: verdes del pino al menta, con la ballena azul como único contrapunto frío.
- Un "mar" por pantalla, no más: es el lugar de la mascota, no un fondo de sección.
- Serif con cursiva para lo que se dice con cariño; sans redonda y pesada para lo que se toca.
- Radios grandes y pastillas; nada con esquinas duras.
- Modo claro y oscuro con los mismos nombres de token; `hondo` y `alerta` no cambian.
- El fondo vive (algas, burbujas, pasadas de mascotas) a opacidades de 4 % a 28 %.

## Colors

Una familia de verdes de mar de bosque, sobre una crema ligeramente verdosa, con un azul de ballena y dos cálidos de reserva.

### Primary
- **Bosque** (#1F6B4A; en oscuro #8FD3AC): el verde de la identidad. Íconos, enlaces, texto de acción, bordes de lo destacado, el anillo de foco.
- **Hondo** (#1F6B4A, igual en ambos modos): el mismo verde como relleno con texto blanco encima: botón principal, chip activo, pastilla del segmentado, sello del sobre. No se redefine en modo oscuro.
- **Esmeralda** (#2F8F63): foco de campos, cursor, barras de progreso, las ondas del "Pienso en ti", el aro del recuerdo recién guardado.
- **Lima** (#C3E08A): el destello sobre fondos hondos: el "&" del logo, íconos dentro de círculos verdes, la barra de progreso sobre el mar, la selección de texto.

### Secondary
- **Ballena** (#4E86B4) y **Panza de ballena** (#D8E8F3): exclusivos de la ilustración de la ballena azul. No se usan en la interfaz.
- **Océano** (#2C6E73; en oscuro #8FD0D0) y **Espuma** (#CFE9E4; en oscuro #1B3A3A): agua y olas alrededor de las mascotas.

### Tertiary
- **Coral** (#A94E35; en oscuro #F2A58C): texto de aviso, de error y de acciones que borran; la racha de la pregunta.
- **Durazno** (#F2B8A0; en oscuro #7A4434): fondo suave de un error o de un pendiente cálido, siempre con transparencia (20 a 25 %).
- **Alerta** (#B85A40, igual en ambos modos): el único relleno cálido con texto blanco: el contador de citas por confirmar.

### Neutral
- **Crema** (#F1F6EE; en oscuro #0C1613): el fondo de toda la app.
- **Tarjeta** (#FFFFFD; en oscuro #14221D): superficie de tarjetas, chips, botones de ícono y la barra de abajo.
- **Bosque oscuro** (#17332A; en oscuro #E3EFE7): texto principal y títulos.
- **Salvia** (#456B58; en oscuro #9DBBAA): texto secundario, fechas, etiquetas en mayúscula.
- **Menta** (#CFE6D7; en oscuro #2A4439): bordes, divisores, el esqueleto de carga, el riel del segmentado.
- **Selección** (#E6F3EA; en oscuro #1A3028): fondo de lo escogido o de lo propio (la pestaña activa, lo que tú guardaste en una cápsula, una carta nueva).
- **Pino** (#0E2A20): el velo detrás de las hojas (55 % de opacidad) y la base de las sombras.

### Named Rules
**La regla del relleno fijo.** `hondo` y `alerta` llevan texto blanco y valen lo mismo de día y de noche. Cualquier otro color cambia con el tema; nunca se pone texto blanco sobre `bosque`, porque de noche es claro.

**La regla de la gota cálida.** Coral, durazno y alerta juntos no pasan de un elemento por pantalla en reposo. Si todo avisa, nada avisa.

**La regla de la ballena.** Los azules son de la ballena. La interfaz no los toma prestados.

## Typography

**Display Font:** Fraunces (con serif genérica), pesos 400, 600 y 700, y cursiva 500
**Body Font:** Nunito (con sans-serif genérica), pesos 400, 600, 700 y 800

**Character:** Fraunces es la voz: blanda, con algo de letra antigua, y en cursiva suena a nota escrita a mano. Nunito es la mano: redonda, clara y pesada en todo lo que se toca.

### Hierarchy
- **Display** (700, 2.25 a 2.4rem, 1.05): el saludo del inicio y el título de cada sección. El logo sube a 3.5rem. Los números grandes del mar (2.9rem a 3.75rem) usan el mismo corte con `tabular-nums`.
- **Headline** (600, 1.65rem, 1.15): la pregunta del día; títulos dentro de hojas y diálogos van en 700 a 1.5rem o 2rem.
- **Title** (600, 1.125rem a 1.25rem, apretado): título de una tarjeta, de un recuerdo, de una fila.
- **Carta** (400, 1.2rem, 1.65): el cuerpo de una carta y lo guardado en una cápsula. Es el único texto largo en serif; el título de la carta va en cursiva 500 a 2.1rem.
- **Body** (400, 1rem, 1.5): texto corrido. El secundario baja a 0.875rem en salvia.
- **Label** (800, 0.75rem, 0.1em, mayúsculas): el rótulo pequeño sobre un grupo ("NOTAS DE VOZ DE…"). Botones y chips usan 800 y 700 sin mayúsculas.

### Named Rules
**La regla de la cursiva.** La cursiva de Fraunces se reserva para el apodo, el "&" del logo y los títulos de cartas. Es la voz cariñosa; en un botón o un rótulo se gasta.

**La regla del peso.** Todo lo que se toca va en Nunito 700 u 800. Un texto de acción en peso normal se lee como texto, no como botón.

## Layout

Una sola columna para celular: `max-w-lg` centrada, 1.25rem de margen lateral y 1rem entre bloques (`flex flex-col gap-4`). Hecha para 360 a 430 px de ancho; en pantallas más anchas la columna no crece.

La barra de navegación flota abajo (68 px de alto, radio 28 px, separada del borde por el área segura o 14 px), así que cada pantalla deja 8rem libres al final. Las pantallas completas (leer una carta, abrir una cápsula, entrar) respetan `env(safe-area-inset-top)` y `-bottom`.

El inicio va de lo vivo a lo guardado: saludo, el mar, la pregunta de hoy, lo pendiente (solo si hay), "Nosotros hoy", lo que viene, y los accesos en una rejilla de tres. Las listas son tarjetas apiladas; las rejillas internas son de 2, 3 o 4 columnas con 0.5rem de separación. Toda zona táctil mide mínimo 44 px.

## Elevation & Depth

Sistema híbrido y muy suave: las superficies se distinguen primero por tono (tarjeta casi blanca sobre crema) y por un borde de 1 px en menta translúcida; la sombra solo las despega un poco, siempre teñida de verde, nunca gris.

### Shadow Vocabulary
- **Suave** (`0 1px 2px rgba(14,42,32,0.04), 0 10px 30px -12px var(--sombra)`): tarjetas, sobres, hojas, la barra de abajo. `--sombra` es `rgba(31,107,74,0.22)` de día y `rgba(0,0,0,0.45)` de noche.
- **Fila** (`0 1px 2px rgba(14,42,32,0.04), 0 6px 18px -12px var(--sombra)`): avisos cortos y accesos, más livianos que una tarjeta.
- **Mar** (`0 20px 34px -22px rgba(14,42,32,0.7)`): el bloque de degradado; se siente hundido y pesado.
- **Botón** (`0 10px 20px -12px rgba(31,107,74,0.75)`): solo el botón principal; desaparece cuando está deshabilitado.
- **Foco de campo** (`0 0 0 4px rgba(47,143,99,0.14)`): halo esmeralda al escribir.

### Named Rules
**La regla de la sombra verde.** Ninguna sombra es negra ni gris en modo claro: todas salen de pino o de bosque.

**La regla de lo quieto.** Las sombras no cambian al tocar. La respuesta al toque es encogerse (`scale(0.97)`, 0.92 en botones de ícono), no levantarse.

## Shapes

Todo es redondo y nada es un círculo perfecto salvo lo que se toca con un dedo. Campos a 1rem; botones, filas y accesos a 1.25rem; tarjetas y sobres a 1.75rem; el mar y las hojas a 2rem; chips, segmentados, insignias y botones de ícono en pastilla completa. El anillo de foco hereda 12 px.

Los bordes son de 1 px en menta (1.5 px en campos y en lo destacado). Las olas, las colas de ballena y las siluetas del fondo son las únicas formas orgánicas; van como SVG dibujado, no como recortes de foto. La línea del tiempo de Historia es un riel fino con un punto hueco por recuerdo.

## Components

### Buttons
Firmes y blandos a la vez: se hunden al toque.
- **Shape:** radio 1.25rem, alto mínimo 3rem (principal) y 2.75rem (suave).
- **Primary (`.btn-primary`):** relleno hondo, texto blanco en 800, sombra de botón. Uno por pantalla o por hoja.
- **Soft (`.btn-soft`):** fondo selección, borde menta, texto bosque. Al presionar pasa a menta. Con `text-coral` es la acción que borra o cierra sesión.
- **Icon (`.btn-icon`):** círculo de 2.875rem en tarjeta con borde menta; siempre con `aria-label`.
- **Active / Focus:** `scale(0.97)` en 0.15 s; foco visible con contorno bosque de 2.5 px a 2 px de distancia. Deshabilitado: el principal pasa a un verde lavado sólido (hondo al 40 % sobre crema), no transparente, para que en las barras fijas no se vea lo de atrás; los demás, 40 % de opacidad.
- **Hover:** solo con mouse (`@media (hover: hover) and (pointer: fine)`): el principal se oscurece apenas, los suaves pasan a menta, chips y botones de ícono a selección, y filas, accesos y sobres marcan el borde. En el celular no hay hover, para que nada se quede pegado tras un toque.

### Chips
- **Style (`.chip`):** pastilla en tarjeta con borde menta, texto bosque en 700 a 0.9rem, alto mínimo 2.75rem.
- **State:** `data-active="true"` lo pasa a hondo con texto blanco. Con borde punteado es "ver más".
- **Segmentado (`.segmented`):** riel en menta translúcida con una pastilla honda que se desliza con resorte (`layoutId`) hasta la opción activa. Si las opciones no caben, bajan de renglón (radio 1.6rem); nunca se cortan en el borde.
- **Ideas (`ChipsConMas`):** listas largas de sugerencias en chips que bajan de renglón, con un chip punteado "Ver X más" / "Ver menos".

### Cards / Containers
- **Corner Style:** 1.75rem.
- **Background:** tarjeta; selección cuando es lo propio o lo escogido.
- **Shadow Strategy:** suave (ver Elevation).
- **Border:** 1 px menta translúcida; 1.5 px bosque cuando hay algo nuevo esperando.
- **Internal Padding:** 1.25rem; 1rem en tarjetas de lista. Las tarjetas no se anidan: lo de adentro se separa con una línea menta de borde a borde.

### Icons
- Un solo juego de íconos de trazo (2 px, puntas redondas, 24 px de caja) en `ui.tsx`. Lo que la base guarda como emoji (categorías de cita, tipos de plan) se dibuja con ese juego vía `IconoPlan`; el clima de una cita también (sol, nubes, niebla, lluvia, tormenta, gota). Los emojis quedan para lo que es contenido o ánimo (cómo nos sentimos, cápsulas), no para la interfaz.

### Inputs / Fields
- **Style (`.input`):** fondo casi blanco verdoso, borde menta de 1.5 px, radio 1rem, alto mínimo 3rem. La etiqueta va arriba en 800 a 0.875rem.
- **Focus:** borde esmeralda, fondo blanco y halo de 4 px. En un campo compuesto (texto y botón en una misma pastilla, como el de Payakan o el buscador del mapa) el halo va en la pastilla con `.campo-compuesto`.
- **Error:** un párrafo `role="alert"` en coral 700 sobre durazno al 25 %, radio 0.75rem. El aviso de que algo salió bien usa bosque sobre selección.

### Navigation
- **Barra de abajo:** flotante, radio 28 px, cinco pestañas con ícono de trazo de 23 px y rótulo de 0.75rem. La activa tiene un fondo selección que se desliza entre pestañas; el texto pasa de salvia 700 a bosque 800.
- **Hoja (`Hoja`):** sube desde abajo con resorte, esquinas superiores de 2rem, asa menta, velo pino al 55 %. Para lo que se usa poco (Ajustes) y para formularios cortos.
- **Fila (`.fila-aviso`):** un pendiente o un ajuste en una línea: ícono bosque, texto en 700, flecha. Mínimo 3.5rem de alto.

### El mar (`.card-hero`, componente `Mar`)
El bloque de identidad: degradado vertical de `mar-superficie` a `mar-fondo`, radio 2rem, texto claro (#F3FBF5), olas en movimiento al pie. Adentro nada la mascota principal y, más pequeños, sus acompañantes. Uno por pantalla; en la entrada ocupa todo el ancho sin radio y termina en una ola crema.

### El sobre (`.sobre`, `SolapaSobre`)
Una carta es un objeto: tarjeta con una solapa curva arriba y un sello circular hondo con una cola de ballena en lima. Tres estados: nueva (fondo selección, borde bosque), abierta (tarjeta normal) y bloqueada (crema, sin sombra, candado en el sello). Al abrirla por primera vez el sello se suelta, la solapa se levanta y la hoja sale del sobre (unos 1.8 s en total).

### Las mascotas
Ballena azul, tiburón ballena, cachalote u orca como principal; medusas, caballitos de mar, peces payaso o tortugas como acompañantes. Dibujadas en SVG con detalle (manchas, pliegues, soplo), con nado lento en bucle. También son el estado de carga ("Nadando hacia ti…") y el estado vacío.

## Do's and Don'ts

### Do:
- **Do** usar los tokens de `src/index.css` por nombre (`bg-tarjeta`, `text-bosque`, `border-menta`): así el modo oscuro sale solo.
- **Do** poner texto blanco únicamente sobre `hondo`, `alerta` o el mar.
- **Do** mantener un solo botón principal y un solo mar por pantalla.
- **Do** dar a cada zona táctil mínimo 44 px y `aria-label` a cada botón de solo ícono.
- **Do** usar la curva `cubic-bezier(0.16, 1, 0.3, 1)` para lo que entra y resortes de Framer Motion para lo que se desliza (pestañas, hojas).
- **Do** reservar las coreografías largas (más de 1 s) para los momentos: carta, cápsula, recuerdo nuevo, "Pienso en ti".
- **Do** mostrar la forma de lo que viene (`.esqueleto`) mientras carga, y una mascota con un texto cálido cuando no hay nada.
- **Do** escribir en español de Colombia, en segunda persona, con el tono del saludo ("Hiii, Ma vie").

### Don't:
- **Don't** cambiar el nombre "You and me", el verde, el saludo y los apodos, ni tocar la sección de flores amarillas (`/flores`).
- **Don't** usar los azules de la ballena en botones, enlaces o fondos de interfaz.
- **Don't** usar sombras negras o grises en modo claro, ni esquinas de menos de 1rem.
- **Don't** anidar tarjetas ni repetir el mar como fondo de sección.
- **Don't** subir la opacidad de la vida del fondo: es paisaje. Si compite con el contenido, sobra.
- **Don't** animar las pantallas de gestión (Admin, catálogos, Ajustes) más allá de la entrada escalonada de 0.32 s.
- **Don't** animar nada por dentro de un SVG (un `<g>` o un `<path>`), ni poner `filter` u `opacity` en un contenedor con hijos animados: obliga a repintar en cada cuadro y el celular se pone lento. Lo que se mueve en bucle es un elemento propio (un `<svg>` o un `<div>`) al que solo le cambian `transform` y `opacity`.
- **Don't** saltarse `prefers-reduced-motion`: todas las animaciones tienen que quedar en nada cuando el sistema lo pide.
- **Don't** proponer bares, vino o cocteles en ejemplos, ni pueblitos: son planes de Bogotá y no toman.
