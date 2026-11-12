# 03 · Personalización y proforma base

El administrador cambia la apariencia **subiendo imágenes y moviendo controles en su panel**. No toca código ni archivos del servidor.

## 1. Principio: proforma base + reemplazos

- La **proforma base** es el diseño por defecto. Está hecha con ilustraciones propias dibujadas en código (SVG y CSS), no con archivos de imagen.
- Cada elemento personalizable es un **espacio** (slot). Si el espacio está vacío, se usa la proforma base. Si tiene imagen, la imagen reemplaza al dibujo por defecto.
- Quitar una imagen devuelve ese espacio a la proforma base.
- "Volver al diseño original" vacía todos los espacios de la ruleta de una vez (con doble toque).
- La app debe verse completa y correcta **sin subir ninguna imagen**.

Las imágenes que suba el administrador deben ser propias o con licencia de uso.

## 2. Qué trae la proforma base

| Zona | Diseño por defecto |
|---|---|
| Ruleta · fondo | Cielo azul en degradado, dos nubes y un banco de nubes inferior |
| Ruleta · máquina | Castillo de piedra con almenas, banderín rojo "¡Gira y gana!", banderas, gemas y cristales |
| Ruleta · símbolos | Moneda, trébol, herradura, siete y diamante |
| Ruleta · botón | Tecla roja "LANZA" sobre base gris |
| Ruleta · logo y mascota | Vacíos. Solo se ve el título "TIRO GRATIS DEL DÍA" |
| Tablero · número ocupado | Moneda de oro sobre fondo verde oscuro |
| Menú · tarjeta sin portada | Arte automático con el color del sorteo |
| Imagen exportada · fondo | Degradado vino oscuro |

## 3. Espacios personalizables

### 3.1 Generales (panel → Diseño)

| Espacio | Dónde se ve | Formato recomendado | Comportamiento |
|---|---|---|---|
| **Fondo de la ruleta** | Detrás de toda la pantalla de la ruleta | Vertical 9:16, 1080×1920, JPG o WebP | Cubre la pantalla, centrado. Oculta las nubes por defecto |
| **Logo del título** | Arriba de la ruleta, sobre el título | PNG sin fondo, hasta 800 px de ancho | Alto `clamp(130px, 23svh, 200px)`. Se puede ocultar con "Ocultar el logo de arriba" |
| **Mascota** | A ambos lados del logo | PNG sin fondo, vertical | La de la derecha se voltea en espejo. Alto `clamp(70px, 12svh, 120px)` |
| **Máquina de la ruleta** | Reemplaza al castillo | PNG sin fondo, vertical, ~1000 px de ancho | Ver sección 4 |
| **Botón LANZA** | Reemplaza la tecla roja | PNG sin fondo, proporción ~2,25:1 (por ejemplo 600×270) | Conserva el efecto de presión. Debe leerse como botón por sí solo |
| **Símbolos de los rodillos** (5) | En los tres rodillos | PNG sin fondo, cuadrados, 256–512 px | Cada uno reemplaza a moneda, trébol, herradura, siete o diamante |
| **Logo de número ocupado** | Tapa de los números ocupados en todos los sorteos y en la imagen exportada | PNG sin fondo, cuadrado, ≥256 px | Se centra dentro de la celda |

### 3.2 Controles generales (panel → Diseño)

| Control | Rango | Por defecto | Efecto |
|---|---|---|---|
| Tamaño de los íconos | 35–100 % | 62 % | Tamaño del símbolo dentro de su celda del rodillo |
| Ventana de rodillos: Izquierda, Arriba, Ancho, Alto | 0–100 %, pasos de 0,5 | 16 · 30 · 68 · 36 | Posición de los rodillos sobre la imagen de máquina |
| Fondo blanco a los rodillos | Sí/No | No | Pinta los rodillos de crema cuando la imagen de máquina no los trae dibujados |
| Ocultar el logo de arriba | Sí/No | No | Para imágenes de máquina que ya incluyen logo |
| Color del castillo | Color | `#4B57A0` | Solo aplica al castillo por defecto |
| Color del botón LANZA | Color | `#E2402F` | Solo aplica al botón por defecto |

### 3.3 Por sorteo (panel → Sorteos → Editar)

| Espacio | Dónde se ve | Formato recomendado |
|---|---|---|
| **Portada de la tarjeta** | Tarjeta del menú, miniatura del sorteo, "Mis números" e imagen exportada | Cuadrada, ≥600×600 |
| **Logo de la lotería** | Página del sorteo, junto a "Juega con…" | Cuadrado, PNG sin fondo, ≥200 px |
| **Logo de número ocupado** | Tapa solo en este sorteo. Tiene prioridad sobre el general | Cuadrado, PNG sin fondo |
| **Fondo de la imagen del tablero** | Solo en la imagen exportada de este sorteo | Vertical 9:16, 1080×1920 |
| **Color de la tarjeta** | Arte automático y precio en neón | Automático o uno de 7 colores |

