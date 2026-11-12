# 04 · Arquitectura y tecnologías

Recomendación de cómo construir la versión formal. Las tecnologías se eligieron por tres razones: un solo lenguaje en todo el proyecto, poco consumo en un VPS y facilidad de mantenimiento.

## 1. Vista general

```
                         Internet
                            │
                ┌───────────┴────────────┐
                │   Proxy inverso (TLS)  │
                └───┬────────────────┬───┘
     DOMINIO_PUBLICO│                │SUBDOMINIO_ADMIN
                    │                │
        ┌───────────▼───┐      ┌─────▼──────────┐
        │  web-public   │      │   web-admin    │   archivos estáticos
        │ (sitio cliente)│      │ (panel)        │
        └───────┬───────┘      └─────┬──────────┘
        /api/public/*           /api/admin/*
                └───────┬────────────┘
                 ┌──────▼──────┐
                 │     API     │  proceso único, solo en la red interna
                 └──┬───────┬──┘
            ┌───────▼─┐   ┌─▼─────────────┐
            │  Base   │   │ Almacén de    │
            │ de datos│   │ imágenes      │
            └─────────┘   └───────────────┘
```

Tres piezas desplegables y un paquete compartido:

| Pieza | Qué es | Quién la ve |
|---|---|---|
| `web-public` | Sitio de clientes | Cualquiera |
| `web-admin` | Panel de administración | Solo quien tenga el subdominio y credenciales |
| `api` | Servicio con las reglas de negocio | Nadie directamente; solo a través del proxy |
| `shared` | Tipos, validaciones y utilidades comunes | Código interno |

**Separación clave:** el proxy del dominio público solo deja pasar `/api/public/*`. Las rutas `/api/admin/*` solo existen en el subdominio de administración. El paquete `web-public` no contiene código, rutas ni textos del panel.

## 2. Tecnologías

| Capa | Tecnología | Por qué |
|---|---|---|
| Lenguaje | **TypeScript** en todo el proyecto | Un solo lenguaje; los tipos se comparten entre API y pantallas |
| Entorno de ejecución | **Node.js** (versión LTS vigente) | Estable y liviano para un VPS |
| Gestor de paquetes | **pnpm** con espacios de trabajo | Maneja bien un repositorio con varias piezas |
| API | **Fastify** | Rápido, con validación de entrada y salida integrada |
| Validación | **Zod** | Los mismos esquemas sirven en API y formularios |
| Acceso a datos | **Capa de repositorios** propia. Recomendado: **PostgreSQL** con **Drizzle ORM** | La base de datos se define aparte; la capa de repositorios aísla al resto del código de esa decisión |
| Interfaz | **React** + **Vite** | Proyecto estático, sin servidor de páginas; despliegue simple |
| Rutas en el navegador | **React Router** | Rutas reales en lugar de `#` |
| Datos en pantalla | **TanStack Query** | Caché, reintentos y refresco periódico del tablero |
| Estilos | **CSS Modules** + variables CSS | Los tokens del prototipo ya son variables CSS. No hace falta un framework de estilos |
| Tipografías | Paquetes **Fontsource** (alojadas en el propio servidor) | Sin dependencia de terceros en ejecución |
| Imágenes | **sharp** | Validar, redimensionar y convertir a WebP |
| Contraseñas | **argon2** (variante argon2id) | Estándar actual para guardar contraseñas |
| Sesiones | Cookie de sesión firmada, con las sesiones guardadas en la base de datos | Permite cerrar sesiones desde el servidor |
| Límite de peticiones | `@fastify/rate-limit` | Protege el login, la ruleta y las consultas por celular |
| Registro de eventos | **pino** (incluido en Fastify) | Registros estructurados |
| Pruebas unitarias y de API | **Vitest** | Rápido y compatible con Vite |
| Pruebas de extremo a extremo | **Playwright** | Emula celulares; ya se usó para validar el prototipo |
| Calidad de código | **ESLint** + **Prettier** + `tsc --noEmit` | |
| Contenedores | **Docker** + **Docker Compose** | Mismo entorno en desarrollo y en el VPS |
| Proxy inverso y TLS | **Nginx** + certificado comodín (ver `docs/06`) | Sirve los estáticos, las imágenes y separa los dos dominios |
| Tareas de terminal | Scripts de Node dentro de `api` | Crear y administrar usuarios administradores |

