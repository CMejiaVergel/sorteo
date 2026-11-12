# 06 · Seguridad, administradores y despliegue en el VPS

Datos pendientes: `DOMINIO_PUBLICO` y `SUBDOMINIO_ADMIN`. En todo el documento se usan esos dos nombres como marcadores.

## 1. Dos sitios, dos niveles de exposición

| | Sitio público | Panel de administración |
|---|---|---|
| Dirección | `https://DOMINIO_PUBLICO` | `https://SUBDOMINIO_ADMIN` |
| Quién entra | Cualquiera con el link | Solo quien conozca la dirección **y** tenga usuario y contraseña |
| Contenido | `web-public` + `/api/public/*` + imágenes | `web-admin` + `/api/admin/*` + imágenes |
| Buscadores | Permitidos | Bloqueados |
| Enlaces entre ambos | Ninguno hacia el panel | Puede enlazar al sitio público ("Ver como cliente") |

## 2. Qué significa "oculto" para el subdominio

Un subdominio **no se puede hacer invisible** del todo: es una dirección de internet. Lo que sí se puede es que nadie lo encuentre por casualidad y que, si lo encuentra, no pueda hacer nada sin credenciales. **La protección real es el login; el nombre oculto es una capa adicional.**

### Medidas obligatorias

1. **Nombre no adivinable.** No usar `admin`, `panel`, `gestion` ni similares. Usar una etiqueta sin significado, por ejemplo `k7m2x9.DOMINIO_PUBLICO`.
2. **Certificado comodín.** Emitir un certificado `*.DOMINIO_PUBLICO` en lugar de uno con el nombre del subdominio. Todo certificado público queda anotado en registros abiertos (Certificate Transparency); con uno individual, el nombre del subdominio sería consultable por cualquiera. El comodín solo revela el dominio. Requiere validación por DNS (reto DNS-01).
3. **Cero rastros en el sitio público.** El subdominio no aparece en el código de `web-public`, ni en cabeceras, ni en `robots.txt`, ni en el mapa del sitio, ni en mensajes de error.
4. **Sin indexación.** El panel responde siempre con `X-Robots-Tag: noindex, nofollow` y su propio `robots.txt` con `Disallow: /`.
5. **Servidor por defecto mudo.** Una petición a la IP del VPS o con un nombre desconocido no recibe respuesta (en Nginx, `return 444`). Así escanear la IP no revela que existe un panel.
6. **API de administración inalcanzable desde el dominio público.** El proxy del dominio público no enruta `/api/admin/*`.

### Capas opcionales, de menor a mayor aislamiento

| Opción | Qué añade | Costo de uso |
|---|---|---|
| Lista de IP permitidas en el proxy | Solo responden las IP autorizadas | Requiere IP fija; incómodo desde datos móviles |
| Red privada (WireGuard o Tailscale) | El subdominio solo resuelve dentro de la red privada. Es la única forma de que **de verdad** no sea accesible desde internet | Hay que activar la VPN en cada dispositivo del administrador |
| Segundo factor (TOTP) en el login | Una contraseña robada no basta | Un paso más al entrar |

Recomendación: empezar con las medidas obligatorias y agregar **segundo factor** en cuanto el panel esté en uso real.

## 3. Autenticación de administradores

### Contraseñas

- Guardadas con **argon2id**. Parámetros mínimos: 19 MiB de memoria, 2 iteraciones, paralelismo 1.
- Longitud mínima: 12 caracteres. Sin reglas de composición.
- Nunca se registran en logs ni se devuelven por la API.

### Inicio de sesión

- Formulario de usuario y contraseña en `/login`.
- Mensaje único ante cualquier fallo: "Usuario o contraseña incorrectos". No se revela si el usuario existe.
- Tiempo de respuesta uniforme: si el usuario no existe, se calcula igualmente un hash de relleno.
- Límite: 5 intentos por IP y por usuario cada 15 minutos, con espera creciente.
- Cada inicio de sesión, correcto o fallido, queda en la auditoría con fecha e IP.

### Sesión

