# 01 · Especificación funcional

Describe qué hace la aplicación. Todo lo que aparece aquí existe y funciona en `referencia/prototipo.html`, salvo lo marcado como **[Nuevo]** (requisitos añadidos para la versión formal) o **[Propuesto]** (mejoras opcionales).

## 1. Qué es

Una web app para celular con la que el negocio "El Pato de la Suerte" vende números de sorteos tipo chance (tablero del 00 al 99) sin depender de grupos de WhatsApp.

- El **cliente** entra por un link, aparta sus números con nombre y celular, y paga por Nequi por fuera de la app. No se registra ni inicia sesión.
- El **administrador** crea los sorteos, asigna números fijos, confirma pagos, cobra por WhatsApp y personaliza la interfaz.

No hay pasarela de pagos. La app registra **quién apartó qué** y **si ya pagó**.

## 2. Actores

| Actor | Acceso | Qué puede hacer |
|---|---|---|
| Cliente | Sitio público, sin cuenta | Girar la ruleta una vez al día, ver sorteos, apartar números, consultar sus números |
| Administrador | Subdominio privado, con usuario y contraseña | Todo el panel |
| Operador del servidor | Terminal del VPS | Crear, desactivar y cambiar contraseñas de administradores **[Nuevo]** |

## 3. Glosario

| Término | Significado |
|---|---|
| Sorteo | Una rifa de 100 números (00–99) que juega con una lotería en una fecha y jornada |
| Jornada | `día` o `noche`. Cambia el saludo del mensaje de cobro |
| Boleta | Un número apartado. Su precio es el "valor de la boleta" |
| Reserva | Un número de un sorteo asignado a una persona |
| Número fijo | Reserva que crea el administrador para un cliente habitual |
| Contacto | Par celular–nombre. El celular identifica a la persona |
| Giro | Un tiro de la ruleta (tragamonedas) |
| Grupo especial | Etiqueta opcional de un sorteo (por ejemplo "Miércoles") que lo ubica en una sección aparte del menú |
| Tapa | Logo que cubre un número ocupado en el tablero |

## 4. Mapa de pantallas

### Sitio público

| Ruta sugerida | En el prototipo | Pantalla |
|---|---|---|
| `/` | `#` | Ruleta diaria. Si no aplica, redirige a `/sorteos` |
| `/sorteos` | `#sorteos` | Menú "Selecciona un sorteo" |
| `/sorteo/:id` | `#sorteo-<id>` | Tablero, datos y boleta |
| `/mis-numeros` | `#mis-numeros` | Consulta de números por celular |

### Panel de administración (otro subdominio)

| Ruta sugerida | Pantalla |
|---|---|
| `/login` | Inicio de sesión |
| `/sorteos` | Lista de sorteos |
| `/sorteos/nuevo`, `/sorteos/:id/editar` | Editor de sorteo |
| `/sorteos/:id` | Gestión del sorteo (participantes, pagos, lista, imagen) |
| `/contactos` | Banco de contactos |
| `/ruleta` | Configuración y ganadores de la ruleta |
| `/ruleta/probar` | Ruleta en modo prueba |
| `/diseno` | Personalización |
| `/ajustes` | Negocio, WhatsApp y mensaje de cobro |

## 5. Reglas generales

### 5.1 Celulares

- Normalización: se quitan todos los caracteres que no sean dígitos. Si quedan 12 dígitos y empiezan por `57`, se quita ese prefijo.
- Válido: exactamente 10 dígitos y empieza por `3` (`^3\d{9}$`).
- Se muestra como `300 123 4567`.
- El celular es la **identidad** del cliente: une sus reservas, su contacto y su tiro diario.

### 5.2 Dinero y fechas

- Dinero: pesos colombianos sin decimales y sin espacio: `$10.000`.
- Fecha: `domingo 8 nov` (día de la semana, día, mes abreviado, todo en minúscula).
- Hora del sorteo: texto libre que escribe el administrador, por ejemplo `2:30 p. m.`. En la tarjeta del menú se muestra compacta, sin espacios ni puntos y en mayúscula: `2:30PM`.
- "Hoy" se calcula en `America/Bogota`.

### 5.3 Datos que recuerda el navegador del cliente

Son comodidades, no reglas. El servidor valida siempre.