Alternativa válida para la interfaz si se prefiere algo más liviano: **Preact** con la misma estructura. No cambia nada del resto.

## 3. Estructura del repositorio

```
el-pato-de-la-suerte/
├── CLAUDE.md
├── docs/                         especificación (estos documentos)
├── referencia/                   prototipo y reglas de referencia
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts         arranque
│   │   │   ├── config.ts         variables de entorno validadas
│   │   │   ├── rutas/
│   │   │   │   ├── publicas/     sorteos, reservas, mis-numeros, ruleta, config
│   │   │   │   └── admin/        auth, sorteos, reservas, contactos, ruleta, diseno, ajustes, medios
│   │   │   ├── servicios/        reglas de negocio (reservar, girar, fijos, cobro)
│   │   │   ├── repositorios/     interfaces + implementación para la base de datos elegida
│   │   │   ├── medios/           subida y procesado de imágenes
│   │   │   ├── auth/             sesiones, contraseñas, protecciones
│   │   │   └── cli/              admin:create, admin:passwd, admin:disable, admin:list
│   │   └── test/
│   ├── web-public/
│   │   └── src/
│   │       ├── paginas/          Ruleta, Sorteos, Sorteo, MisNumeros
│   │       ├── componentes/      Tablero, TarjetaSorteo, Boleta, Rodillos, CampoCelular…
│   │       ├── estilos/          tokens.css, ruleta.css, menu.css
│   │       └── api/              cliente de /api/public
│   └── web-admin/
│       └── src/
│           ├── paginas/          Login, Sorteos, EditorSorteo, Gestion, Contactos, Ruleta, Diseno, Ajustes
│           ├── componentes/      SelectorImagen, AjusteMaquina, MiniTablero, ImagenTablero…
│           └── api/              cliente de /api/admin
├── packages/
│   └── shared/
│       └── src/
│           ├── esquemas/         esquemas Zod de entrada y salida
│           ├── telefono.ts       normalizar, validar, formatear
│           ├── dinero.ts         formato de pesos
│           ├── fechas.ts         "domingo 8 nov", hoy en Bogotá
│           ├── lineas.ts         lector de "01-02-03 Miguel 3001234567"
│           ├── cobro.ts          plantilla del mensaje y enlaces de WhatsApp
│           ├── temas.ts          colores de sorteo y color automático
│           ├── lista.ts          lista final agrupada por persona
│           └── simbolos.ts       símbolos de la ruleta
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/                    un archivo por dominio
│   └── scripts/                  copias de seguridad, despliegue
└── .env.example
```

## 4. Módulos y responsabilidades

| Módulo | Responsabilidad | Reglas en |
|---|---|---|
| Sorteos | Crear, editar, ocultar, eliminar y listar | `docs/01` §7.2–7.3 |
| Reservas | Apartar (todo o nada), fijos, pagos, liberar | `docs/01` §6.3, §7.4, §7.5 |
| Contactos | Banco celular–nombre; búsqueda al escribir | `docs/01` §6.3, §7.7 |
| Consulta | "Mis números" por celular | `docs/01` §6.4 |
| Ruleta | Giro diario, probabilidades, ganadores | `docs/01` §6.1, §7.8 |
| Diseño | Documento de personalización | `docs/03` |
| Medios | Subida, validación y limpieza de imágenes | `docs/03` §6 |
| Ajustes | Negocio, WhatsApp, plantilla de cobro | `docs/01` §7.6 |
| Autenticación | Login, sesiones, herramientas de terminal | `docs/06` |

