# 02 · Interfaz y sistema de diseño

Todos los valores salen del prototipo (`referencia/prototipo.html`). Ante cualquier duda visual, abrir el prototipo en tamaño de celular y comparar.

## 1. Principios

1. **Móvil primero.** Se diseña para 375–430 px de ancho. En pantallas grandes el contenido queda centrado en una columna, no se estira.
2. **Tres ambientes visuales.** Cada zona tiene su propio look:
   - **Ruleta:** juego de cielo y castillo, colorido. Look fijo.
   - **Menú de sorteos:** vino oscuro con dorado y neón. Look fijo.
   - **Aplicación** (tablero, datos, boleta, mis números y panel): limpia, verde y amarillo, con tema claro y oscuro.
3. **El dedo manda.** Botones grandes, acción principal abajo, nada que requiera precisión.
4. **Sin desplazamiento lateral** en ninguna pantalla.

## 2. Tipografías

Se alojan en el propio servidor (por ejemplo con paquetes Fontsource). Todas son de licencia abierta.

| Tipografía | Uso | Pila de respaldo |
|---|---|---|
| **Bricolage Grotesque** 600/800 | Títulos y cifras de la aplicación y del panel | `"Arial Narrow", system-ui, sans-serif` |
| **Figtree** 400–700 | Texto general, formularios, etiquetas | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| **Anton** | Menú de sorteos (título, nombres, precios, bandas), tarjeta de resultado, imagen exportada | `Impact, "Arial Narrow", sans-serif` |
| **Luckiest Guy** | Título de la ruleta, placa y dígitos del campo de celular | `"Lilita One", Impact, sans-serif` |
| **Lilita One** | Botón LANZA, texto de ejemplo del campo de celular | `"Anton", Impact, sans-serif` |

Escala de la aplicación: `h1 clamp(28px, 6vw, 40px)`, `h2 clamp(22px, 4.5vw, 28px)`, `h3 19px`, texto 16 px con interlineado 1.5, texto pequeño 14 px, etiquetas en mayúscula 12 px con `letter-spacing: .09em`. Títulos con `text-wrap: balance`. Cifras alineadas con `font-variant-numeric: tabular-nums`.

## 3. Colores

### 3.1 Aplicación y panel (con tema claro y oscuro)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--paper` | `#F1F4EF` | `#0C1512` | Fondo de página |
| `--card` | `#FFFFFF` | `#13201C` | Tarjetas, campos, celdas libres |
| `--ink` | `#11231E` | `#E6EEE9` | Texto |
| `--muted` | `#56675F` | `#93A69E` | Texto secundario |
| `--line` | `#D5DDD6` | `#24342F` | Bordes |
| `--green` | `#0E6A4E` | `#3DBE8D` | Acción principal, pagado |
| `--green-ink` | `#FFFFFF` | `#03130D` | Texto sobre verde |
| `--green-soft` | `#DFEEE6` | `#15322A` | Fondos suaves, zona de pago |
| `--sun` | `#F2B705` | `#F6C744` | Número elegido, avisos, botón secundario |
| `--sun-ink` | `#231A00` | `#221800` | Texto sobre amarillo |
| `--sun-soft` | `#FBEFC4` | `#3A3114` | Premio mayor, pago parcial |
| `--taken` | `#C23E2C` | `#FF7A66` | Errores, deuda, acciones de borrar |
| `--taken-soft` | `#F6E0DA` | `#3B1F1A` | Fondo de "Pendiente" |
| `--cab` | `#0C3A30` | `#0A2C25` | Franja de premio total, celdas ocupadas |
| `--cab-ink` | `#F1F4EF` | `#E6EEE9` | Texto sobre `--cab` |

Sombra de tarjeta en claro: `0 1px 2px rgb(17 35 30 / .06), 0 10px 28px rgb(17 35 30 / .07)`; en oscuro, sin sombra. Radio base: 14 px.

El tema sigue al sistema (`prefers-color-scheme`) y admite forzarlo con `data-theme="light|dark"` en la raíz.

### 3.2 Menú de sorteos (look fijo)

