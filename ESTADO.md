# ESTADO — El Pato de la Suerte

## Siguiente paso

1. Revisar el prototipo en local con el dueño (sitio público y panel) y anotar ajustes visuales.
2. Fase 8 de `docs/07`: Dockerfile + `docker-compose.yml`, Nginx para los dos dominios, cabeceras de seguridad/CSP, copias de seguridad de `.data/pato.db` y pruebas Playwright de extremo a extremo.
3. Pendiente del dueño: `DOMINIO_PUBLICO`, `SUBDOMINIO_ADMIN` y confirmar si se queda SQLite en producción o se pasa a PostgreSQL (solo cambia `apps/api/src/repositorios/`).

## Bitácora

### 2026-11-11 — Ticket editable, reinicio general de la ruleta y número de prueba
- Mensaje del ticket editable en Panel → Ajustes (`plantilla_ticket`, migración 2) con variables y vista previa; vacío = predeterminado. Líneas sin dato se quitan solas.
- Panel → Tragamonedas: "Reiniciar los tiros de hoy para todos". Borra los giros del día y guarda una marca `reinicio` que /config publica; los celulares olvidan su tiro guardado anterior a esa marca.
- Datos de prueba: todos los sorteos con número de cobro 3135950303 (titular "Miguel"); tiros de hoy reiniciados. Cambiar a los números reales antes de producción.

### 2026-11-11 — Retroalimentación de Miguel (cliente)
- Ruleta: sin mascota en el cielo (se quitó del diseño), sin línea de reglas ni placa del celular; la máquina queda más grande (308 px de ancho a 430×739). Las reglas solo se ven en "Probar la ruleta" del panel.
- Menú: siempre 2 columnas, sin texto de ayuda ni "libres" en las tarjetas.
- Sorteo: sin encabezado de marca (solo "← Todos los sorteos"), "Juega a las HORA" sin fecha, sin "Juega con…"; tablero arriba con "Cada número vale " y premios debajo.
- Al cambiar de pantalla o de paso se vuelve arriba.
- Abrir Nequi también en iPhone (ficha de App Store id1075378688).
- Corregido: tarjetas de premios con fondo blanco en móvil (clases n1/n2/n3 chocaban con las nubes del prototipo; ahora pv-1/pv-3).

