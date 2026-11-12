# 07 · Plan de desarrollo

Nueve fases. Cada una entrega algo que se puede probar y termina solo cuando se cumplen sus criterios de aceptación. Trabajar una fase a la vez y detenerse al final para revisión.

## Resumen

| Fase | Entrega | Herramientas principales |
|---|---|---|
| 0 | Repositorio y entorno listos | pnpm, TypeScript, ESLint, Prettier, Vitest, Docker Compose |
| 1 | Paquete compartido con toda la lógica pura | TypeScript, Zod, Vitest |
| 2 | API pública | Fastify, Zod, capa de repositorios, Vitest |
| 3 | Autenticación y herramientas de terminal | argon2, cookies de sesión, rate-limit |
| 4 | API de administración y subida de imágenes | Fastify, sharp |
| 5 | Sitio público: menú, sorteo, boleta, mis números | React, Vite, React Router, TanStack Query, CSS Modules |
| 6 | Sitio público: ruleta | React, CSS, SVG |
| 7 | Panel de administración | React, Vite, Canvas |
| 8 | Endurecimiento, pruebas de extremo a extremo y despliegue | Playwright, Nginx, Docker Compose |

**Dependencia externa:** el esquema de base de datos se define aparte. Las fases 2 a 4 pueden avanzar con una implementación de repositorios **en memoria** para las pruebas; la implementación real se conecta cuando el esquema esté acordado.

---

## Fase 0 · Cimientos

**Objetivo:** un repositorio que compila, prueba y arranca vacío.

Tareas:

1. Espacios de trabajo de pnpm con `apps/api`, `apps/web-public`, `apps/web-admin` y `packages/shared`.
2. TypeScript en modo estricto, configuración base compartida.
3. ESLint, Prettier y un comando `pnpm verificar` que ejecute tipos, estilo y pruebas.
4. Vitest configurado en cada paquete.
5. `docker-compose.yml` de desarrollo.
6. `.env.example` con todas las variables de `docs/04` §7 y validación al arrancar.
7. API mínima con `GET /api/public/salud`.
8. Las dos interfaces arrancan con una página en blanco y las tipografías alojadas localmente.

Aceptación:

- [ ] `pnpm install && pnpm verificar` termina sin errores en una máquina limpia.
- [ ] `docker compose up` deja la API respondiendo en la ruta de salud.
- [ ] Ninguna interfaz carga recursos de otros dominios.

---

## Fase 1 · Lógica compartida

**Objetivo:** portar a `packages/shared` las funciones puras del prototipo, con pruebas.

Tareas: implementar todo lo listado en `docs/04` §5 y los esquemas Zod de las entradas de `docs/05`.

Casos de prueba mínimos:

| Función | Casos |
|---|---|
| Teléfono | `300 123 4567`, `+57 300-123-4567`, `573001234567`, 9 dígitos, empieza por 6 |
| Dinero | 0, 5000, 1000000 → `$0`, `$5.000`, `$1.000.000` |
| Lector de líneas | `01-02-03 Miguel 3001234567` · `05-07-99 Carlos` · `3109876543 Carlos Díaz` · `Ana Pérez 300 123 4567 - 4 8 15` · línea vacía · números repetidos |
| Lista final | Agrupa por persona, ordena, dos dígitos, libres opcionales, sin duplicados |
| Mensaje de cobro | Todas las variables; variable desconocida intacta; saludo por jornada |
| Color automático | "VIP Valle" → rojo; "Caribeña Día" → turquesa; "Otro" → azul |
| Columnas del menú | 1→2, 2→2, 3→3, 4→2, 5→3, 6→3 |
| Estado de pago | todos, ninguno, algunos |
| Giro | Con azar inyectado: fuerza 3 iguales, 2 iguales en las tres posiciones y ninguno. Con 100 000 tiros, las frecuencias se acercan a las probabilidades configuradas |

Aceptación:

- [ ] Cobertura de pruebas del paquete ≥ 90 %.
- [ ] Ninguna función depende de red, reloj global o base de datos sin que se le inyecte.

---

## Fase 2 · API pública

**Objetivo:** todas las rutas de `docs/05` §2 funcionando contra la capa de repositorios.

Tareas:

1. Interfaces de repositorio (`docs/05` §6) e implementación en memoria para pruebas.
2. Servicios: apartar, consultar, girar.
3. Rutas con validación de entrada y de salida.
4. Formato único de errores.
5. Límites de peticiones por ruta.
6. `ETag` en la lista de ocupados.
7. Implementación real de repositorios cuando el esquema esté definido.