| Elemento | Valor |
|---|---|
| Fondo | Degradado a 165° `#5E1013 → #320B0E (55 %) → #170708`, con dos brillos radiales `#9C1C1C` (arriba izquierda) y `#7A1414` (derecha) |
| Título | Degradado vertical `#FBE7B8 → #E8BE72 → #C08A3E → #8E5E24` aplicado al texto, con sombra `0 4px 6px rgb(0 0 0 / .45)` |
| Nombre del negocio | `#F3D9A4` |
| Tarjeta | Fondo `#141418`, borde 2 px `#26262E`, sombra `0 10px 22px rgb(0 0 0 / .45)` |
| Banda de grupo | Fondo `#E5203A`, texto blanco, sombra `0 4px 0 #8A0E1E` |
| Recuadro de consulta | Fondo `rgb(0 0 0 / .35)`, borde 2 px `#E8BE72` |
| Botones dorados | Degradado `#FFE27A → #E3A11B`, texto `#2A1500`, sombra `0 4px 0 #7A4C00` |
| Pie | `#C9A57A` |
| Color de la barra del navegador | `#5E1013` |

**Colores de sorteo.** Cada sorteo usa uno; pinta el arte de la tarjeta y el precio en neón.

| Clave | `c1` | `c2` | Neón |
|---|---|---|---|
| turquesa | `#3CC6CF` | `#178A97` | `#3FF5E0` |
| morado | `#8D4DF0` | `#5523B5` | `#A86BFF` |
| naranja | `#FF9A2E` | `#F05A05` | `#FF8F2E` |
| verde | `#4FD443` | `#1C8F27` | `#5CFF6A` |
| rojo | `#F0354A` | `#B0101E` | `#FF2B2B` |
| azul | `#3C8BF5` | `#1A4DB5` | `#4FA8FF` |
| dorado | `#F7C948` | `#C08414` | `#FFD24A` |

El precio se pinta con `color-mix(in srgb, neón 75%, #FFFFFF)` y doble resplandor `0 0 6px neón, 0 0 16px neón`.

### 3.3 Ruleta (look fijo, con dos colores configurables)

| Elemento | Valor |
|---|---|
| Cielo | Degradado vertical `#2F8FE0 → #5DB2F0 (38 %) → #A9D8F7 (64 %) → #F6E8F0 (82 %) → #F3E9EF` |
| Nubes | Blancas; banco de nubes inferior `#FCEFF5 → #F3E3EC` |
| Título | Degradado `#FFF7B0 → #FFE14A (38 %) → #FFB01F (62 %) → #F57C00`, borde 2 px `#5B1A8E`, sombras escalonadas `#5B1A8E` y `#3A0E5E`, girado −2° |
| Castillo `--piedra` | `#4B57A0` (configurable). Juntas de piedra con líneas oscuras cada 34 px (horizontal) y 58 px (vertical) |
| Banderín | `#E8343A → #B81C2A`, borde interior `#F08A3A`, texto blanco con sombra `#6A0A12` |
| Banderas laterales | `#E23A6E → #B01C52`, corona `#F7B84A` |
| Gemas | `#E8443A` y `#C24BE8` |
| Cristales | `#F0457A` y `#A84BF0` |
| Rodillos | Crema `#E6E2D2 → #FFFDF4 → #E1DCCB`, sobre fondo `piedra 40 % + #0A0C2A` |
| Línea ganadora | Franja central, borde punteado `rgb(226 64 47 / .7)`, relleno `rgb(255 214 102 / .14)` |
| Símbolo ganador | Resplandor radial dorado, borde interior `#FFE14D`, latido ×3 |
| Tablón del celular | Madera `#C98A47 → #A8692F → #8A5222`, borde `#5C3412`, clavos plateados |
| Placa del tablón | `#7A4318 → #5C3412`, borde `#E3B15C`, texto `#FFF3D6` |
| Campo del celular | Pergamino `#FFF9E8 → #FBEBC6 → #F2D9A2`, borde `#4A2A0E`, dígitos `#6B2E0A`, foco dorado `#FFB01F`, error `#E2402F` |
| Botón LANZA `--lanza` | `#E2402F` (configurable). Base gris `#D9DEE8 → #B4BCCB → #8E97AB`. Texto blanco con borde `#5A0C08` y sombras `#7A120C` |
| Tarjeta de resultado | Blanca, radio 20 px; título `#4B57A0`. Si ganó: fondo `#FFF6CC → #FFFFFF` y título `#B81C2A` |
| Reglas | Texto `#3C2E5A` sobre `rgb(255 255 255 / .7)`, premios en `#B81C2A` |
| Color de la barra del navegador | `#2F8FE0` |

## 4. Responsive

