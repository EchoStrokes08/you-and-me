# You and me 💚

App PWA (mobile-first) para parejas, con citas, preguntas y recuerdos.

## Stack
React + TypeScript + Vite · Tailwind CSS v4 · Framer Motion · Supabase (Postgres, Auth, Storage, Realtime) · Open-Meteo para el clima.

## Archivos importantes
- `supabase/migrations/001_esquema.sql` — tablas, RLS, funciones y buckets.
- `supabase/migrations/002_respuestas_mapa_preguntas.sql` — arregla la política de respuestas, agrega `estado_respuestas()`, columnas de lugar desde el mapa en `citas` y 94 preguntas más.
- `supabase/migrations/003_mapa_lugares.sql` — coordenadas en `lugares` y `recuerdos` (para la sección "Nuestros lugares") y ubicación aproximada de los lugares del catálogo.
- `supabase/seed.sql` — catálogos, lugares, actividades, franjas y 120 preguntas.
- `supabase/migrations/014_editar_recuerdos.sql` — quien creó un recuerdo puede borrar todas sus fotos (para editar y borrar recuerdos desde la app).
- `supabase/migrations/015_voz_capsulas.sql` — notas de voz (Pienso en ti y cartas), cápsulas del tiempo, bucket privado `adjuntos` y sus avisos.
- `scripts/run-sql.mjs` — ejecuta un SQL contra tu proyecto: `npm run db:sql -- ruta/archivo.sql` (lee `DATABASE_URL` de `.env`).

## Crear las dos cuentas y roles
1. En Supabase Dashboard → Authentication → Users → **Add user** crea dos usuarios con correo y contraseña:
   - Tu correo (tú, admin)
   - El correo de ella (pareja)
2. Ve a Table Editor → `perfiles` y cambia el `rol` de tu fila a `admin`. La de ella queda en `pareja`.
3. **Obligatorio:** desactiva el registro público en Authentication → Sign In / Providers → **Allow new users to sign up** (apagado). La migración `006_bloquear_registros.sql` bloquea además cualquier cuenta nueva desde la base de datos; créalas antes de aplicarla (o desactiva el trigger un momento, ver el archivo).

## Variables de entorno
Copia `.env.example` a `.env` (ya incluido) con:
```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_PUBLISHABLE_KEY
```
Para los scripts de `scripts/` agrega también, **solo en tu `.env` local**:
```
DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.TU-PROYECTO.supabase.co:5432/postgres
```
`.env` está en `.gitignore`. Ni `DATABASE_URL` ni la service role key van en el frontend ni en Vercel.

## Notificaciones push
Cuando uno propone, confirma, cambia o cancela una cita, responde la pregunta del día, guarda un recuerdo o deja una nota, al otro le llega una notificación.

- `supabase/migrations/008_notificaciones.sql` — tabla `suscripciones_push` y triggers que llaman a `/api/notificar` con `pg_net`.
- `api/notificar.ts` — función de Vercel que arma el mensaje y lo envía con `web-push`.
- `public/push-sw.js` — muestra la notificación y abre la sección correcta al tocarla.

Configuración:
1. En Vercel agrega `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `NOTIF_SECRETO` (los valores están en tu `.env`) y redespliega.
2. En tu `.env` pon `NOTIF_URL=https://TU-APP.vercel.app/api/notificar` y corre `npm run db:notificaciones`.
3. Cada uno abre la app instalada y toca **Activar notificaciones** en el inicio. En iPhone solo funciona con la app agregada a la pantalla de inicio (iOS 16.4+).

## Desarrollo
```
npm install
npm run dev
```

## Pruebas
`npm test` corre las pruebas de la lógica que no necesita navegador ni base (`tests/`, con Vitest): fechas, mesiversarios y cumpleaños, links de calendario, qué ideas de cita salen en cada lugar, el archivo .ics y los mensajes de las notificaciones (incluido que una cita sorpresa no le cuente a ella a dónde van).