- Identificador aleatorio guardado en la base de datos. La cookie solo lleva ese identificador, firmado.
- Cookie: `__Host-sesion`, con `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, sin atributo `Domain`. Queda atada al subdominio del panel y no viaja al sitio público.
- Vigencia: 8 horas de inactividad y 7 días como máximo absoluto.
- Al iniciar sesión se genera un identificador nuevo.
- Cerrar sesión borra la sesión en el servidor.
- Cambiar la contraseña o desactivar un usuario cierra todas sus sesiones.

### Protección de las escrituras

- `SameSite=Strict` y, además, toda petición que modifique datos comprueba que la cabecera `Origin` sea exactamente `ADMIN_ORIGIN`.
- La API de administración no habilita CORS para ningún otro origen.

### Lo que no existe

- Registro por web.
- "Olvidé mi contraseña" por correo. Las contraseñas se cambian por terminal.
- Roles. Todo administrador puede hacer todo. **[Propuesto]** un rol de "cobrador" que solo marque pagos.

## 4. Administradores por terminal

Los usuarios se gestionan solo desde la terminal del VPS.

```bash
# Crear (pide la contraseña dos veces, sin mostrarla)
docker compose exec api node dist/cli/admin.js crear miguel

# Cambiar contraseña (cierra sus sesiones)
docker compose exec api node dist/cli/admin.js clave miguel

# Desactivar y reactivar
docker compose exec api node dist/cli/admin.js desactivar miguel
docker compose exec api node dist/cli/admin.js activar miguel

# Ver usuarios y último ingreso
docker compose exec api node dist/cli/admin.js listar

# Cerrar todas las sesiones de un usuario
docker compose exec api node dist/cli/admin.js cerrar-sesiones miguel
```

Reglas de la herramienta:

- La contraseña se pide de forma interactiva. **No** se acepta como argumento, porque quedaría en el historial de la terminal.
- Usuario: 3 a 32 caracteres, letras minúsculas, números, punto y guion.
- Sale con código distinto de cero y un mensaje claro si algo falla.
- No expone ninguna ruta de red: escribe directo en la base de datos.

## 5. Protección del sitio público

### Límites de peticiones (valores de partida, por IP)

| Ruta | Límite |
|---|---|
| `POST /sorteos/:id/reservas` | 10 por minuto |
| `POST /ruleta/giro` | 5 por minuto |
| `GET /contactos/:telefono` | 20 por minuto |
| `GET /mis-numeros` | 10 por minuto |
| Resto de lecturas | 120 por minuto |

Detrás del proxy, la API debe tomar la IP real de la cabecera que este envía, confiando solo en el proxy.

### Validación

- Toda entrada se valida con los esquemas compartidos, en el servidor, aunque el formulario ya la haya validado.
- Todo texto de usuarios (nombres, etiquetas, premios, plantillas) se muestra siempre escapado.
- Tamaño máximo de cuerpo: 64 KB en JSON; 8 MB en subida de imágenes.

### Imágenes subidas

Reglas completas en `docs/03` §6. En resumen: solo JPG, PNG y WebP verificados por contenido; siempre reprocesadas; nombre generado por el servidor; servidas como archivos estáticos desde una carpeta sin ejecución, con `X-Content-Type-Options: nosniff`.

### Cabeceras

| Cabecera | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` en el panel; `strict-origin-when-cross-origin` en el público |
| `Permissions-Policy` | Desactivar cámara, micrófono y geolocalización |
| `X-Robots-Tag` | `noindex, nofollow` solo en el panel |

`'unsafe-inline'` en estilos se necesita porque la interfaz pasa colores y medidas como variables CSS en el atributo `style`. No se permite ningún script en línea.

Los enlaces a WhatsApp (`https://wa.me/…`) son navegación normal y no necesitan permisos especiales.

## 6. Despliegue en el VPS

### 6.1 Preparación del servidor

1. Sistema: Ubuntu Server LTS vigente, actualizado, con actualizaciones de seguridad automáticas.
2. Usuario sin privilegios para el despliegue. Acceso SSH solo con llave; sin contraseña y sin acceso de `root`.
3. Cortafuegos: abiertos solo 22, 80 y 443.
4. `fail2ban` para SSH.
5. Docker y Docker Compose.
6. Zona horaria del sistema: indistinta. La app usa `America/Bogota` por configuración.

### 6.2 DNS y certificado

1. Registro `A` de `DOMINIO_PUBLICO` hacia la IP del VPS.
2. Registro `A` de `SUBDOMINIO_ADMIN` hacia la misma IP. No crear un registro comodín `*`: con él, cualquier nombre respondería.
3. Certificado comodín `*.DOMINIO_PUBLICO` más `DOMINIO_PUBLICO`, con Let's Encrypt y reto DNS-01 (certbot o acme.sh con el complemento del proveedor de DNS). Renovación automática.

Si el sitio público usa el dominio raíz y el panel un subdominio de ese mismo dominio, un solo certificado cubre ambos.