| Regla | Detalle |
|---|---|
| Anchos máximos | Aplicación y panel 860 px · Menú 560 px · Ruleta 460 px (juego 420 px) |
| Márgenes laterales | Mínimo 16 px, respetando el área segura: `max(16px, env(safe-area-inset-left))`. En el tablero, 10 px por debajo de 480 px |
| Altura | Usar `svh`, no `vh`, para que la barra del navegador no corte la pantalla |
| ≤ 480 px | Encabezado compacto, miniatura del sorteo 72 px, celdas con 4 px de separación, barra inferior con botón de 52 px, acciones de fila a todo el ancho, indicadores en 2 columnas |
| ≤ 380 px | La pastilla "Tiro gratis" muestra solo el ícono |
| ≥ 640 px (panel) | El ajuste de la máquina muestra vista previa y controles lado a lado |
| Rejillas de formularios | Columnas automáticas: `repeat(auto-fit, minmax(min(220px, 100%), 1fr))`. Una columna en celular, dos o más cuando hay espacio |
| Punteros táctiles | Botones pequeños de al menos 42 px de alto; principales de 46 a 54 px |
| Campos | Fuente de al menos 16 px para que iOS no haga zoom al escribir |
| Táctil | `touch-action: manipulation`, sin resaltado de toque, `overscroll-behavior-y: none` |
| Movimiento reducido | Con `prefers-reduced-motion` no hay animaciones: los rodillos muestran el resultado directo |
| Textos de las tarjetas | Escalan con el ancho de la tarjeta mediante consultas de contenedor (`cqi`) |

**La ruleta debe caber completa en una pantalla** de 375×667 sin desplazar: título, máquina, campo y botón. Para lograrlo los tamaños dependen de la altura (`svh`): máquina `min(100%, 420px, 52svh)`, logo `clamp(130px, 23svh, 200px)`, mascota `clamp(70px, 12svh, 120px)`.

Tamaños de prueba obligatorios: **375×667**, **390×844**, **430×932** y **768×1024**.

## 5. Componentes comunes de la aplicación

| Componente | Especificación |
|---|---|
| Botón | Alto mínimo 46 px, radio 12 px, peso 700. Variantes: normal (borde), principal (verde), amarillo, peligro (borde y texto rojos), pequeño (36 px; 42 px en táctil), bloque (ancho completo, 54 px) |
| Campo | Alto mínimo 46 px, radio 10 px, borde 1 px `--line`. Solo lectura: fondo `--green-soft` |
| Foco de teclado | Contorno de 3 px `--sun` con 2 px de separación |
| Pastilla | Radio completo, 12 px, peso 700. Día: `--sun-soft`. Noche: `--cab`. Oculto: rojo suave |
| Ficha de número | Fondo `--sun`, radio 10 px, 18 px peso 800. Pagada: fondo `--green` |
| Panel | Fondo `--card`, borde `--line`, radio 14 px, relleno 18 px |
| Aviso flotante | Abajo al centro, fondo `--ink`, texto `--paper`, desaparece a los 2,6 s |
| Confirmación | No se usan diálogos del navegador. Las acciones destructivas piden **doble toque**: el botón cambia a "¿Seguro? Toca otra vez" durante 3 s |
| Encabezado | Marca con iniciales en un cuadro verde de 34 px y el nombre del negocio |

## 6. Pantallas

### 6.1 Ruleta

Orden vertical, todo centrado:

1. Enlace "Saltar →" arriba a la derecha (pastilla azul oscuro translúcida).
2. Opcional: logo y mascotas. La mascota sale a ambos lados del logo; la de la derecha, en espejo.
3. **Título** con Luckiest Guy, `clamp(34px, 10.5vw, 58px)`, en mayúscula. Al cambiar de texto hace un rebote de 0,45 s.
4. **Máquina.** Por defecto el castillo:
   - Almenas arriba, banderín rojo "¡Gira y gana!", banderas laterales, dos gemas.
   - Tres rodillos de proporción 1:2,4. Cada símbolo ocupa una celda de proporción 1:0,8 y se dibuja al **62 %** de la celda (ajustable de 35 a 100 %).
   - Tablón de madera con la placa "TU CELULAR PARA JUGAR" y el campo, con el texto de ejemplo "Escribe tu celular". Dígitos `clamp(24px, 7.2vw, 30px)`, campo de 64 px de alto.
5. Cristales a los lados de la base.
6. **Botón LANZA:** ancho `min(74%, 270px)`, proporción 2,25:1. Tecla roja de esquinas de 18 px sobre base gris trapezoidal; texto `clamp(34px, 10.5vw, 54px)` girado −3° e inclinado −6°. Al presionar, la tecla baja 7 px.
7. Reglas: "3 iguales en la línea del medio: {premio} · 2 iguales: {premio}".
8. **Tarjeta de resultado** fija al fondo de la pantalla, sobre un velo degradado que deja ver los rodillos.

