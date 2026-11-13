/**
 * Esquema SQLite. Las garantías de docs/05 §5 viven aquí como restricciones,
 * no como consultas previas en el código.
 *
 * Una migración es SQL o { sql, sinClaves }. Con sinClaves se apagan las claves foráneas mientras corre:
 * es la forma que pide SQLite para reconstruir una tabla (cambiar un CHECK) sin borrar en cascada sus hijas.
 */
export type Migracion = string | { sql: string; sinClaves: true };

export const MIGRACIONES: Migracion[] = [
  `
  CREATE TABLE sorteos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL CHECK (length(nombre) > 0),
    loteria TEXT NOT NULL DEFAULT '',
    jornada TEXT NOT NULL DEFAULT 'dia' CHECK (jornada IN ('dia','noche')),
    fecha TEXT,
    hora TEXT NOT NULL DEFAULT '',
    orden INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    etiqueta TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    valor_boleta INTEGER NOT NULL CHECK (valor_boleta > 0),
    premio_total INTEGER NOT NULL DEFAULT 0 CHECK (premio_total >= 0),
    premio_ultimas INTEGER NOT NULL DEFAULT 0 CHECK (premio_ultimas >= 0),
    premio_primeras INTEGER NOT NULL DEFAULT 0 CHECK (premio_primeras >= 0),
    premio_medio INTEGER NOT NULL DEFAULT 0 CHECK (premio_medio >= 0),
    nequi TEXT NOT NULL DEFAULT '',
    nequi_titular TEXT NOT NULL DEFAULT '',
    imagen TEXT NOT NULL DEFAULT '',
    logo_loteria TEXT NOT NULL DEFAULT '',
    logo_ocupado TEXT NOT NULL DEFAULT '',
    fondo_imagen TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL
  );

  CREATE TABLE contactos (
    telefono TEXT PRIMARY KEY CHECK (telefono GLOB '3[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    nombre TEXT NOT NULL CHECK (length(nombre) >= 2),
    creado TEXT NOT NULL
  );

  CREATE TABLE reservas (
    id TEXT PRIMARY KEY,
    sorteo_id TEXT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 0 AND 99),
    telefono TEXT NOT NULL CHECK (telefono GLOB '3[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('cliente','fijo')),
    pagado INTEGER NOT NULL DEFAULT 0 CHECK (pagado IN (0,1)),
    creado TEXT NOT NULL,
    UNIQUE (sorteo_id, numero)
  );
  CREATE INDEX reservas_telefono ON reservas(telefono);

  CREATE TABLE config_ruleta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    activo INTEGER NOT NULL DEFAULT 1,
    prob_tres REAL NOT NULL DEFAULT 1 CHECK (prob_tres BETWEEN 0 AND 100),
    premio_tres TEXT NOT NULL DEFAULT 'Un número gratis',
    prob_dos REAL NOT NULL DEFAULT 10 CHECK (prob_dos BETWEEN 0 AND 100),
    premio_dos TEXT NOT NULL DEFAULT '$1.000 de descuento',
    CHECK (prob_tres + prob_dos <= 100)
  );
  INSERT INTO config_ruleta (id) VALUES (1);

  CREATE TABLE giros (
    id TEXT PRIMARY KEY,
    telefono TEXT NOT NULL CHECK (telefono GLOB '3[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    fecha TEXT NOT NULL,
    resultado TEXT NOT NULL,
    gano INTEGER NOT NULL CHECK (gano IN (0,2,3)),
    premio TEXT NOT NULL DEFAULT '',
    reclamado INTEGER NOT NULL DEFAULT 0,
    creado TEXT NOT NULL,
    UNIQUE (telefono, fecha)
  );

  CREATE TABLE ajustes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    negocio TEXT NOT NULL DEFAULT 'El Pato de la Suerte',
    whatsapp TEXT NOT NULL DEFAULT '',
    plantilla TEXT NOT NULL DEFAULT '',
    diseno TEXT NOT NULL DEFAULT '{}'
  );
  INSERT INTO ajustes (id) VALUES (1);

  CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    clave_hash TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    creado TEXT NOT NULL,
    ultimo_ingreso TEXT
  );

  CREATE TABLE sesiones (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    creada TEXT NOT NULL,
    ultimo_uso TEXT NOT NULL,
    expira TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    agente TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE medios (
    id TEXT PRIMARY KEY,
    ruta TEXT NOT NULL UNIQUE,
    uso TEXT NOT NULL,
    ancho INTEGER NOT NULL,
    alto INTEGER NOT NULL,
    peso INTEGER NOT NULL,
    creado TEXT NOT NULL
  );

  CREATE TABLE auditoria (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL DEFAULT '',
    entidad_id TEXT NOT NULL DEFAULT '',
    detalle TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL
  );
  `,
  // 2: mensaje del ticket editable y marca de "reiniciar la ruleta de hoy para todos".
  `
  ALTER TABLE ajustes ADD COLUMN plantilla_ticket TEXT NOT NULL DEFAULT '';
  ALTER TABLE config_ruleta ADD COLUMN reinicio TEXT NOT NULL DEFAULT '';
  `,
  // 3: historial de números liberados (para volver a ofrecerlos).
  `
  CREATE TABLE liberados (
    id TEXT PRIMARY KEY,
    sorteo_id TEXT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 0 AND 99),
    telefono TEXT NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    pagado INTEGER NOT NULL DEFAULT 0,
    liberado TEXT NOT NULL
  );
  CREATE INDEX liberados_sorteo ON liberados(sorteo_id, liberado);
  `,
  // 4: seguridad contra acaparamiento. Cada navegador tiene una cookie de dispositivo; se guarda
  // desde qué dispositivo y red se apartó, los intentos, las alertas y los bloqueos.
  `
  CREATE TABLE dispositivos (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL DEFAULT '',
    agente TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL,
    visto TEXT NOT NULL,
    bloqueado INTEGER NOT NULL DEFAULT 0 CHECK (bloqueado IN (0,1)),
    bloqueado_en TEXT,
    motivo TEXT NOT NULL DEFAULT ''
  );
  ALTER TABLE reservas ADD COLUMN dispositivo_id TEXT;
  ALTER TABLE reservas ADD COLUMN ip TEXT NOT NULL DEFAULT '';
  CREATE INDEX reservas_dispositivo ON reservas(sorteo_id, dispositivo_id);
  CREATE INDEX reservas_ip ON reservas(sorteo_id, ip);

  CREATE TABLE intentos (
    id TEXT PRIMARY KEY,
    dispositivo_id TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    sorteo_id TEXT NOT NULL,
    telefono TEXT NOT NULL DEFAULT '',
    nombre TEXT NOT NULL DEFAULT '',
    numeros TEXT NOT NULL DEFAULT '[]',
    resultado TEXT NOT NULL,
    creado TEXT NOT NULL
  );
  CREATE INDEX intentos_dispositivo ON intentos(dispositivo_id, creado);

  CREATE TABLE alertas (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    dispositivo_id TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    sorteo_id TEXT NOT NULL DEFAULT '',
    detalle TEXT NOT NULL DEFAULT '',
    veces INTEGER NOT NULL DEFAULT 1,
    vista INTEGER NOT NULL DEFAULT 0,
    creado TEXT NOT NULL
  );
  CREATE INDEX alertas_creado ON alertas(vista, creado);

  ALTER TABLE ajustes ADD COLUMN limite_dispositivo INTEGER NOT NULL DEFAULT 20 CHECK (limite_dispositivo BETWEEN 0 AND 100);
  `,
  // 5: sorteos gratis (valor 0), máximo de números por persona, apertura programada, imagen de "todos vendidos",
  // encabezado y final de la lista para WhatsApp; historial de cierres al reiniciar; premios de la ruleta por símbolo.
  // valor_boleta pasa de "> 0" a ">= 0 (solo si es gratis)": cambiar un CHECK obliga a reconstruir la tabla.
  {
    sinClaves: true,
    sql: `
  CREATE TABLE sorteos_nueva (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL CHECK (length(nombre) > 0),
    loteria TEXT NOT NULL DEFAULT '',
    jornada TEXT NOT NULL DEFAULT 'dia' CHECK (jornada IN ('dia','noche')),
    fecha TEXT,
    hora TEXT NOT NULL DEFAULT '',
    orden INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    etiqueta TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    valor_boleta INTEGER NOT NULL CHECK (valor_boleta >= 0),
    premio_total INTEGER NOT NULL DEFAULT 0 CHECK (premio_total >= 0),
    premio_ultimas INTEGER NOT NULL DEFAULT 0 CHECK (premio_ultimas >= 0),
    premio_primeras INTEGER NOT NULL DEFAULT 0 CHECK (premio_primeras >= 0),
    premio_medio INTEGER NOT NULL DEFAULT 0 CHECK (premio_medio >= 0),
    nequi TEXT NOT NULL DEFAULT '',
    nequi_titular TEXT NOT NULL DEFAULT '',
    imagen TEXT NOT NULL DEFAULT '',
    logo_loteria TEXT NOT NULL DEFAULT '',
    logo_ocupado TEXT NOT NULL DEFAULT '',
    fondo_imagen TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL,
    gratis INTEGER NOT NULL DEFAULT 0 CHECK (gratis IN (0,1)),
    max_por_celular INTEGER NOT NULL DEFAULT 0 CHECK (max_por_celular BETWEEN 0 AND 100),
    abre TEXT CHECK (abre IS NULL OR abre GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]'),
    imagen_agotado TEXT NOT NULL DEFAULT '',
    lista_encabezado TEXT NOT NULL DEFAULT '',
    lista_pie TEXT NOT NULL DEFAULT '',
    CHECK (gratis = 1 OR valor_boleta > 0)
  );
  INSERT INTO sorteos_nueva (id, nombre, loteria, jornada, fecha, hora, orden, color, etiqueta, activo, valor_boleta,
    premio_total, premio_ultimas, premio_primeras, premio_medio, nequi, nequi_titular, imagen, logo_loteria, logo_ocupado,
    fondo_imagen, creado)
  SELECT id, nombre, loteria, jornada, fecha, hora, orden, color, etiqueta, activo, valor_boleta,
    premio_total, premio_ultimas, premio_primeras, premio_medio, nequi, nequi_titular, imagen, logo_loteria, logo_ocupado,
    fondo_imagen, creado FROM sorteos;
  DROP TABLE sorteos;
  ALTER TABLE sorteos_nueva RENAME TO sorteos;

  CREATE TABLE cierres (
    id TEXT PRIMARY KEY,
    sorteo_id TEXT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    fecha TEXT,
    reservas TEXT NOT NULL,
    creado TEXT NOT NULL
  );
  CREATE INDEX cierres_sorteo ON cierres(sorteo_id, creado);

  ALTER TABLE config_ruleta ADD COLUMN premios_tres TEXT NOT NULL DEFAULT '{}';
  `,
  },
];