| Clave | Contenido | Uso |
|---|---|---|
| `mi_tel` | Último celular escrito | Rellenar los campos de celular |
| `giro_AAAA-MM-DD` | Resultado del tiro de hoy | No volver a mostrar la ruleta hoy y mostrar el aviso de premio |

## 6. Sitio público

### 6.1 Ruleta diaria (tragamonedas)

**Cuándo aparece**

- Es la primera pantalla al abrir el link, a pantalla completa.
- Solo aparece si la ruleta está activa **y** ese navegador no ha jugado hoy. En cualquier otro caso se va directo a `/sorteos`.
- Hay un enlace "Saltar →" arriba para ir a los sorteos sin jugar.

**Juego**

1. El cliente escribe su celular en el tablón de madera y toca **LANZA**.
2. Si el celular no es válido: el título cambia a "Escribe tu celular", el campo tiembla y recibe el foco.
3. Se pide el resultado al servidor. Mientras tanto el título dice "¡Suerte!".
4. Tres rodillos giran y se detienen de izquierda a derecha. Cada rodillo muestra 3 símbolos; **la fila del medio es la línea ganadora**.
5. El título cambia a "¡Ganaste!", "¡2 iguales!" o "Casi…". Los símbolos ganadores de la línea del medio se iluminan.
6. Aparece una tarjeta de resultado en la parte baja, sin tapar los rodillos, con una cuenta regresiva:
   - Si ganó: 6 segundos, para alcanzar a tomar captura.
   - Si no ganó: 3 segundos.
   - Botón "Ir a los sorteos · N" para pasar de inmediato.
7. Al terminar la cuenta pasa sola a `/sorteos`.

**Reglas del resultado (servidor)**

- Un tiro por celular por día (día en hora de Colombia). La base de datos lo garantiza con unicidad `(celular, fecha)`.
- Hay 5 símbolos: `moneda`, `trebol`, `herradura`, `siete`, `diamante`.
- Se baraja la lista de símbolos y se toma un número al azar `r` entre 0 y 100:
  - `r < prob_tres` → tres iguales. Gana `premio_tres`.
  - `r < prob_tres + prob_dos` → dos iguales y uno distinto, en una de las tres posiciones posibles al azar. Gana `premio_dos`.
  - En otro caso → tres símbolos distintos. No gana.
- Valores por defecto: `prob_tres = 1 %`, `premio_tres = "Un número gratis"`, `prob_dos = 10 %`, `premio_dos = "$1.000 de descuento"`.
- Los premios son **texto libre**. La app no los aplica: el administrador los entrega a mano.
- Si ese celular ya jugó hoy, el servidor responde `ya_giro` con el resultado anterior. La pantalla muestra "Ya habías jugado hoy con este celular" y sigue a los sorteos.
- Si la ruleta está apagada, responde `inactiva`.
- **[Nuevo]** Las probabilidades no se envían nunca al navegador del cliente.

**Después de jugar**

- Ese día el link lleva directo a los sorteos y desaparece el botón "Tiro gratis" del menú.
- Si ganó, en el menú queda un aviso dorado "¡Ganaste {premio} hoy!" con el botón "Reclamar", que abre WhatsApp con el mensaje: `Hola, gané {premio} en la ruleta de El Pato de la Suerte. Mi celular es {celular}.` El botón solo aparece si el negocio configuró su WhatsApp.

**Vibración** (si el celular la permite): 15 ms al lanzar; patrón 40-60-40 ms al ganar.

### 6.2 Menú "Selecciona un sorteo"

De arriba hacia abajo:

1. **Barra superior:** nombre del negocio a la izquierda. A la derecha, la pastilla dorada "Tiro gratis" que lleva a la ruleta; solo se ve si la ruleta está activa y no se ha jugado hoy.
2. **Título** "SELECCIONA / UN SORTEO" en dos líneas.
3. **Recuadro "CONSULTA TUS NÚMEROS":** campo de celular y botón "Consultar".
   - Al completar 10 dígitos válidos la consulta se lanza sola, sin tocar el botón.
   - Los resultados (los mismos de "Mis números", sección 6.4) se despliegan debajo, en la misma pantalla, con un botón "Cerrar".
4. **Aviso de premio** de la ruleta, si aplica.
5. **Tarjetas de sorteos activos**, ordenadas por `orden`, luego fecha, luego creación.
6. **Grupos especiales:** los sorteos con etiqueta van debajo, agrupados bajo una banda roja con el texto de la etiqueta (por ejemplo "MIÉRCOLES", "SÁBADOS").
7. **Pie:** `@NOMBREDELNEGOCIO`. **[Nuevo]** No lleva enlace de administración.