**Animación de los rodillos**

- Cada rodillo es una tira vertical. Al girar se arma con: los 3 símbolos visibles + relleno al azar + los 3 finales (el del medio es el resultado).
- Relleno: 16 símbolos el primer rodillo, 21 el segundo, 26 el tercero.
- Duración: 1,30 s, 1,75 s y 2,20 s.
- Curva: `cubic-bezier(.12, .75, .18, 1.02)` (frena con un leve rebote).
- Al terminar, la tira se recorta a los 3 símbolos finales.

**Símbolos por defecto.** Cinco ilustraciones vectoriales originales con volumen (degradados, brillo y sombra de piso): moneda de oro con estrella, trébol de cuatro hojas, herradura dorada, siete rojo con borde dorado y diamante azul. Están dentro del prototipo como `<symbol>` SVG y se pueden extraer tal cual.

**Máquina personalizada.** Si el administrador sube su imagen, reemplaza al castillo. Los rodillos se colocan encima, en una ventana definida en porcentajes de la imagen (`x, y, ancho, alto`). El campo de celular pasa a un tablón suelto debajo.

### 6.2 Menú de sorteos

- Título con Anton: primera línea `clamp(46px, 13.5vw, 84px)`, segunda `clamp(60px, 18vw, 112px)`, interlineado 0,92.
- Recuadro de consulta: etiqueta con lupa en Anton `clamp(18px, 5vw, 22px)`; campo blanco de 54 px; botón dorado.
- Separación entre tarjetas: `--gap = clamp(8px, 2.6vw, 14px)` en horizontal y `1.6 × --gap` en vertical.
- **Tarjeta:**
  - Radio `clamp(16px, 4.5vw, 24px)`; relleno interior mínimo.
  - **Pestaña de hora:** centrada arriba, fondo del color de la tarjeta, esquinas inferiores de 14 px.
  - **Arte:** cuadrado con radio `clamp(12px, 3.6vw, 18px)`. Con portada: imagen a cubrir. Sin portada: degradado `c1 → c2` a 160°, rayos giratorios translúcidos, emblema circular verde (`#36DE76 → #0F7A3A`) con aro dorado `#FFD24A` y una moneda, dos tréboles y la **primera palabra del nombre** en Anton amarillo `#FFE14D` con borde `#3A1A00`.
  - **Nombre:** Anton en mayúscula, `clamp(14px, 13cqi, 30px)`.
  - **"PRECIO:"** en 800, mayúscula.
  - **Precio:** Anton `clamp(18px, 16cqi, 40px)` en neón.
  - En táctil, al presionar la tarjeta se reduce al 97 %.

### 6.3 Página del sorteo

- **Premio total:** franja a todo el ancho, fondo `--cab`, etiqueta y valor en `--sun`; valor `clamp(28px, 8.5vw, 36px)`.
- **Premio mayor:** fondo `--sun-soft` con borde `--sun`. Bajo el título, la nota "Dos últimas cifras".
- **Valor de la boleta:** fondo `--green-soft`.
- **Tablero:** rejilla de 10 columnas iguales. Celda cuadrada, radio 7–9 px, número en Bricolage 700 `clamp(13px, 3.9vw, 17px)`.
  - Libre: fondo `--card`, borde `--line`.
  - Elegida: fondo y borde `--sun`.
  - Ocupada: fondo `--cab`, con la tapa centrada ocupando el 88 % de la celda.
  - Al tocar: se reduce al 92 %. "Al azar": salto al 118 % durante 0,35 s. Recién ocupada: sello (entra desde el 40 % girada −20°) en 0,55 s.
- **Barra inferior fija:** fondo `--paper`, borde superior, sombra hacia arriba y relleno inferior con el área segura.
- **Boleta:** tarjeta de radio 18 px en dos partes separadas por una **línea punteada con dos muescas circulares** a los lados, como un tiquete. La parte de pago tiene fondo `--green-soft`. El Nequi va en Bricolage 800 `clamp(28px, 8vw, 38px)` y se puede seleccionar completo con un toque.

### 6.4 Mis números

- Resumen: franja de radio 16 px, verde si está al día o amarilla si debe, con la cifra en Bricolage 800 `clamp(22px, 6.5vw, 28px)`.
- Tarjeta por sorteo: miniatura de 52 px, nombre, fecha y estado en pastilla (Pagado verde, Pendiente rojo suave, Pago parcial amarillo suave).
- Zona de pago: fondo `--green-soft`, Nequi en 20 px y botón "Copiar".