### 2026-11-11 — Animación de inicio, ruleta a pantalla completa, colores y premios por sorteo
- Animación de bienvenida (logo, rayos, lluvia de monedas y tréboles, ~3 s, una vez por visita, se salta con un toque) y giro de bienvenida de los rodillos antes de pedir el celular.
- Ruleta con máquina: la sección mide 100svh y la máquina toma el espacio sobrante (unidades de contenedor), así nunca hay que desplazar (probado 375×667, 430×739, 1440×860).
- Celulares: se aceptan +57, 57, 0057 y 057; los campos muestran el número como 300 123 4567 al completarlo.
- Colores por sorteo: la página del sorteo toma el color del sorteo (botones, bordes, etiquetas, fondo) en tema claro y oscuro; el editor permite elegir uno de los 7 o un color propio (#RRGGBB).
- Premios rediseñados: franja de premio total con el color del sorteo, tarjetas con ícono, regla y ejemplo de qué cifras deben coincidir, y valor de la boleta aparte.

### 2026-11-11 — Cobro por sorteo y enlace público de prueba
- El ticket de WhatsApp va al número de cobro de cada sorteo (campo Nequi del editor); si un sorteo no tiene, al WhatsApp general de Ajustes.
- Número de cobro y titular ahora obligatorios al crear/editar un sorteo (servidor y formulario).
- Enlace público para el cliente: build del sitio público + `vite preview` (:4173) + túnel rápido de Cloudflare (`cloudflared tunnel --url http://127.0.0.1:4173`). Solo expone el sitio público; el panel sigue local. La dirección cambia cada vez que se reinicia el túnel; PUBLIC_ORIGIN en .env apunta a ella.
- Sorteo de prueba "Prueba Local" ocultado (no tenía número de cobro).

### 2026-11-11 — Finalizar por WhatsApp y pago por Nequi
- Boleta: botón **Finalizar y enviar mi ticket** abre el chat del recaudador (Ajustes → WhatsApp del recaudador) con un ticket estructurado con emojis (`mensajeTicket` en shared). Mis números usa el mismo ticket para lo pendiente.
- Bloque Nequi: copiar número, copiar valor exacto, botón Abrir Nequi (solo Android, por paquete com.nequi.MobileApp; sin enlace oficial con valor) y pasos.
- Cobro push de Nequi (notificación para aprobar en la app): requiere convenio con Nequi o pasarela aliada (Wompi, EBANX); pendiente de decisión del dueño.
- Local: WhatsApp del recaudador puesto en 3001234567 (número de ejemplo) solo para probar.

### 2026-11-11 — Recursos gráficos, scroll y responsive
- Arreglado el scroll con la rueda del mouse (`overflow-x: clip` en el body en vez de `hidden` en html y body).
- Ruleta ajustada al alto de la pantalla en celular y PC: la máquina personalizada se limita por alto (`--alto-maquina`) y la ventana de rodillos sigue calzando. Estilos nuevos en `packages/ui/src/formal.css`.
- Recursos de `resources/RECURSOS SORTEO` integrados: `npm run recursos` los carga en el diseño (ventana calibrada x15,5 y45 w69,5 h33,5); portadas automáticas por nombre (Caribeña, Paisita, VIP, resto "Diarios") y fondo por defecto de la imagen exportada en `packages/ui/src/recursos/`; íconos de la app desde el logo.
- Mejoras de interfaz: pasos Elige · Tus datos · Paga, números elegidos en la barra, libres en cada tarjeta, premios en una fila en PC, logo en el encabezado.

### 2026-11-10 — Primer prototipo funcional en localhost
- Monorrepo con espacios de trabajo de **npm** (pnpm no estaba instalado): `packages/shared`, `packages/ui`, `apps/api`, `apps/web-public`, `apps/web-admin`.
- Base de datos elegida: **SQLite integrado en Node 24** (`node:sqlite`). Las garantías de `docs/05 §5` son restricciones (UNIQUE sorteo+número, UNIQUE celular+fecha, CHECK de rango y formato, cascada, filas únicas).
- API Fastify con todas las rutas públicas y de administración de `docs/05`, login con argon2id, sesiones en base de datos, comprobación de `Origin`, límites de peticiones, subida de imágenes con sharp (reprocesado a WebP sin metadatos) y CLI de administradores.
- Sitio público (ruleta, menú, sorteo/boleta, mis números) y panel completo (sorteos, editor, gestión, imagen del tablero, contactos, tragamonedas, diseño, ajustes) portados del prototipo.
- 71 pruebas pasando (lógica compartida, API pública, autenticación y administración, incluida la de 20 peticiones simultáneas).
- Decisiones: en desarrollo la cookie se llama `sesion` (sin `Secure`, por ser http); en producción `__Host-sesion`. Los esquemas Zod se separaron en `@pato/shared/esquemas` para que no entren al paquete público.
- Abierto: "Reiniciar el tiro de hoy" borra el giro en el servidor, pero el navegador del cliente sigue recordando `giro_<fecha>` hasta que se borren sus datos. Sin Docker/Nginx todavía. Sin ESLint (solo `tsc` + Prettier). Sin repositorio git inicializado.

### 2026-11-11 — Panel por túnel público
- `ADMIN_ORIGIN` admite varios orígenes separados por coma (localhost + túnel); prueba nueva en `admin.test.ts`.
- `apps/web-admin/vite.config.ts`: `preview` en 4174 con proxy a `/api/admin` y `/medios`, solo hosts `.trycloudflare.com`.
- Panel compilado servido con `vite preview` + `cloudflared tunnel --url http://127.0.0.1:4174`. La URL del túnel cambia cada vez que se reinicia: hay que actualizarla en `ADMIN_ORIGIN` del `.env`.
- Mientras dure la prueba, el login del panel queda expuesto a internet (protegido con contraseña argon2 y límite de intentos). Cerrar el túnel al terminar.

### 2026-11-11 — Gestión del panel (pedido de Miguel)
- **Apartar desde el panel**: en Gestionar, "Apartar números" → elegir contacto guardado (búsqueda) o "Agregar contacto nuevo" (nombre + celular), tipo Normal/Fijo, tocar números en el tablero (ocupados tachados). `POST /api/admin/sorteos/:id/apartar`. Los fijos siguen siendo por sorteo.
- **Pagos por número**: cada participante muestra sus números (verde = pagado) y estado Pagado / Parcial · x de y / Por pagar. "Pagó todo" o "Pago parcial o liberar" para elegir números y marcarlos pagados, por pagar o liberarlos. El cobro solo incluye los pendientes. `PATCH /reservas` acepta `numeros`.
- **Liberados**: migración 3 tabla `liberados`; `POST /sorteos/:id/reservas/liberar` guarda historial. Sección "Números liberados" con los que siguen libres y "Copiar para ofrecerlos".
- **Contactos**: formulario nombre + celular (`POST /contactos`, no pisa existentes), "Editar" corrige nombre/celular y se aplica a sus reservas (`PUT /contactos/:tel`). Importar lista quedó plegado.
- Pruebas: `apps/api/test/gestion.test.ts` (8). Total 89.
- Ojo: el `.env` apareció renombrado a `.env.txt` y el API se cayó; se devolvió a `.env`.

### 2026-11-11 — Ticket nuevo, tablero en vivo y seguridad contra acaparamiento
- **Ticket**: plantilla predeterminada con el formato que pasó Miguel ("Soy, … / TENGO LOS NUMEROS: 56-76✅ / SORTEO / TOTAL / NEQUI / TITULAR"). Variables nuevas `{SORTEO}` y `{TITULAR}` (en mayúsculas); números unidos con guion.
- **Choque de reservas**: si otra persona aparta primero, la página dice cuáles números perdió, conserva los demás y ofrece "Apartar solo …" o "Cambiar por otros números". También avisa si un número elegido se ocupa mientras llena sus datos.
- **Tablero en vivo**: `GET /api/public/sorteos/:id/en-vivo` (Server-Sent Events, `servicios/envivo.ts`, revisa cada 1 s solo los sorteos con alguien mirando). Si en 5 s no llega nada (el túnel rápido de Cloudflare retiene el canal), la página revisa `/ocupados` cada 3 s con ETag. En el VPS con nginx el canal debe ir con `proxy_buffering off` (ya se manda `X-Accel-Buffering: no`).
- **Seguridad** (migración 4): cookie firmada `pato_disp` por navegador (sin pedir nada); sin cookie se usa un id fijo por red+navegador. Cada reserva guarda dispositivo e IP; tablas `dispositivos`, `intentos`, `alertas`; `ajustes.limite_dispositivo` (20 por defecto, 0 = sin límite), revisado dentro de la transacción.
  - Pasar el límite o estar bloqueado → no aparta, mensaje claro y botón "Pedir por WhatsApp" con los números ya escritos (`mensajePedido`). Alertas: `limite`, `bloqueado`, `varios_celulares` (≥4 celulares en un dispositivo), `misma_red` (solo aviso, por datos móviles compartidos).
  - Panel → pestaña **Seguridad**: límite, alertas (número en la pestaña y aviso en todo el panel), dispositivos con modelo/navegador, red, a nombre de quién, números por sorteo, intentos; bloquear (con opción de liberar lo no pagado) y desbloquear.
  - `IP_CABECERA` (env): cabecera con la IP real detrás de un proxy (`cf-connecting-ip` en el túnel). El límite de peticiones ahora cuenta por IP real.
- Pruebas: `apps/api/test/seguridad.test.ts` (12) + ticket y pedido en shared. Total 102.

### 2026-11-12 — Despliegue en el VPS (elpatodelasuerte.co)
- Repositorio: `github.com/CMejiaVergel/sorteo` (rama `main`, **público**: el nombre del subdominio del panel nunca va en el repo).
- VPS compartido (PM2 + nginx del sistema, sin Docker; se aparta de docs/06 §6.3 para seguir el resto del servidor). Proceso PM2 `elpato-api` en `127.0.0.1:3030`, con Node 24 propio en `/opt/node-24` (el sistema trae Node 20 para las otras apps).
- Rutas: código `/var/www/elpatodelasuerte` (con su `.env`, permisos 600), datos `/var/lib/elpatodelasuerte` (`pato.db` y `medios/`), estáticos `/srv/elpatodelasuerte/{web-public,web-admin}`, copias `/var/backups/elpatodelasuerte` (una por despliegue, últimas 30).
- nginx: `/etc/nginx/sites-available/elpatodelasuerte`, generado desde `deploy/nginx/sitio.conf.example` reemplazando `__ADMIN_HOST__` (cabeceras en `deploy/nginx/elpato-*-cabeceras.conf` → `/etc/nginx/snippets/`). Certificado individual con certbot `--nginx` (HTTP-01, renovación automática): decisión del dueño, el nombre del panel queda en los registros públicos de certificados.
- Desplegar: `git push` a `main` y en el VPS `/var/www/elpatodelasuerte/deploy/desplegar.sh`.
- Datos iniciales: copia de la base local (sorteos de muestra y reservas ficticias incluidos) y sus imágenes; sesiones borradas.
- 2026-11-13: DNS en Hostinger (A `@` y A del panel → 158.220.113.5, `www` CNAME) y certificados individuales emitidos con certbot `--nginx` (redirección a HTTPS, renovación automática con `certbot.timer`).
- Pendiente: cambiar la clave del administrador `miguel` (es la de desarrollo); sin `default_server 444` porque el nginx es compartido con otros sitios.

### 2026-11-13 — Sorteo diario: gratis, máximo por persona, apertura programada, reinicio, premios por símbolo y lista para WhatsApp
- **Migración 5** (reconstruye `sorteos` con las claves foráneas apagadas; el ejecutor de migraciones admite `{ sql, sinClaves }` y revisa `foreign_key_check`): `valor_boleta >= 0` solo si `gratis = 1`; columnas `gratis`, `max_por_celular` (0 = sin límite), `abre` (AAAA-MM-DDTHH:MM, hora de Bogotá), `imagen_agotado`, `lista_encabezado`, `lista_pie`. Tabla `cierres` (copia JSON de las reservas al reiniciar). `config_ruleta.premios_tres` (JSON por símbolo).
- **Todos vendidos**: con los 100 ocupados, el tablero público muestra la imagen del sorteo o la general (Diseño → “Todos los números vendidos”); sin imagen, un aviso con la moneda.
- **Reiniciar para un nuevo día** (Gestión → “Nuevo día del sorteo”, `POST /api/admin/sorteos/:id/reiniciar`): guarda el día en `cierres`, libera lo de los clientes, conserva los fijos (quedan por pagar) si se marca, limpia liberados y pone fecha y apertura nuevas. Repite la hora de apertura del día anterior.
- **Máximo por persona** (editor del sorteo): se revisa por celular dentro de la transacción de reserva (`LimiteCelular`, error `limite_celular`); el tablero no deja elegir más. El panel puede apartar sin límite. El límite por dispositivo de Seguridad sigue aparte.
- **Sorteo gratis**: valor 0, “¡GRATIS!” en el menú, ticket “¡Reserva exitosa!” con agradecimiento y sin datos de pago; Mis números no muestra deuda; la lista no lleva marcas.
- **Premios de la ruleta**: par igual + premio por trío de cada símbolo (vacío = el general de 3 en línea). La probabilidad de trío no cambia y los 5 símbolos salen por igual.
- **Apertura programada**: antes de `abre` el sorteo no aparece en `/sorteos`, el enlace directo responde `403 sin_abrir` con la hora (la página dice cuándo abre) y no se puede apartar.
- **Lista para el grupo** (`listaWhatsApp` en shared): encabezado (predeterminado `LISTADO DE PARTICIPANTES PARA {SORTEO} ({FECHA})`), FIJOS y PARTICIPANTES, `números- Nombre`, ✅ en lo pagado, parcial en dos líneas (pagado arriba, pendiente abajo), ❌ opcional con “Marcar no pagados”, libres opcionales y final propio. Variables: sorteo, loteria, fecha, dia, hora, jornada, valor, premio, ocupados, libres, personas (en MAYÚSCULAS = dato en mayúsculas).
- **Intro**: sin la franja blanca de abajo (era el piso de nubes de la ruleta); el cielo llena la pantalla.
- Pruebas: `apps/api/test/sorteo-diario.test.ts` y `packages/shared/test/sorteo-diario.test.ts`. Total 119.

### 2026-11-13 — Tamaño y posición de la pantalla de la ruleta
- Con una máquina nueva la ruleta se veía pequeña: solo recibía el espacio que dejaban título, celular y botón.
- `diseno.ruleta.disposicion`: escala (30–300 %) y desplazamiento x/y (−50…50 % del ancho/alto de pantalla) para título, máquina, campo del celular y botón LANZA. Por defecto 100/0/0 (sin cambios). Se aplica con variables CSS (`variablesDisposicion` en shared) y `transform` en `formal.css`: un bloque no empuja a los demás; celular y botón quedan al frente.
- Panel → Diseño → “Tamaño y posición en la pantalla”: pestañas por bloque, deslizadores con − y +, “como venía” y un celular de vista previa (iframe a `/ruleta/vista`, recibe el diseño sin guardar por `postMessage` del mismo origen).
- nginx del panel: CSP `frame-ancestors 'self'` (antes `'none'`) para permitir esa vista previa dentro del propio panel.
- Pruebas: `packages/shared/test/disposicion.test.ts` + API de diseño. Total 124.
- Corregido: las páginas HTML no recibían CSP, Referrer-Policy, Permissions-Policy ni HSTS (en nginx un `add_header` dentro de un `location` borra los del `server`). Ahora las cabeceras van en fragmentos incluidos en el server y en cada location con `add_header`; la configuración completa (con SSL) vive en `deploy/nginx/` y ya no depende de lo que escribió certbot.

### 2026-11-13 — Premio Unido (opcional por sorteo)
- Gana el número formado por la primera y la última cifra del resultado (si sale 4523, gana el 43). No aplica a todos los sorteos: se activa por sorteo en el editor (“Este sorteo da el premio Unido”) y desactivado queda en 0.
- Migración 6: `sorteos.premio_unido` (entero ≥ 0, 0 = no se da). Se muestra en la página del sorteo (4.ª tarjeta, ejemplo con la 1.ª y 4.ª cifra resaltadas; 2×2 en celular, una fila en pantallas anchas) y en la imagen del tablero.
- docs/01 y docs/05 actualizados. Pruebas: API (activar, desactivar, rechazar negativo) y migración 5→6. Total 126.