**Tarjeta de sorteo:** pestaña con la hora arriba, portada cuadrada, nombre, la palabra "PRECIO:" y el valor de la boleta. Si el sorteo no tiene portada, se dibuja un arte automático con el color del sorteo (ver `docs/02`). Toda la tarjeta es un enlace al sorteo.

**Cuadrícula sin huecos**

- 1, 2 o 4 sorteos normales → 2 columnas.
- Cualquier otra cantidad → 3 columnas.
- La última fila incompleta se centra.
- Las tarjetas de los grupos especiales usan el mismo ancho de columna que las de arriba.
- Las tarjetas de una misma fila tienen la misma altura.

Si no hay sorteos activos: "No hay sorteos abiertos en este momento. Vuelve pronto o escríbenos por WhatsApp."

### 6.3 Página del sorteo

**Encabezado:** enlace "← Todos los sorteos", miniatura (portada o arte automático), nombre, pastilla "Día" o "Noche", y "Juega el {fecha} · {hora}". La línea "Juega con {lotería}" (con su logo si lo hay) solo aparece si el sorteo tiene logo de lotería o si el nombre de la lotería es distinto al del sorteo.

**Premios**, en este orden:

1. **Premio total** — a todo el ancho.
2. **Premio mayor** (dos últimas cifras).
3. **Cifras del medio**.
4. **Dos primeras cifras**.
5. **Unido** (opcional, solo en los sorteos que lo activan): gana el número formado por la primera y la última cifra del resultado (si sale 4523, gana el 43).
6. **Valor de la boleta**.

Los premios en 0 no se muestran. Los elementos 2 a 6 van en dos columnas; si quedan en número impar, el último ocupa todo el ancho. Todo debe verse sin desplazar de lado.

Si el sorteo no existe o está oculto: "Este sorteo ya no está disponible".

#### Paso 1 · Elegir números

- Tablero de 10×10 con los números `00` a `99`.
- Leyenda: Libre · Elegido · Ocupado (la muestra de "Ocupado" enseña la tapa real).
- Tocar un número libre lo marca como elegido; tocarlo otra vez lo desmarca. Se pueden elegir varios.
- Los ocupados aparecen **tapados con un logo** y no se pueden tocar. Orden de prioridad de la tapa: logo del sorteo → logo general → moneda de oro por defecto.
- Botón **"Al azar"**: cada toque agrega un número libre al azar, desplaza el tablero hasta él y lo resalta.
- Contador "N libres".
- El tablero se **actualiza solo cada 15 segundos**. Si un número que el cliente tenía elegido pasó a ocupado, se le quita de la selección. Los números recién ocupados entran con una animación de sello.
- **Barra fija inferior:** "N números" y "Total $X" (o "Ningún número" y "Toca tus números"), con el botón "Continuar", desactivado si no hay selección.

#### Paso 2 · Datos

- Muestra los números elegidos como fichas, la cantidad y el total.
- Enlace "← Cambiar números".
- Campo **Número de celular** (teclado numérico). Se rellena con el último celular usado; si está vacío recibe el foco.
- Al completar un celular válido se busca en el banco de contactos:
  - Si existe: el nombre se rellena solo, queda bloqueado y aparece "¡Hola de nuevo, {nombre}! Ya estás en nuestra lista."
  - Si no existe: el campo de nombre queda libre.
- Campo **Nombre y apellido** (mínimo 2 caracteres).
- Botón "Apartar mis números".

**Reglas al apartar (servidor)**

- El sorteo debe existir y estar activo.
- Celular válido; nombre de al menos 2 caracteres.
- Entre 1 y 30 números por operación, todos entre 0 y 99, sin repetidos.
- **Todo o nada:** si alguno de los números ya está ocupado, no se aparta ninguno y se devuelve la lista de ocupados.
- Si el celular no estaba en contactos, se crea con el nombre escrito. Si ya estaba, **se conserva el nombre guardado** y la reserva usa ese nombre.
- Las reservas quedan como tipo `cliente` y `no pagado`.
- Si dos personas apartan el mismo número a la vez, solo una lo consigue. La otra recibe el aviso de conflicto.