### 6.5 Panel de administración

- Mismos tokens y componentes que la aplicación.
- **Pestañas** en fila con desplazamiento horizontal propio: Sorteos · Contactos · Tragamonedas · Diseño · Ajustes. La activa va con fondo `--ink`.
- **Filas** de lista dentro de un contenedor con borde; en celular las acciones bajan a una segunda línea a todo el ancho.
- **Tablero en miniatura:** 10 columnas, celdas con radio 4 px. Por pagar `--sun-soft`, pagado `--green`, fijo `--cab`.
- **Selector de imagen:** miniatura de 72 px, botón de archivo y enlace "Quitar".
- **Ajuste de máquina:** vista previa sobre cuadrícula de transparencia, rectángulo rojo punteado con las tres columnas marcadas y cuatro deslizadores.
- **Ventana de imagen del tablero:** velo oscuro, caja de 460 px máximo con la imagen y los botones apilados.

## 7. Imagen exportada del tablero

Lienzo de **1080 px de ancho**, margen lateral `M = 54`. Alto según contenido (≈1862 px con los tres premios).

| Bloque | Posición y tamaño | Estilo |
|---|---|---|
| Fondo por defecto | Todo | Degradado diagonal `#5E1013 → #320B0E → #170708` y brillo radial rojo arriba a la izquierda |
| Fondo propio | Todo, a cubrir | Velo negro al 18 %. Detrás del encabezado, panel `rgba(12,8,10,.62)` de radio 30 |
| Portada | x 54, y 50, 230×230, radio 34 | Imagen a cubrir, o degradado del color del sorteo con una moneda |
| Nombre del negocio | x 320, línea base 96 | Figtree 700 30 px, `#F3D9A4`, mayúscula |
| Nombre del sorteo | línea base 186 | Anton hasta 92 px, blanco, mayúscula; se reduce hasta caber |
| Fecha y hora | línea base 236 | Figtree 700 34 px, color neón del sorteo |
| Lotería | línea base 276 | Figtree 500 28 px, `#E8C9A0`; solo si difiere del nombre |
| Franja de total | y 316, alto 132, radio 28 | Degradado `#FFE98A → #E3A11B`, borde 3 px `#7A4C00`. Divisor vertical al 62 %. Etiquetas Figtree 800 26 px; valores Anton 66 px (total) y 56 px (boleta), centrados en cada mitad |
| Premios | y 466, alto 108, separación 16, radio 22 | Fondo `rgba(12,8,10,.72)`, borde 2,5 px `#E8BE72`. Etiqueta Figtree 800 23 px `#F3D9A4`; valor Anton 48 px blanco |
| Tablero | Empieza en y 474 + (126 si hay premios) | Celda 88,2 px, separación 10, radio 16. Libre: blanca con número Anton al 46 % de la celda, `#141418`. Ocupada: `#0C3A30` con la tapa al 80 % |
| Contador | 40 px bajo el tablero | Figtree 700 30 px, `#F3D9A4`. Con fondo propio, sobre una pastilla oscura |
| Pago | Alto 200, radio 28 | Blanco con borde 3 px `#E8BE72`. Título Figtree 800 26 px `#0E6A4E`; Nequi Anton 68 px `#11231E`; titular Figtree 600 28 px `#56675F` |

Todo valor que pueda desbordar su caja reduce el tamaño de letra hasta caber. Antes de dibujar hay que esperar a que las tipografías estén cargadas.

## 8. Accesibilidad

- Cada celda del tablero es un botón con etiqueta: "23", "23 elegido" o "23 ocupado", y `aria-pressed`.
- Rodillos, resultados de consulta y avisos usan regiones vivas (`aria-live="polite"`).
- Todo campo tiene etiqueta, visible u oculta para lectores de pantalla.
- Contraste mínimo AA en texto sobre los tokens de la aplicación, en ambos temas.
- Nada depende solo del color: los estados llevan texto ("Pagado", "Pendiente", "Fijo").
- Todo funciona con teclado y el foco siempre se ve.

## 9. App instalable

- `manifest.webmanifest` con nombre "El Pato de la Suerte", nombre corto "Pato Suerte", modo `standalone`, orientación vertical e íconos de 192 y 512 px (este último también `maskable`), más `apple-touch-icon` de 180 px.
- `viewport` con `viewport-fit=cover`.
- `theme-color` cambia por pantalla: ruleta `#2F8FE0`, menú `#5E1013`, resto `#F1F4EF`.
- El ícono de la app debe poder generarse a partir del logo que suba el administrador.
