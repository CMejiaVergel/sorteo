# 05 · Contrato de la API y modelo de datos

La base de datos **se define aparte**. Este documento fija dos cosas que no dependen del motor elegido:

1. El **contrato de la API**: qué pide y qué responde cada ruta.
2. El **modelo lógico** y las **garantías** que la base de datos debe cumplir.

## 1. Convenciones

- Formato JSON, UTF-8. Nombres de campos en español y `snake_case`, como en el prototipo.
- Identificadores opacos (UUID recomendado).
- Fechas `AAAA-MM-DD`; marcas de tiempo en ISO 8601 UTC.
- Dinero en pesos enteros, como número.
- Celulares normalizados: 10 dígitos.
- Números del tablero como enteros de 0 a 99. El formato de dos dígitos es solo de presentación.

### Errores

Todas las respuestas de error usan la misma forma:

```json
{ "error": { "codigo": "numeros_ocupados", "mensaje": "Alguien acaba de apartar 23, 48.", "detalle": { "ocupados": [23, 48] } } }
```

| HTTP | Cuándo |
|---|---|
| 400 | Petición mal formada |
| 401 | Sin sesión (solo panel) |
| 403 | Origen no permitido o falta de permiso |
| 404 | No existe o no está disponible |
| 409 | Conflicto: número ya ocupado, giro ya hecho |
| 422 | Datos que no pasan la validación |
| 429 | Demasiadas peticiones |

El `mensaje` va en español y se puede mostrar tal cual al usuario.

## 2. API pública — `/api/public`

Sin autenticación. Con límite de peticiones por IP.

### `GET /config`

Configuración para pintar el sitio. Una llamada al abrir.

```json
{
  "negocio": "El Pato de la Suerte",
  "whatsapp": "3001234567",
  "diseno": { "ruleta": { "…": "ver docs/03 §5" }, "tablero": { "logoOcupado": null } },
  "ruleta": { "activo": true, "premio_tres": "Un número gratis", "premio_dos": "$1.000 de descuento" }
}
```

No incluye probabilidades.

### `GET /sorteos`

Sorteos activos, ordenados por `orden`, `fecha`, `creado`.

```json
[
  {
    "id": "…", "nombre": "Paisita Día", "loteria": "Paisita Día",
    "jornada": "dia", "fecha": "2026-11-08", "hora": "2:30 p. m.",
    "valor_boleta": 10000, "premio_total": 700000,
    "color": "naranja", "etiqueta": "", "orden": 3,
    "imagen": "/medios/ab12.webp", "libres": 92
  }
]
```

### `GET /sorteos/:id`

Detalle de un sorteo activo, con todo lo que muestra su página.

```json
{
  "id": "…", "nombre": "Paisita Día", "loteria": "Lotería de Medellín", "logo_loteria": null,
  "jornada": "dia", "fecha": "2026-11-08", "hora": "2:30 p. m.",
  "valor_boleta": 10000, "premio_total": 700000,
  "premio_ultimas": 500000, "premio_medio": 100000, "premio_primeras": 100000,
  "nequi": "3001234567", "nequi_titular": "Nombre del titular",
  "color": "naranja", "imagen": null, "logo_ocupado": null,
  "ocupados": [1, 2, 3, 5, 7, 23, 48, 99]
}
```

`404` si no existe o está oculto.

### `GET /sorteos/:id/ocupados`

Solo la lista de ocupados, para el refresco cada 15 s. Admite `ETag` / `If-None-Match` y responde `304` si no cambió.

```json
{ "ocupados": [1, 2, 3, 5, 7, 23, 48, 99] }
```

Nunca devuelve nombres ni celulares.

### `GET /contactos/:telefono`

Para rellenar el nombre al escribir el celular.

```json
{ "nombre": "Carlos Díaz" }
```

`404` si no está. Límite estricto por IP (ver `docs/01` §9).

### `POST /sorteos/:id/reservas`

Aparta números. Todo o nada.

Petición:

```json
{ "numeros": [5, 7, 99], "nombre": "Carlos Díaz", "telefono": "3109876543" }
```