`npm run test:db` revisa las funciones SQL y las reglas de seguridad (quién ve qué respuesta, cartas bloqueadas, roles, regalos secretos, recuerdos). Corre dentro de una transacción que se deshace al final: no guarda nada ni envía notificaciones. Necesita `DATABASE_URL` en `.env`.

## Copia de seguridad
Al final de **Historia** está **Descargar copia**: un .zip con `recuerdos.html` (se abre en cualquier navegador, con fotos y audios), las carpetas `fotos/`, `voz/` (notas de voz de cartas y de "Pienso en ti") y `capsulas/`, y `datos.json` con todo en bruto. Cada uno descarga lo que puede ver: las cartas sin abrir y los regalos que ya le compraron no salen. En iPhone se abre el menú de compartir → **Guardar en Archivos**.

## Copia automática
La copia de arriba depende de acordarse. Esta no: `npm run copia` guarda en una carpeta de este computador (`COPIA_DESTINO`, o `Copias You and me` en tu carpeta de usuario) todo lo que vive en Supabase.

- `datos/AAAA-MM-DD.json` — todas las tablas tal cual, las dos cuentas (id y correo) y la lista de archivos. Se conservan las 30 más recientes.
- `archivos/<bucket>/…` — fotos, videos y audios. Solo descarga los nuevos y nunca borra uno ya copiado: si algo se borra por error en la app, ahí sigue.
- `registro.txt` — cuándo corrió y cómo le fue.

Incluye lo que todavía es secreto (cartas sin abrir, cápsulas cerradas, regalos): no es para leerla, es para restaurar. Si quieres que además quede fuera del computador, pon `COPIA_DESTINO` en una carpeta sincronizada (OneDrive, Drive) o en un disco externo.

Configuración, una sola vez:
1. En tu `.env` agrega `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys → la *secret key*). Sin ella se copian los datos pero no las fotos ni los audios, y la copia queda marcada como incompleta.
2. `npm run copia:programar` la deja corriendo sola cada domingo a las 11 a. m. (Programador de tareas de Windows, tarea "You and me - copia"). Si el computador estaba apagado, corre apenas se prenda.

Cada copia completa actualiza `configuracion.ultima_copia`, así que el aviso de "hace 30 días no guardas una copia" pasa a ser la alarma de que la automática dejó de correr.

**Revisar que una copia sirve:** `npm run restaurar -- "C:\ruta\Copias You and me"` carga cada tabla en una gemela temporal, la compara con la base, revisa que estén todos los archivos y deshace todo. No guarda nada.

**Restaurar de verdad** (si se perdiera el proyecto de Supabase):
1. Crea un proyecto nuevo y aplica todas las migraciones en orden (`npm run db:sql -- supabase/migrations/001_esquema.sql`, etc.).
2. Crea las dos cuentas con los mismos correos (ver "Crear las dos cuentas y roles").
3. Pon en `.env` el `DATABASE_URL`, `VITE_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto nuevo.
4. `npm run restaurar -- "C:\ruta\Copias You and me" --de-verdad`

Reemplaza lo que dejaron las migraciones por lo de la copia, cambia los ids viejos de las cuentas por los nuevos y sube los archivos. Si la base ya tiene recuerdos, citas, respuestas o cartas, no hace nada. La prueba sí se ha corrido contra la base real; la restauración de verdad no se ha ensayado en un proyecto nuevo.

## Contraseñas
- **Cambiarla:** Ajustes → *Cambiar mi contraseña*.
- **Si se olvida:** en la pantalla de entrada, *¿Olvidaste tu contraseña?* manda un correo con un link; al abrirlo, la app pide la contraseña nueva. Para que el link vuelva a la app, en Supabase → Authentication → URL Configuration el *Site URL* debe ser la dirección de la app en Vercel (y `http://localhost:5173` en *Redirect URLs* si se prueba en local). El correo lo manda Supabase con su servicio de pruebas, que tiene un límite de pocos correos por hora.