Aceptación:

- [ ] Apartar es todo o nada: si un número está ocupado, no se guarda ninguno.
- [ ] Prueba de concurrencia: 20 peticiones simultáneas por el mismo número → exactamente una `201` y diecinueve `409`.
- [ ] Un celular existente conserva su nombre guardado al apartar.
- [ ] Segundo giro del mismo celular el mismo día → `409 ya_giro` con el resultado anterior.
- [ ] El cambio de día se calcula en hora de Colombia (probado con reloj simulado a las 23:59 y 00:01).
- [ ] `/config` no expone probabilidades.
- [ ] "Mis números" respeta la ventana de 7 días.

---

## Fase 3 · Autenticación y terminal

**Objetivo:** login seguro y gestión de administradores por terminal (`docs/06` §3 y §4).

Tareas:

1. Hash y verificación con argon2id.
2. Sesiones en base de datos y cookie `__Host-sesion`.
3. `POST /auth/login`, `POST /auth/logout`, `GET /auth/yo`.
4. Protección de sesión para todo `/api/admin/*` y comprobación de `Origin` en escrituras.
5. Límite de intentos de login.
6. Herramienta de terminal: `crear`, `clave`, `activar`, `desactivar`, `listar`, `cerrar-sesiones`.

Aceptación:

- [ ] Un administrador creado por terminal inicia sesión; uno desactivado no.
- [ ] El mensaje de error es idéntico para usuario inexistente y contraseña incorrecta.
- [ ] El sexto intento fallido en 15 minutos recibe `429`.
- [ ] Sin cookie, cualquier ruta de administración responde `401`.
- [ ] Una escritura con `Origin` distinto responde `403`.
- [ ] Cambiar la contraseña invalida las sesiones abiertas.
- [ ] La contraseña nunca aparece en registros ni en argumentos de la terminal.

---

## Fase 4 · API de administración y medios

**Objetivo:** todas las rutas de `docs/05` §3.

Tareas:

1. Sorteos: crear, editar, eliminar, listar.
2. Reservas: listar, fijos por texto, copiar fijos, marcar pago, liberar.
3. Contactos: buscar, importar, borrar.
4. Ruleta: configuración, prueba, ganadores, entregado, reiniciar tiro.
5. Diseño y ajustes, con validación del documento de `docs/03` §5.
6. Subida de imágenes según `docs/03` §6 y limpieza de archivos sin uso.
7. Auditoría de las acciones sensibles.

Aceptación:

- [ ] Las líneas de fijos con error se devuelven una a una, y las válidas se aplican.
- [ ] Copiar fijos salta los números ocupados y los informa.
- [ ] Eliminar un sorteo elimina sus reservas.
- [ ] Un archivo que no es imagen se rechaza aunque tenga extensión `.png`.
- [ ] Toda imagen guardada sale reprocesada, sin metadatos y dentro del tamaño máximo.
- [ ] La suma de probabilidades mayor que 100 se rechaza.
- [ ] "Probar la ruleta" no crea ningún giro.

---

## Fase 5 · Sitio público: sorteos

**Objetivo:** menú, página del sorteo, boleta y mis números, iguales al prototipo.

Tareas:

1. Tokens de color y tipografías (`docs/02` §2 y §3) como variables CSS.
2. Rutas `/sorteos`, `/sorteo/:id`, `/mis-numeros`.
3. Menú: título, consulta en línea, tarjetas, arte automático, grupos y cuadrícula sin huecos.
4. Sorteo: premios, tablero, "Al azar", barra fija, refresco cada 15 s.
5. Datos: búsqueda de contacto al escribir, conflicto de números.
6. Boleta con copiar Nequi y enlaces de WhatsApp.
7. Mis números.
8. Estados de carga, vacío y error en todas las pantallas.
9. Manifiesto, íconos y color de barra por pantalla.

Aceptación:

- [ ] A 375×667 no hay desplazamiento lateral en ninguna pantalla.
- [ ] Con 1, 2, 3, 4, 5 y 6 sorteos, la cuadrícula no deja huecos.
- [ ] Los premios en 0 no aparecen y los demás se reacomodan.
- [ ] Un número que otra persona aparta se tapa solo en menos de 20 s.
- [ ] Ante un conflicto, el cliente vuelve al tablero sin perder nombre ni celular.
- [ ] El botón de copiar copia solo los dígitos del Nequi.
- [ ] Tema claro y oscuro correctos en tablero, boleta y mis números.
- [ ] Todo se puede usar con teclado y lector de pantalla.