Respuesta `201`:

```json
{ "nombre": "Carlos Díaz", "numeros": [5, 7, 99], "total": 30000 }
```

`nombre` es el que quedó guardado: si el celular ya era un contacto, se devuelve el nombre existente.

Errores:

| Código | HTTP | Caso |
|---|---|---|
| `sorteo_no_disponible` | 404 | No existe o está oculto |
| `telefono_invalido` | 422 | No cumple el formato |
| `nombre_invalido` | 422 | Menos de 2 caracteres |
| `cantidad_invalida` | 422 | Fuera de 1–30 |
| `numero_fuera_de_rango` | 422 | Fuera de 0–99 |
| `numeros_ocupados` | 409 | `detalle.ocupados` trae cuáles |

### `GET /mis-numeros?telefono=3109876543`

```json
{
  "nombre": "Carlos Díaz",
  "sorteos": [
    {
      "id": "…", "nombre": "Paisita Día", "fecha": "2026-11-08", "hora": "2:30 p. m.", "jornada": "dia",
      "valor_boleta": 10000, "nequi": "3001234567", "nequi_titular": "Nombre del titular",
      "color": "naranja", "imagen": null,
      "numeros": [5, 7, 99], "pagados": [5]
    }
  ]
}
```

Alcance: sorteos activos o con fecha dentro de los últimos 7 días. Orden: fecha descendente, luego nombre. Sin reservas: `sorteos` vacío.

### `POST /ruleta/giro`

Petición: `{ "telefono": "3109876543" }`

Respuesta `200` (tiro nuevo):

```json
{ "resultado": ["trebol", "trebol", "siete"], "gano": 2, "premio": "$1.000 de descuento" }
```

`gano` vale `0`, `2` o `3`. `resultado` es la fila del medio, de izquierda a derecha.

Errores:

| Código | HTTP | Caso |
|---|---|---|
| `ya_giro` | 409 | Ya jugó hoy. `detalle` trae `resultado`, `gano` y `premio` del tiro anterior |
| `ruleta_inactiva` | 409 | Ruleta apagada |
| `telefono_invalido` | 422 | |

## 3. API de administración — `/api/admin`

Solo disponible en el subdominio de administración. Todas las rutas, salvo el login, exigen sesión válida. Toda escritura comprueba el origen de la petición.

### Autenticación

| Ruta | Función |
|---|---|
| `POST /auth/login` | `{ usuario, clave }` → crea la sesión. Respuesta genérica si falla |
| `POST /auth/logout` | Cierra la sesión |
| `GET /auth/yo` | Usuario actual, o `401` |

### Sorteos

| Ruta | Función |
|---|---|
| `GET /sorteos` | Todos, incluidos ocultos, con `ocupados` (cantidad) |
| `POST /sorteos` | Crea. Admite `fijos` como texto; responde con las líneas que fallaron |
| `GET /sorteos/:id` | Detalle completo |
| `PUT /sorteos/:id` | Edita |
| `DELETE /sorteos/:id` | Elimina con sus reservas |
| `GET /sorteos/:id/reservas` | Reservas con nombre, celular, tipo y pago |
| `POST /sorteos/:id/fijos` | `{ texto }` → `{ agregadas, errores[] }` |
| `POST /sorteos/:id/fijos/copiar` | `{ origen_id }` → copia fijos; informa los números saltados |
| `PATCH /sorteos/:id/reservas` | `{ telefono, pagado }` → marca todos los números de esa persona |
| `DELETE /sorteos/:id/reservas?telefono=` | Libera los números de esa persona |

Campos de un sorteo: `nombre`, `loteria`, `jornada`, `fecha`, `hora`, `orden`, `color`, `etiqueta`, `activo`, `valor_boleta`, `premio_total`, `premio_ultimas`, `premio_primeras`, `premio_medio`, `premio_unido`, `nequi`, `nequi_titular`, `imagen`, `logo_loteria`, `logo_ocupado`, `fondo_imagen`.

### Contactos