**Conflicto:** el cliente vuelve al tablero con sus datos conservados, los números ocupados salen de su selección y ve: "Alguien acaba de apartar 23, 48. Elige otros números."

#### Paso 3 · Boleta

- La pantalla baja hasta la boleta y se ocultan los premios.
- Contenido: "Números apartados", "Listo, {nombre}", "Tus números son:" con fichas, y las filas Sorteo, Juega, Celular y Total a pagar.
- Sección **"Paga por Nequi"**: número de Nequi del sorteo en grande, "A nombre de {titular}" y el botón **"Copiar número de Nequi"** (copia solo los dígitos). Si el sorteo no tiene Nequi: "Te enviaremos el número de pago por WhatsApp."
- Botón "Enviar comprobante por WhatsApp" si el negocio configuró su número. Mensaje: `Hola, soy {nombre}. Aparté {números} en {sorteo} ({fecha}). Te envío el comprobante.`
- Nota: "Tus números quedan a tu nombre. Envía el comprobante para confirmar el pago."
- Botones "Ver todos mis números" y "Apartar más números".

### 6.4 Mis números

- Campo de celular y botón "Buscar". Si el navegador recuerda un celular válido, la búsqueda se lanza sola.
- Alcance: sorteos **activos** o cuya fecha sea de los **últimos 7 días**.
- **Resumen:** "Hola, {nombre}" y, en amarillo, "Debes $X" o, en verde, "Estás al día". A la derecha, la cantidad de sorteos.
- **Una tarjeta por sorteo:** miniatura, nombre, fecha y hora, y el estado:
  - `Pagado` — todos sus números pagados.
  - `Pendiente` — ninguno pagado.
  - `Pago parcial` — algunos pagados.
- Números como fichas; los pagados en verde.
- "Total" y, si debe, "Por pagar".
- Si debe y el sorteo tiene Nequi: el número con botón "Copiar".
- Si debe y hay WhatsApp del negocio: "Enviar comprobante por WhatsApp" con los números pendientes.
- Sin resultados: "No tienes números apartados con el celular {celular}." con un botón "Elegir un sorteo".
- Nota al pie: "Los números en verde ya están pagados. Si pagaste hace poco y aún sale pendiente, espera a que confirmemos tu pago."

## 7. Panel de administración

### 7.1 Inicio de sesión **[Nuevo]**

Usuario y contraseña. Sin registro, sin recuperación por correo. Detalle en `docs/06`.

### 7.2 Sorteos · lista

Cada fila: miniatura, nombre, `{fecha} · {precio} · {N}/100 ocupados`, pastilla Día/Noche u "Oculto", y los botones **Gestionar** y **Editar**. Arriba, **Nuevo sorteo**.

### 7.3 Sorteos · editor

| Sección | Campo | Notas |
|---|---|---|
| Datos | Nombre del sorteo | Obligatorio |
| | Lotería con la que juega | Texto |
| | Jornada | Día o Noche |
| | Día que juega | Fecha |
| | Hora | Texto libre |
| | Orden en la página | Número; menor va primero |
| | Color de la tarjeta | "Automático según el nombre" o uno de 7 colores |
| | Grupo especial (opcional) | Texto; agrupa bajo una banda en el menú |
| | Visible para los clientes | Sí/No |
| Valor y premios | Valor de la boleta | Obligatorio, mayor que 0 |
| | Premio total | |
| | Premio mayor (dos últimas cifras) | |
| | Premio dos primeras cifras | |
| | Premio cifras del medio | |
| | Premio Unido (primera y última cifra) | Opcional: se activa por sorteo; desactivado = 0 y no se muestra |
| Pago | Número de Nequi · A nombre de | Propios de cada sorteo |
| Imágenes | Portada de la tarjeta | Cuadrada |
| | Logo de la lotería | |
| | Logo para números ocupados | Solo este sorteo |
| | Fondo para la imagen del tablero | Vertical; solo afecta la imagen exportada |
| Números fijos | Área de texto | Una persona por línea (sección 7.5) |

Acciones: **Guardar sorteo** y **Eliminar sorteo**. Eliminar borra también sus reservas y pide confirmación con doble toque (el botón cambia a "¿Eliminar con todos sus números? Toca otra vez" durante 3 segundos).

**Color automático** según el nombre: contiene "vip" → rojo; "carib" → turquesa; "chontico" → morado; "paisa" → naranja; "sinuano" → verde; cualquier otro → azul.

