# CLAUDE.md — El Pato de la Suerte

Web app móvil para apartar números de sorteos (tablero 00–99) con ruleta diaria, consulta de números y panel de administración privado.

## Fuentes de verdad

1. `docs/` es la especificación. Si el código y `docs/` se contradicen, gana `docs/` o se pregunta.
2. `referencia/prototipo.html` es la referencia visual y de comportamiento. Se abre directo en el navegador y funciona en modo prueba (clave de administrador de prueba: `1234`).
3. `referencia/reglas-servidor-referencia.sql` muestra las reglas de servidor del prototipo. Es solo lectura: **no se usa Supabase**.

## Reglas del proyecto

- **Idioma:** toda la interfaz y los mensajes al usuario van en español de Colombia. Código, nombres de variables y commits pueden ir en inglés o español, pero de forma consistente.
- **Móvil primero:** cada pantalla se diseña y se prueba primero a 375×667 y 390×844. La página nunca se desplaza de lado.
- **Dos aplicaciones separadas:** `web-public` y `web-admin`. El paquete público no importa nada del panel ni contiene rutas, textos o enlaces de administración.
- **El servidor decide:** el resultado de la ruleta, la unicidad de los números y los permisos se validan siempre en el servidor. El navegador solo muestra.
- **Un número no se repite:** la unicidad `(sorteo, número)` la garantiza la base de datos con una restricción, no una consulta previa.
- **Zona horaria de negocio:** `America/Bogota` para "hoy", "tiro del día" y fechas de sorteo.
- **Teléfonos:** celulares colombianos, 10 dígitos que empiezan por 3. Se guardan sin espacios ni prefijo.
- **Dinero:** pesos colombianos sin decimales, con formato `$10.000`.
- **Sin dependencias de terceros en tiempo de ejecución** para fuentes, imágenes o scripts: todo se sirve desde el propio VPS.
- **Sin Supabase, sin Netlify.**
- **Base de datos:** el esquema final se define aparte. Trabaja contra la capa de repositorios descrita en `docs/04` y `docs/05`; no asumas tablas que no estén acordadas.
- **Secretos:** nunca en el repositorio. Solo en variables de entorno; mantener `.env.example` actualizado.
- **Imágenes subidas:** son contenido no confiable. Validar tipo real, reprocesar y servir desde una ruta estática sin ejecución.

## Forma de trabajo

- Seguir las fases de `docs/07-plan-de-desarrollo.md`, una a la vez, y parar al final de cada una.
- Cada función nueva lleva su prueba. No marcar una fase como terminada con pruebas fallando.
- Antes de dar por buena una pantalla, compararla con el prototipo en tamaño de celular.
- Si falta un dato (dominio, esquema de base de datos, credenciales), preguntar en vez de inventarlo.

## Datos pendientes del dueño del proyecto

- `DOMINIO_PUBLICO` y `SUBDOMINIO_ADMIN`.
- Motor y esquema definitivo de base de datos.