El fondo de la imagen exportada también se puede poner, cambiar o quitar desde la propia ventana "Imagen del tablero".

### 3.4 Textos configurables

| Texto | Dónde se edita |
|---|---|
| Nombre del negocio | Ajustes |
| WhatsApp del negocio | Ajustes |
| Mensaje de cobro | Ajustes |
| Premios de la ruleta | Ruleta |
| Nombre, lotería, hora y grupo especial de cada sorteo | Editor de sorteo |

## 4. Máquina personalizada

1. El administrador sube la imagen de la máquina.
2. Aparece una **vista previa** con un rectángulo rojo punteado dividido en tres columnas. Ese rectángulo es la ventana donde irán los rodillos.
3. Con cuatro deslizadores lo ajusta hasta que calce con el hueco de su imagen. Los valores son **porcentajes del ancho y del alto de la imagen**, así el ajuste sirve en cualquier tamaño de pantalla.
4. Guarda y usa "Probar la ruleta" para verificar.

Reglas de dibujo:

- La imagen se muestra a todo el ancho del juego, con su proporción original.
- La ventana se posiciona encima con `left, top, width, height` en porcentaje.
- Dentro de la ventana hay tres columnas iguales separadas por un 3 % del ancho.
- Cada columna muestra tres símbolos, cada uno con un tercio del alto de la ventana. La franja central es la línea ganadora.
- El banderín de mensajes y el tablón del celular no forman parte de la imagen: el título va arriba y el tablón debajo.

## 5. Estructura de datos de la personalización

El diseño general se guarda como un solo documento. Estructura recomendada, con la clave equivalente del prototipo:

```jsonc
{
  "ruleta": {
    "fondo": null,            // prototipo: fondo
    "logo": null,             // logo
    "ocultarLogo": false,     // sinLogo
    "mascota": null,          // mascota
    "maquina": null,          // maquina
    "ventana": { "x": 16, "y": 30, "w": 68, "h": 36 },   // ventana
    "rodillosBlancos": false, // rodBlanco
    "escalaSimbolos": 62,     // simEscala
    "botonImagen": null,      // lanzaImg
    "colorCastillo": "#4B57A0", // marco
    "colorBoton": "#E2402F",    // boton
    "simbolos": {             // sim
      "moneda": null, "trebol": null, "herradura": null, "siete": null, "diamante": null
    }
  },
  "tablero": {
    "logoOcupado": null       // ocupado
  }
}
```

- Un valor `null` significa "usar la proforma base".
- Los valores de imagen son la **ruta pública** del archivo ya procesado, no el archivo en sí.
- La API pública entrega este documento ya resuelto. El sitio público nunca decide qué archivo usar.
- Validar en el servidor: colores en formato `#RRGGBB`, porcentajes dentro de rango y rutas que pertenezcan al almacén de imágenes propio.

## 6. Subida y tratamiento de imágenes

| Regla | Valor |
|---|---|
| Tipos aceptados | JPG, PNG y WebP. **No** SVG ni GIF |
| Verificación | Por contenido real del archivo, no por extensión |
| Peso máximo de entrada | 8 MB |
| Reprocesado | Siempre. Se vuelve a codificar en el servidor y se eliminan los metadatos |
| Lado mayor máximo | 1400 px para fondos y máquina · 900 px para portadas · 600 px para logos, símbolos, mascota y botón |
| Formato de salida | WebP (con transparencia cuando el original la tenga) |
| Nombre de archivo | Generado por el servidor (identificador aleatorio). Nunca el nombre original |
| Caché | Rutas inmutables, con caché larga |
| Limpieza | Al reemplazar o quitar una imagen, el archivo anterior se borra si nadie más lo usa |

En el panel, cada espacio muestra: la miniatura actual o "Sin imagen", el botón de archivo, el estado "Subiendo…" y el enlace "Quitar". Un error de subida deja el valor anterior intacto.

## 7. Qué no es personalizable hoy

En el prototipo el administrador **no** puede cambiar:

- Los colores y el fondo del menú de sorteos.
- El texto "SELECCIONA UN SORTEO" y el título de la ruleta.
- Los colores de la aplicación (verde, amarillo).
- Las tipografías.

**[Propuesto]** Si se quiere dar más control, ampliar el documento de diseño con una sección `marca`, manteniendo siempre valores por defecto:

```jsonc
"marca": {
  "menuFondo": null,              // imagen de fondo del menú
  "menuTitulo": "Selecciona un sorteo",
  "ruletaTitulo": "Tiro gratis del día",
  "colorPrincipal": "#0E6A4E",
  "colorAcento": "#F2B705",
  "iconoApp": null                // genera los íconos de la app instalable
}
```

Cualquier color configurable debe pasar una comprobación de contraste antes de guardarse, para que el texto siga siendo legible.
