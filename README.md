# El Pato de la Suerte — Paquete de especificación para desarrollo

Este paquete describe **qué hace y cómo se ve** el prototipo de la web app de sorteos, para reconstruirlo como software formal en una nueva sesión de Claude Code y desplegarlo en un VPS propio.

El prototipo se hizo como un único archivo HTML. Aquí se extrae **solo la lógica y la interfaz**. No se reutiliza Supabase ni Netlify.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `CLAUDE.md` | Reglas del proyecto. Va en la raíz del repositorio nuevo; Claude Code lo lee solo. |
| `docs/01-especificacion-funcional.md` | Todo lo que hace la app: pantallas, flujos, reglas de negocio, textos. |
| `docs/02-interfaz-y-sistema-de-diseno.md` | Colores, tipografías, componentes, medidas, animaciones y comportamiento responsive. |
| `docs/03-personalizacion-y-proforma.md` | Proforma base (diseño por defecto) y todo lo que el administrador puede cambiar subiendo imágenes. |
| `docs/04-arquitectura-y-stack.md` | Tecnologías recomendadas, estructura del repositorio y módulos. |
| `docs/05-contrato-api-y-datos.md` | Endpoints, formatos de respuesta, entidades e invariantes que la base de datos debe garantizar. |
| `docs/06-seguridad-y-despliegue-vps.md` | Login de administradores, subdominio privado, usuarios por terminal y despliegue en el VPS. |
| `docs/07-plan-de-desarrollo.md` | Fases, entregables, herramientas por fase y criterios de aceptación. |
| `referencia/prototipo.html` | El prototipo funcionando en modo prueba. Se abre con doble clic. Es la referencia visual y de comportamiento. |
| `referencia/reglas-servidor-referencia.sql` | Las reglas de servidor del prototipo (apartar, girar, consultar). **Solo para leer la lógica**, no para usar. |

## Decisiones ya tomadas

- La vista de clientes es pública. La de administración vive en **otro subdominio**, privado, detrás de usuario y contraseña.
- Los **administradores se crean desde la terminal** del servidor. No hay registro por web.
- Las **bases de datos se definen aparte**. Este paquete entrega el modelo lógico y las garantías que deben cumplir, no el esquema final.
- El despliegue es en un **VPS propio**.
- Todas las imágenes de personalización las **sube el administrador** desde su panel. La app trae una proforma base original que se ve bien sin subir nada.

## Datos pendientes

| Dato | Estado | Dónde se usa |
|---|---|---|
| Dominio público | Pendiente | `docs/06`, variable `PUBLIC_ORIGIN` |
| Subdominio de administración | Pendiente | `docs/06`, variable `ADMIN_ORIGIN` |
| Motor y esquema de base de datos | Se define aparte | `docs/05` da el modelo lógico |

En los documentos aparecen como `DOMINIO_PUBLICO` y `SUBDOMINIO_ADMIN`.

## Cómo empezar la sesión en Claude Code

1. Crea un repositorio vacío y copia dentro `CLAUDE.md`, la carpeta `docs/` y la carpeta `referencia/`.
2. Abre Claude Code en esa carpeta.
3. Pídele que lea `CLAUDE.md` y `docs/07-plan-de-desarrollo.md`, y que empiece por la **Fase 0**.
4. Avanza una fase a la vez. Cada fase termina con sus criterios de aceptación cumplidos.

Mensaje sugerido para arrancar:

> Lee CLAUDE.md y todos los archivos de docs/. Abre referencia/prototipo.html para entender el comportamiento. Luego ejecuta la Fase 0 de docs/07-plan-de-desarrollo.md y detente al terminarla para que yo revise.

## Diferencias obligatorias frente al prototipo

El prototipo tomó atajos que **no** deben pasar a la versión formal:

| En el prototipo | En la versión formal |
|---|---|
| El panel de administración se abre con un enlace "Administrar" en la página pública | No hay ningún enlace ni código de administración en el sitio público |
| Navegación con `#` en la misma página | Rutas reales (`/sorteos`, `/sorteo/:id`, `/mis-numeros`) |
| Las probabilidades de la ruleta se pueden leer desde el navegador | Las probabilidades solo existen en el servidor y en el panel |
| Clave de prueba `1234` | Usuarios reales con contraseña cifrada, creados por terminal |
| Datos en el navegador o en Supabase | API propia y base de datos propia |
| Tipografías cargadas desde Google Fonts | Tipografías alojadas en el propio servidor |
| "Mostrar la ruleta otra vez" solo borra un dato del navegador | Acción de administrador que reinicia el tiro de un celular en el servidor |

---

## Cómo correrlo en local (desarrollo)

Requisitos: Node.js 24 o superior. No hace falta instalar base de datos: se usa SQLite integrado en Node (`node:sqlite`), en `.data/pato.db`.

```bash
npm install
cp .env.example .env        # y completa SESSION_SECRET y SEMILLA_ADMIN_CLAVE
npm run semilla             # sorteos de ejemplo + administrador de desarrollo
npm run dev                 # API :3000 · sitio público :5173 · panel :5174
```

| Qué | Dirección |
|---|---|
| Sitio público | http://localhost:5173 |
| Panel de administración | http://localhost:5174 (usuario y contraseña de `SEMILLA_ADMIN_*` en `.env`) |
| API | http://localhost:3000/api/public/salud |

Otros comandos:

| Comando | Para qué |
|---|---|
| `npm run verificar` | Tipos de todo el repositorio + pruebas (Vitest) |
| `npm run build` | Compila `web-public` y `web-admin` a archivos estáticos |
| `npm run admin -- crear <usuario>` | Crea un administrador (pide la contraseña sin mostrarla). También `clave`, `activar`, `desactivar`, `listar`, `cerrar-sesiones` |
| `npm run recursos` | Instala los recursos gráficos de `resources/RECURSOS SORTEO` en el diseño (fondo, máquina, botón, símbolos, logo). La semilla lo hace sola si el diseño está vacío |
| `npm run iconos -w @pato/api -- logo.png` | Regenera los íconos de la app instalable a partir de un logo |

Estructura: `packages/shared` (lógica pura y tipos; los esquemas Zod en `@pato/shared/esquemas`), `packages/ui` (estilos, tipografías, símbolos y la ruleta), `apps/api` (Fastify + SQLite), `apps/web-public` y `apps/web-admin` (React + Vite).