| Ruta | Función |
|---|---|
| `GET /contactos?q=` | Busca por nombre o celular; hasta 300 |
| `PUT /contactos` | `{ texto }` → crea o actualiza en lote; devuelve las líneas inválidas |
| `DELETE /contactos/:telefono` | Borra el contacto, no sus reservas |

### Ruleta

| Ruta | Función |
|---|---|
| `GET /ruleta` | Configuración completa, con probabilidades |
| `PUT /ruleta` | `{ activo, prob_tres, premio_tres, prob_dos, premio_dos }` |
| `POST /ruleta/prueba` | Devuelve un resultado simulado con las probabilidades reales. No guarda nada |
| `GET /ruleta/giros?ganadores=1` | Giros premiados, del más reciente al más antiguo; y el total de tiros |
| `PATCH /ruleta/giros/:id` | `{ reclamado }` |
| `DELETE /ruleta/giros?telefono=&fecha=hoy` | Reinicia el tiro de hoy de un celular |

Validación: `prob_tres` y `prob_dos` entre 0 y 100, y su suma no mayor que 100.

### Diseño, ajustes y medios

| Ruta | Función |
|---|---|
| `GET /diseno` · `PUT /diseno` | Documento de personalización (`docs/03` §5) |
| `DELETE /diseno` | Vuelve a la proforma base |
| `GET /ajustes` · `PUT /ajustes` | `{ negocio, whatsapp, plantilla }` |
| `POST /medios` | Subida `multipart` con `uso` (`fondo`, `maquina`, `portada`, `logo`, `simbolo`…). Responde `{ url }` |
| `DELETE /medios` | `{ url }` → borra un archivo sin uso |

## 4. Modelo lógico

```
Ajustes (único) ──── Diseño (documento)
ConfigRuleta (única)

Sorteo 1 ───── N Reserva N ───── 1 Contacto (por celular)
Contacto 1 ─── N Giro (por celular)

Administrador 1 ─── N Sesión
Medio (archivo de imagen)
```

### Entidades

**Sorteo**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | identificador | |
| `nombre` | texto | Obligatorio |
| `loteria` | texto | |
| `jornada` | `dia` \| `noche` | |
| `fecha` | fecha | |
| `hora` | texto | Libre |
| `valor_boleta` | entero | Mayor que 0 |
| `premio_total`, `premio_ultimas`, `premio_primeras`, `premio_medio`, `premio_unido` | entero | 0 = no se muestra. `premio_unido` (primera y última cifra) es opcional por sorteo |
| `nequi`, `nequi_titular` | texto | |
| `color` | texto | Vacío = automático |
| `etiqueta` | texto | Grupo especial |
| `orden` | entero | |
| `activo` | sí/no | Visible para clientes |
| `imagen`, `logo_loteria`, `logo_ocupado`, `fondo_imagen` | ruta | Opcionales |
| `creado` | marca de tiempo | |

**Reserva**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | identificador | |
| `sorteo_id` | referencia | Se borra con el sorteo |
| `numero` | entero 0–99 | |
| `telefono` | texto | |
| `nombre` | texto | Copia del nombre al momento de apartar |
| `tipo` | `cliente` \| `fijo` | |
| `pagado` | sí/no | |
| `creado` | marca de tiempo | |

**Contacto:** `telefono` (clave), `nombre`, `creado`.

**ConfigRuleta (única):** `activo`, `prob_tres`, `premio_tres`, `prob_dos`, `premio_dos`.

**Giro:** `id`, `telefono`, `fecha` (día en Bogotá), `resultado` (3 símbolos), `gano` (0, 2 o 3), `premio`, `reclamado`, `creado`.

**Ajustes (único):** `negocio`, `whatsapp`, `plantilla`, `diseno`.

**Administrador [Nuevo]:** `id`, `usuario` (único), `clave_hash`, `activo`, `creado`, `ultimo_ingreso`.

**Sesión [Nuevo]:** `id`, `admin_id`, `creada`, `expira`, `ip`, `agente`.

**Medio [Recomendado]:** `id`, `ruta`, `uso`, `ancho`, `alto`, `peso`, `creado`. Permite limpiar archivos sin uso.