## 5. Lógica que va en `shared`

Estas funciones existen en el prototipo y deben portarse con sus pruebas. Son puras: no dependen de red ni de base de datos.

| Función | Comportamiento |
|---|---|
| `normalizarTelefono` | Deja solo dígitos; quita `57` si quedan 12 |
| `telefonoValido` | `^3\d{9}$` |
| `formatearTelefono` | `300 123 4567` |
| `dinero` | `$10.000`, sin decimales ni espacios |
| `formatearFecha` | `domingo 8 nov` |
| `hoyBogota` | Fecha actual en `America/Bogota` |
| `horaCorta` | Quita espacios y puntos, pasa a mayúscula: `2:30PM` |
| `leerLinea` / `leerTexto` | Extrae celular, números y nombre de cada línea |
| `agruparPorPersona` | Agrupa reservas por celular, ordena números y personas |
| `listaFinal` | Texto `01-02-03 Nombre`, con libres opcionales |
| `mensajeCobro` | Sustituye las variables de la plantilla |
| `saludo` | "buenos días" / "buenas noches" según jornada |
| `enlaceWhatsApp` | `https://wa.me/57{celular}?text=…` |
| `temaDe` | Color del sorteo, explícito o automático por nombre |
| `columnasMenu` | 2 columnas si hay 1, 2 o 4 sorteos; 3 en otro caso |
| `estadoPago` | `pagado` / `pendiente` / `parcial` |
| `decidirGiro` | Resultado de la ruleta a partir de probabilidades y un generador de azar inyectable (para poder probarlo). **Solo se usa en el servidor** |

## 6. Decisiones de arquitectura

1. **El servidor es la única fuente de verdad.** El navegador guarda comodidades (último celular, tiro de hoy), nunca reglas.
2. **Unicidad en la base de datos.** `(sorteo, número)` y `(celular, fecha del giro)` son restricciones de unicidad. Apartar varios números ocurre en una sola transacción.
3. **Tablero casi en vivo por consulta periódica.** El cliente pide los ocupados cada 15 s, con respuesta `304` si nada cambió. Es suficiente para 100 números. **[Propuesto]** pasar a eventos enviados por el servidor (SSE) si se quiere actualización inmediata.
4. **Imagen del tablero generada en el navegador del administrador** con `canvas`, como en el prototipo. No carga al servidor y permite usar la hoja de compartir del celular.
5. **Sitios estáticos.** `web-public` y `web-admin` se compilan a archivos estáticos que sirve el proxy. Solo la API es un proceso vivo.
6. **Configuración pública en una sola llamada.** Al abrir el sitio se pide `/api/public/config` (nombre, WhatsApp, diseño, estado de la ruleta y premios). No incluye probabilidades.
7. **Zona horaria fija.** Toda lógica de "día" usa `America/Bogota`, sin depender del reloj del cliente ni de la zona del servidor.
8. **Sin datos de ejemplo en producción.** Los sorteos de muestra del prototipo solo sirven como semilla opcional de desarrollo.

## 7. Variables de entorno

| Variable | Ejemplo | Uso |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Puerto interno de la API |
| `PUBLIC_ORIGIN` | `https://DOMINIO_PUBLICO` | Origen permitido del sitio público; base de los links de sorteo |
| `ADMIN_ORIGIN` | `https://SUBDOMINIO_ADMIN` | Origen permitido del panel |
| `DATABASE_URL` | — | Conexión a la base de datos |
| `SESSION_SECRET` | 64 caracteres aleatorios | Firma de la cookie de sesión |
| `MEDIA_DIR` | `/var/lib/pato/medios` | Carpeta de imágenes |
| `MEDIA_BASE_URL` | `/medios` | Ruta pública de las imágenes |
| `TZ_NEGOCIO` | `America/Bogota` | Zona horaria de negocio |
| `RATE_LIMIT_*` | — | Límites por tipo de ruta |

Todas se validan al arrancar. Si falta una, la API no inicia y dice cuál.