---

## Fase 6 · Sitio público: ruleta

**Objetivo:** la ruleta completa, con proforma base y espacios personalizables.

Tareas:

1. Proforma base: cielo, nubes, castillo, banderín, tablón de madera, botón LANZA y los cinco símbolos.
2. Animación de rodillos (`docs/02` §6.1).
3. Flujo: validar celular, pedir giro, animar, resultado, cuenta regresiva y paso a sorteos.
4. Regla de aparición: solo si está activa y no se ha jugado hoy.
5. Aviso de premio en el menú.
6. Lectura del documento de diseño: fondo, logo, mascota, máquina con ventana, botón, símbolos, tamaño de íconos y colores.
7. Modo de movimiento reducido.

Aceptación:

- [ ] A 375×667 se ven título, máquina, campo y botón sin desplazar.
- [ ] El resultado mostrado coincide siempre con el del servidor.
- [ ] Tras jugar, volver a abrir `/` lleva a `/sorteos` ese día.
- [ ] Con la ruleta apagada, `/` lleva a `/sorteos`.
- [ ] Sin ninguna imagen subida, la pantalla se ve completa.
- [ ] Con imagen de máquina y ventana ajustada, los símbolos quedan dentro del hueco a 375, 390 y 430 px de ancho.

---

## Fase 7 · Panel de administración

**Objetivo:** todas las pantallas de `docs/01` §7.

Tareas:

1. Login y protección de rutas.
2. Sorteos: lista, editor y gestión.
3. Lista final, mensajes de cobro y enlaces de WhatsApp.
4. Imagen del tablero en `canvas` (`docs/02` §7), con compartir, guardar y fondo por sorteo.
5. Contactos.
6. Ruleta: configuración, modo prueba, reinicio de tiro y ganadores.
7. Diseño: selectores de imagen, ajuste de máquina con vista previa, controles y restablecer.
8. Ajustes con vista previa del mensaje.

Aceptación:

- [ ] Todo el panel es usable a 375 px de ancho.
- [ ] Las acciones destructivas piden doble toque.
- [ ] La lista final no repite números ni personas.
- [ ] La imagen exportada coincide con el estado del sorteo y ningún texto se sale de su caja.
- [ ] Un cambio de diseño se ve en el sitio público al recargar.
- [ ] "Probar la ruleta" permite giros ilimitados sin guardar tiros.
- [ ] Cerrar sesión impide volver con el botón "atrás".

---

## Fase 8 · Endurecimiento y despliegue

**Objetivo:** en producción, en el VPS, con los dos dominios.

Tareas:

1. Pruebas de extremo a extremo con Playwright en perfiles de celular:
   - Cliente: ruleta → sorteos → apartar → boleta → mis números.
   - Dos clientes a la vez por el mismo número.
   - Administrador: login → crear sorteo → fijos → marcar pago → lista → imagen.
2. Cabeceras de seguridad y política de contenido.
3. Configuración de Nginx para ambos dominios y servidor por defecto mudo.
4. Certificado comodín y renovación automática.
5. Copias de seguridad programadas y una restauración de prueba.
6. Revisión de rendimiento en celular de gama media: primera pantalla en menos de 2 s con 4G.
7. Lista de verificación de `docs/06` §7 completa.

Aceptación:

- [ ] Todas las pruebas de extremo a extremo pasan.
- [ ] La lista de verificación de `docs/06` §7 está marcada por completo.
- [ ] Un administrador real creó un sorteo y un cliente real apartó un número desde su celular.

---

## Orden y paralelismo

- Las fases 0 a 4 son secuenciales.
- Las fases 5 y 6 pueden avanzar en paralelo una vez lista la fase 2.
- La fase 7 necesita las fases 3 y 4.
- La fase 8 cierra todo.

## Mejoras posteriores

No forman parte del prototipo. Evaluarlas después de publicar.

| Mejora | Valor |
|---|---|
| Cierre automático de ventas a la hora del sorteo | Evita reservas tardías |
| Registro del número ganador e historial | Transparencia y consulta |
| Vencimiento de reservas no pagadas | Libera números bloqueados |
| Duplicar un sorteo para el día siguiente con sus fijos | Ahorra trabajo diario |
| Segundo factor en el login | Más protección del panel |
| Actualización inmediata del tablero (SSE) | Menos conflictos |
| Rol de cobrador | Delegar el cobro sin dar acceso total |
| Sección `marca` en el diseño | Más control visual para el administrador |
| Exportar reservas y contactos a Excel | Respaldo y contabilidad |