### 6.3 Servicios

`infra/docker-compose.yml` con:

| Servicio | Función | Puertos |
|---|---|---|
| `api` | Fastify | Solo red interna |
| `db` | Base de datos (si vive en el mismo VPS) | Solo red interna |
| `proxy` | Nginx con los estáticos compilados | 80 y 443 |

Volúmenes persistentes: datos de la base, carpeta de imágenes y certificados.

### 6.4 Proxy inverso

Esquema de la configuración de Nginx (resumido):

```nginx
# Cualquier nombre desconocido o acceso por IP: sin respuesta
server {
  listen 443 ssl default_server;
  ssl_reject_handshake on;
}
server { listen 80 default_server; return 444; }

# Redirección a HTTPS de los dos nombres conocidos
server {
  listen 80;
  server_name DOMINIO_PUBLICO SUBDOMINIO_ADMIN;
  return 301 https://$host$request_uri;
}

# Sitio público
server {
  listen 443 ssl;
  http2 on;
  server_name DOMINIO_PUBLICO;

  root /srv/web-public;
  location / { try_files $uri /index.html; }

  location /api/public/ { proxy_pass http://api:3000; }
  location /api/        { return 404; }          # nada de /api/admin aquí

  location /medios/ {
    alias /srv/medios/;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Content-Type-Options nosniff;
  }
}

# Panel de administración
server {
  listen 443 ssl;
  http2 on;
  server_name SUBDOMINIO_ADMIN;

  add_header X-Robots-Tag "noindex, nofollow" always;
  client_max_body_size 8m;

  root /srv/web-admin;
  location / { try_files $uri /index.html; }

  location /api/admin/ { proxy_pass http://api:3000; }
  location /api/       { return 404; }

  location /medios/ { alias /srv/medios/; add_header X-Content-Type-Options nosniff; }
}
```

Además: compresión para texto, caché larga para los archivos con huella en el nombre, sin caché para `index.html`, y paso de la IP real a la API.

El panel sirve las imágenes desde su mismo subdominio para previsualizarlas sin llamar al dominio público.

### 6.5 Procedimiento de despliegue

1. Obtener la versión a desplegar (etiqueta de git).
2. Construir: `shared` → `api`, `web-public`, `web-admin`.
3. Aplicar los cambios de base de datos acordados.
4. `docker compose up -d` y esperar la comprobación de salud.
5. Verificar: sitio público, login del panel, apartar un número de prueba, girar la ruleta en modo prueba, subir una imagen.
6. Si algo falla: volver a la etiqueta anterior.

Rutas de salud: `GET /api/public/salud` responde `200` solo si la API puede leer la base de datos.

### 6.6 Copias de seguridad

| Qué | Frecuencia | Retención |
|---|---|---|
| Base de datos (volcado completo) | Diaria, de madrugada | 14 diarias y 8 semanales |
| Carpeta de imágenes | Diaria, incremental | Igual |
| Archivo `.env` | Tras cada cambio | En un lugar seguro fuera del VPS |

Al menos una copia fuera del VPS. Probar la restauración antes de salir a producción y luego cada cierto tiempo.

### 6.7 Operación

- Registros de la API en JSON, con rotación. **Sin** celulares completos ni nombres en los registros de acceso: enmascarar a los últimos 4 dígitos.
- Aviso externo si el sitio deja de responder.
- Revisar cada semana los intentos de login fallidos.

## 7. Lista de verificación antes de publicar

- [ ] El sitio público no contiene la palabra "admin" ni el subdominio en ningún archivo compilado.
- [ ] `https://DOMINIO_PUBLICO/api/admin/auth/yo` responde `404`.
- [ ] Abrir la IP del VPS en el navegador no devuelve nada.
- [ ] El certificado en uso es el comodín.
- [ ] El panel responde con `X-Robots-Tag: noindex`.
- [ ] Sin sesión, toda ruta de `/api/admin/*` salvo el login responde `401`.
- [ ] Seis intentos de login fallidos seguidos reciben `429`.
- [ ] Dos peticiones simultáneas por el mismo número: una recibe `201` y la otra `409`.
- [ ] Un mismo celular no puede girar dos veces el mismo día.
- [ ] `GET /api/public/config` no contiene probabilidades.
- [ ] Subir un archivo que no es imagen, con extensión `.png`, se rechaza.
- [ ] La copia de seguridad se restauró con éxito en un entorno de prueba.
- [ ] El administrador se creó por terminal y puede iniciar sesión.