## Novedades de la migración 025
- **Reacciones:** debajo de la respuesta del otro se le puede dar corazón o contestarle (`reacciones_respuesta`).
- **Preguntas propias:** cada uno escribe preguntas en secreto (`preguntas_propias`); más o menos una de cada tres veces sale una como pregunta del día.
- **Recordatorio de copia:** solo al admin, cuando lleva 30 días sin descargar la copia (`configuracion.ultima_copia`, cron `avisar-copia`).
- **Recuerdos sin señal:** si no hay conexión al guardar un recuerdo nuevo, queda en el teléfono (IndexedDB) y se sube solo al volver la señal (`src/lib/recuerdosPendientes.ts`).

## Novedades de las migraciones 026 a 031
- **026:** cualquiera de los dos marca como vivida una cita confirmada que ya pasó; las notas de un recuerdo se pueden borrar; lugares por conocer en el mapa (`lugares_por_conocer`); fotos favoritas (`marcar_favorita`); regalos con ocasión; cada uno escoge qué avisos recibe por grupos (`perfiles.avisos_silenciados`, Ajustes → *Qué avisos me llegan*); el ánimo del otro llega en vivo.
- **027 y 028:** citas con sentido. Cada lugar por conocer dice qué tipo de plan es, y cada idea a qué tipos de plan pertenece y en qué momentos del día sirve, para que "Ármame una cita" no arme combinaciones raras. "Comodín" significa "sirve en cualquier lugar de su tipo de plan".
- **029:** las tortugas entran como acompañante marino.
- **030:** el permiso de admin sale de `perfiles.rol` a la tabla `permisos`. `rol` sigue diciendo quién es quién; `permisos.es_admin` dice quién ve el panel. Solo se cambia desde el SQL Editor (los comandos están al inicio de la migración).
- **031:** en el panel, ver en qué celulares están activas las notificaciones de cada uno, mandar una de prueba y escoger la pregunta de un día.

## Ciclo (migración 034)

`/ciclo` (se abre desde Ajustes): control menstrual con cifrado de extremo a extremo. Todo se cifra en el celular con Web Crypto (AES-256-GCM, llavero protegido con la "clave del ciclo" vía PBKDF2 de 600.000 vueltas y un código de recuperación); la base, el admin y las copias de seguridad solo ven sobres cifrados. Lo compartido con la pareja va cifrado para su llave pública (ECDH P-256) y revocarlo borra la fila al instante, sin notificar. Los avisos para la pareja solo dicen "te dejó algo". Opción "solo en este celular" (IndexedDB). La lógica está en `src/lib/ciclo/` con pruebas en `tests/ciclo-*.test.ts`; las reglas de acceso, en `npm run test:db`. Si se olvidan la clave y el código, nadie puede recuperar los datos.

## Clima y calendario
El clima de cada cita se pide para el lugar real (del mapa o del catálogo) y, si hay hora confirmada, para esa hora; si el lugar no tiene ubicación, se usa Bogotá. `api/ics.ts` devuelve la cita como archivo .ics (Calendario del iPhone, Outlook) con aviso 2 horas antes.

## Modo oscuro
Automático según el celular. Los colores están en `src/index.css`: en modo oscuro se redefinen las variables. `hondo` y `alerta` son los rellenos con texto blanco encima y no cambian.

## Desplegar en Vercel
1. Sube la carpeta `you-and-me` a GitHub.
2. En Vercel → New Project → importa el repo.
3. Agrega las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy.

## Instalar en el celular
- **iPhone:** Safari → Compartir → "Agregar a pantalla de inicio".
- **Android:** Chrome → menú → "Instalar app".

## Decisiones de diseño (anotadas)
- Zona horaria asumida `America/Bogota` en textos del calendario y en la función `obtener_pregunta_del_dia()`.
- `lugares.es_escapada` se agregó para preseleccionar "Día completo".
- El WhatsApp de la configuración es el tuyo; el botón "Avisarle por WhatsApp" abre un chat contigo.
- Las fotos de catálogo van al bucket `catalogo`; las de recuerdos al bucket privado `recuerdos` con URLs firmadas (1 h).
- Los datos de ejemplo en coquetas son originales; algunas notas dicen "verificar" para que confirmes horarios en el panel.