### 7.4 Sorteos · gestión

- **Cabecera:** nombre, fecha, hora, precio y los botones **Imagen del tablero**, **Copiar link del sorteo**, **Editar** y **Ver como cliente**.
- **Indicadores:** Ocupados `N/100`, Pagado `$`, Por cobrar `$`, Personas.
- **Tablero en miniatura** con colores por estado. Prioridad: pagado → fijo → por pagar → libre.
- **Agregar números fijos** (sección 7.5) y **Copiar los fijos de otro sorteo**: copia las reservas fijas del sorteo elegido; los números que ya estén ocupados en el destino se saltan y se informan.
- **Participantes:** las reservas se agrupan por celular. Cada persona muestra nombre, etiqueta "Fijo" si aplica, celular, total, sus números y el estado "Pagado" (todos pagados) o "Por pagar". Acciones:
  - **Cobrar:** abre WhatsApp de esa persona con el mensaje de cobro.
  - **Copiar mensaje.**
  - **Marcar pagado / Marcar por pagar:** cambia todos sus números en ese sorteo.
  - **Liberar:** borra sus reservas en ese sorteo (doble toque).
- **Aviso de nombres repetidos:** si dos celulares distintos tienen el mismo nombre, se advierte para revisar.
- **Lista final:** texto listo para WhatsApp, con botón "Copiar lista" y la opción "Incluir los números libres al final".

```
Paisita Día · domingo 8 nov · 2:30 p. m.

01-02-03 Ana
05-07-99 Carlos
23-48 Luisa

Libres: 00-04-06-08-…
```

Reglas de la lista: una línea por persona, números de menor a mayor con dos dígitos unidos por guion, personas ordenadas por su número más bajo. Ningún número aparece dos veces y ninguna persona ocupa dos líneas.

- **Imagen del tablero:** ver sección 7.10.

### 7.5 Números fijos · formato de entrada

Una persona por línea, con números, nombre y celular en cualquier orden:

```
01-02-03 Miguel 3001234567
05-07-99 Carlos
3109876543 Ana Pérez 4 8 15
```

Lectura de cada línea:

1. Se busca un celular (acepta espacios, puntos, guiones y prefijo `+57`) y se retira de la línea.
2. Todos los números sueltos de 1 o 2 dígitos son números del tablero. Se eliminan repetidos.
3. Lo que queda, sin separadores, es el nombre.

Resolución:

- Sin celular pero con nombre → se busca un contacto con ese nombre exacto (sin distinguir mayúsculas). Si no existe: error "falta el celular de {nombre}".
- Con celular pero sin nombre → se usa el nombre del contacto. Si no existe: error "falta el nombre".
- Sin números → error.
- Si algún número ya está ocupado → esa línea falla completa.

Los fijos se guardan como reservas de tipo `fijo`, no pagadas, y actualizan el nombre del contacto. Las líneas con error se listan al administrador; las demás se aplican.

### 7.6 Mensaje de cobro

Plantilla editable en Ajustes. Por defecto:

```
Hola {nombre}, {saludo}. Tienes {numeros} por un valor de {total} en el sorteo {sorteo} del {fecha}. Para cancelar, Nequi {nequi} a nombre de {titular}. ¡Mucha suerte!
```

| Variable | Valor |
|---|---|
| `{saludo}` | "buenos días" si la jornada es día; "buenas noches" si es noche |
| `{nombre}` | Nombre de la persona |
| `{numeros}` | Sus números con dos dígitos, separados por coma |
| `{cantidad}` | Cuántos números tiene |
| `{valor}` | Valor de una boleta |
| `{total}` | Cantidad × valor de la boleta |
| `{sorteo}` | Nombre del sorteo |
| `{fecha}` | Fecha del sorteo |
| `{hora}` | Hora del sorteo |
| `{nequi}` | Nequi del sorteo |
| `{titular}` | Titular del Nequi |

Una variable desconocida se deja tal cual. El enlace de cobro es `https://wa.me/57{celular}?text={mensaje}`.

### 7.7 Contactos

- Importar o agregar pegando líneas "nombre + celular" en cualquier orden. Si el celular ya existe, se actualiza el nombre. Las líneas sin nombre y celular válidos se devuelven para corregir.
- Buscador por nombre o celular. Lista de hasta 300 resultados.
- Borrar contacto (doble toque). No borra sus reservas.