**Auditoría [Recomendado]:** `id`, `admin_id`, `accion`, `entidad`, `entidad_id`, `detalle`, `creado`. Registra pagos marcados, números liberados, sorteos eliminados y cambios de probabilidad.

## 5. Garantías que debe cumplir la base de datos

Sea cual sea el motor, estas reglas no pueden depender solo del código:

| # | Garantía | Cómo |
|---|---|---|
| 1 | Un número no se repite dentro de un sorteo | Unicidad `(sorteo_id, numero)` |
| 2 | Un celular gira una sola vez por día | Unicidad `(telefono, fecha)` en giros |
| 3 | Apartar varios números es todo o nada | Una transacción por operación |
| 4 | `numero` siempre entre 0 y 99 | Restricción de rango |
| 5 | Celular con formato válido | Restricción `^3[0-9]{9}$` |
| 6 | Eliminar un sorteo elimina sus reservas | Borrado en cascada |
| 7 | Solo hay una fila de ajustes y una de configuración de ruleta | Clave fija |
| 8 | `usuario` de administrador único | Unicidad |

Ante dos peticiones simultáneas por el mismo número, la restricción 1 hace fallar a la segunda. La API convierte ese fallo en el error `numeros_ocupados`, nunca en un error genérico.

## 6. Capa de repositorios

El resto del código solo conoce estas interfaces. Cambiar de motor de base de datos significa reescribir su implementación, nada más.

```ts
interface RepoSorteos {
  listarActivos(): Promise<SorteoResumen[]>;
  listarTodos(): Promise<SorteoAdmin[]>;
  obtener(id: string): Promise<Sorteo | null>;
  guardar(datos: SorteoEntrada, id?: string): Promise<Sorteo>;
  eliminar(id: string): Promise<void>;
}

interface RepoReservas {
  ocupados(sorteoId: string): Promise<number[]>;
  porSorteo(sorteoId: string): Promise<Reserva[]>;
  /** Transacción. Lanza NumerosOcupados si alguno ya existe. */
  apartar(sorteoId: string, numeros: number[], persona: Persona, tipo: 'cliente' | 'fijo'): Promise<void>;
  marcarPago(sorteoId: string, telefono: string, pagado: boolean): Promise<void>;
  liberar(sorteoId: string, telefono: string): Promise<void>;
  porTelefono(telefono: string, desde: string): Promise<ReservasPorSorteo[]>;
}

interface RepoContactos {
  buscar(telefono: string): Promise<Contacto | null>;
  buscarPorNombre(nombre: string): Promise<Contacto | null>;
  listar(q?: string): Promise<Contacto[]>;
  crearSiNoExiste(c: Contacto): Promise<Contacto>;   // al apartar: conserva el nombre guardado
  guardar(lista: Contacto[]): Promise<void>;         // panel: actualiza el nombre
  eliminar(telefono: string): Promise<void>;
}

interface RepoRuleta {
  config(): Promise<ConfigRuleta>;
  guardarConfig(c: ConfigRuleta): Promise<void>;
  giroDe(telefono: string, fecha: string): Promise<Giro | null>;
  /** Lanza YaGiro si viola la unicidad (telefono, fecha). */
  registrar(g: GiroNuevo): Promise<Giro>;
  ganadores(): Promise<Giro[]>;
  marcarReclamado(id: string, reclamado: boolean): Promise<void>;
  reiniciar(telefono: string, fecha: string): Promise<void>;
}

interface RepoAjustes {
  obtener(): Promise<Ajustes>;
  guardar(a: Partial<Ajustes>): Promise<void>;
}

interface RepoAdmins {
  porUsuario(usuario: string): Promise<Admin | null>;
  crear(usuario: string, claveHash: string): Promise<Admin>;
  cambiarClave(usuario: string, claveHash: string): Promise<void>;
  activar(usuario: string, activo: boolean): Promise<void>;
  listar(): Promise<Admin[]>;
}
```

`referencia/reglas-servidor-referencia.sql` contiene las mismas reglas escritas como funciones de base de datos en el prototipo. Sirve para contrastar el comportamiento, no para copiar la estructura.