### 7.8 Ruleta (panel)

- Interruptor "Mostrar la tragamonedas en la página".
- Probabilidad de 3 iguales (%), premio por 3 iguales, probabilidad de 2 iguales (%), premio por 2 iguales.
- **Probar la ruleta:** abre la ruleta en modo prueba. Giros ilimitados, sin pedir celular, sin guardar nada y sin redirigir. Muestra la etiqueta "Modo prueba · no cuenta como tiro" y los botones "Probar otra vez" y "Volver al panel". Usa las probabilidades reales.
- **Reiniciar el tiro de hoy:** **[Nuevo]** el administrador escribe un celular y se borra su giro de hoy en el servidor, para que pueda volver a ver la ruleta como cliente. (En el prototipo esto solo borraba el dato del navegador.)
- **Ganadores:** lista de giros premiados con nombre o celular, fecha, símbolos, premio y el botón "Marcar entregado". Contador del total de tiros.

### 7.9 Diseño y Ajustes

- **Diseño:** toda la personalización visual. Ver `docs/03`.
- **Ajustes:** nombre del negocio, WhatsApp para comprobantes y plantilla del mensaje de cobro con vista previa en vivo.

### 7.10 Imagen del tablero para compartir

Desde la gestión de un sorteo se genera una imagen PNG vertical de 1080 px de ancho con el estado actual:

- Portada, nombre del negocio, nombre del sorteo, fecha y hora, y lotería si aplica.
- Franja dorada con **Premio total** y **Boleta**.
- Premio mayor, cifras del medio, dos primeras y Unido (solo los que sean mayores que 0).
- Tablero 00–99 con los ocupados tapados.
- "N números disponibles · tapados = ocupados".
- Nequi del sorteo y titular.

Opciones en la ventana:

- **Compartir por WhatsApp** (hoja de compartir del celular, con la imagen y el texto).
- **Guardar imagen.**
- **Copiar mensaje con el link:** `{sorteo} · {fecha} {hora}` y `Aparta tus números aquí: {link}`.
- **Ponerle / cambiar / quitar fondo:** sube un fondo propio para ese sorteo y regenera la imagen. Se guarda en el sorteo.

Las medidas exactas están en `docs/02`.

## 8. Mensajes de error y estados vacíos

| Situación | Texto |
|---|---|
| Celular inválido al apartar | Escribe tu celular de 10 dígitos. Debe empezar por 3. |
| Falta el nombre | Escribe tu nombre para saber de quién son los números. |
| Sin conexión al apartar | No se pudo conectar. Revisa tu internet e intenta de nuevo. |
| Cantidad fuera de rango | Elige entre 1 y 30 números. |
| Sorteo no disponible | Este sorteo ya no está disponible. |
| Fallo al cargar una pantalla | No se pudo cargar. Revisa tu conexión y vuelve a abrir el link. |
| Ruleta apagada | Ruleta apagada |
| Error al girar | Intenta de nuevo |
| Copiado correcto | Copiado |
| No se pudo copiar | Mantén presionado el texto para copiarlo |

Reglas de redacción: frases cortas, en segunda persona, que digan qué pasó y qué hacer. Sin tecnicismos.

## 9. Consideraciones abiertas

Puntos que el prototipo resuelve de forma simple y que conviene decidir antes de publicar:

1. **Privacidad de la consulta por celular.** Cualquiera que escriba un celular ajeno ve el nombre, los números y la deuda de esa persona. Mitigación mínima obligatoria: límite de consultas por IP. Opciones adicionales: mostrar solo el primer nombre, u ocultar parte de los datos.
2. **Tiros de ruleta con celulares ajenos.** Alguien puede gastar el tiro de otro número o jugar con números inventados. Mitigación: límite por IP y por dispositivo; el premio se entrega a mano verificando el celular.
3. **Reservas falsas.** Cualquiera puede apartar sin pagar. Mitigación: límite por IP, máximo 30 números por operación y la acción "Liberar". **[Propuesto]** vencimiento automático de reservas no pagadas.
4. **Cierre del sorteo.** El prototipo no cierra las ventas a la hora del sorteo ni registra el número ganador. **[Propuesto]** cierre automático, registro de resultado e historial.
5. **Contenido subido.** La proforma base usa solo ilustraciones originales. Las imágenes que suba el administrador deben ser propias o con licencia de uso.
