import type {
  Ajustes,
  AlertaSeguridad,
  ConfigRuleta,
  Contacto,
  Diseno,
  DispositivoResumen,
  Giro,
  IntentoReserva,
  Liberado,
  Reserva,
  Sorteo,
  SorteoAdmin,
  SorteoEntrada,
  SorteoMisNumeros,
  SorteoResumen,
} from '@pato/shared';

/** El resto del código solo conoce estas interfaces (docs/05 §6). */

export class NumerosOcupados extends Error {
  constructor(public ocupados: number[]) {
    super('numeros_ocupados');
  }
}
export class YaGiro extends Error {
  constructor() {
    super('ya_giro');
  }
}
export class CelularDeOtro extends Error {
  constructor(public contacto: { telefono: string; nombre: string }) {
    super('celular_de_otro');
  }
}
/** El dispositivo superaría su límite de números en el sorteo. */
export class LimiteDispositivo extends Error {
  constructor(public tiene: number) {
    super('limite_dispositivo');
  }
}
export class UsuarioRepetido extends Error {
  constructor() {
    super('usuario_repetido');
  }
}

export interface Persona {
  telefono: string;
  nombre: string;
}

export interface RepoSorteos {
  listarActivos(): Promise<SorteoResumen[]>;
  listarTodos(): Promise<SorteoAdmin[]>;
  obtener(id: string): Promise<Sorteo | null>;
  guardar(datos: SorteoEntrada, id?: string): Promise<Sorteo>;
  eliminar(id: string): Promise<boolean>;
  /** Rutas de imágenes en uso por cualquier sorteo. */
  imagenesEnUso(): Promise<string[]>;
}

export interface RepoReservas {
  ocupados(sorteoId: string): Promise<number[]>;
  porSorteo(sorteoId: string): Promise<Reserva[]>;
  /**
   * Transacción. Lanza NumerosOcupados si alguno ya existe. Con `origen` guarda desde qué dispositivo y red se apartó;
   * si además trae `max` (> 0), lanza LimiteDispositivo cuando ese dispositivo pasaría de `max` números en el sorteo
   * (se revisa dentro de la misma transacción, así que peticiones simultáneas no lo saltan).
   */
  apartar(sorteoId: string, numeros: number[], persona: Persona, tipo: 'cliente' | 'fijo', origen?: Origen): Promise<void>;
  /** Sin `numeros`, todos los de la persona en el sorteo. */
  marcarPago(sorteoId: string, telefono: string, pagado: boolean, numeros?: number[]): Promise<number>;
  /** Borra las reservas y las guarda en el historial de liberados (transacción). Sin `numeros`, todas las de la persona. */
  liberar(sorteoId: string, telefono: string, numeros?: number[], ahora?: string): Promise<number>;
  liberados(sorteoId: string): Promise<Liberado[]>;
  borrarLiberados(sorteoId: string): Promise<number>;
  porTelefono(telefono: string, desde: string): Promise<SorteoMisNumeros[]>;
}

export interface Origen {
  dispositivo: string;
  ip: string;
  max?: number;
}

export interface RepoSeguridad {
  /** Crea o actualiza el dispositivo (última IP, navegador, visto). Devuelve si está bloqueado. */
  tocar(d: { id: string; ip: string; agente: string }): Promise<{ bloqueado: boolean }>;
  limite(): Promise<number>;
  guardarLimite(n: number): Promise<void>;
  /** Cuántos números y celulares distintos tiene el dispositivo en el sorteo. */
  usoDispositivo(sorteoId: string, dispositivo: string): Promise<{ numeros: number; celulares: number }>;
  /** Cuántos números se apartaron en el sorteo desde esa red (IP), con cualquier dispositivo. */
  usoRed(sorteoId: string, ip: string): Promise<{ numeros: number; dispositivos: number }>;
  registrarIntento(i: Omit<IntentoReserva, 'id' | 'creado' | 'sorteo'>): Promise<void>;
  /** Si ya hay una alerta sin ver del mismo tipo, dispositivo y sorteo, la actualiza y suma una vez. */
  alertar(a: { tipo: string; dispositivo_id: string; ip: string; sorteo_id: string; detalle: string }): Promise<void>;
  alertas(limite?: number): Promise<AlertaSeguridad[]>;
  pendientes(): Promise<number>;
  marcarVistas(): Promise<number>;
  /** Dispositivos con números apartados, intentos en los últimos 14 días o bloqueados. */
  dispositivos(q?: string): Promise<DispositivoResumen[]>;
  intentos(dispositivo: string, limite?: number): Promise<IntentoReserva[]>;
  bloquear(id: string, bloqueado: boolean, motivo?: string): Promise<boolean>;
  /** Libera (al historial) los números sin pagar que apartó el dispositivo. Devuelve cuántos y de qué sorteos. */
  liberarDeDispositivo(id: string): Promise<{ liberados: number; sorteos: string[] }>;
}

export interface RepoContactos {
  buscar(telefono: string): Promise<Contacto | null>;
  buscarPorNombre(nombre: string): Promise<Contacto | null>;
  listar(q?: string): Promise<Contacto[]>;
  /** Al apartar: conserva el nombre guardado si ya existía. */
  crearSiNoExiste(c: Contacto): Promise<Contacto>;
  /** Panel: crea o actualiza el nombre. */
  guardar(lista: Contacto[]): Promise<void>;
  eliminar(telefono: string): Promise<boolean>;
  /**
   * Corrige nombre y/o celular de un contacto y lo aplica a sus reservas (transacción).
   * Devuelve false si no existe; lanza CelularDeOtro si el celular nuevo ya es de otro contacto.
   */
  editar(telefonoAntes: string, c: { telefono: string; nombre: string }): Promise<boolean>;
}

export interface RepoRuleta {
  config(): Promise<ConfigRuleta>;
  guardarConfig(c: ConfigRuleta): Promise<void>;
  giroDe(telefono: string, fecha: string): Promise<Giro | null>;
  /** Lanza YaGiro si viola la unicidad (telefono, fecha). */
  registrar(g: Omit<Giro, 'id' | 'reclamado' | 'creado'>): Promise<Giro>;
  ganadores(): Promise<Giro[]>;
  total(): Promise<number>;
  marcarReclamado(id: string, reclamado: boolean): Promise<boolean>;
  reiniciar(telefono: string, fecha: string): Promise<boolean>;
  /** Borra todos los tiros del día y guarda la marca de reinicio (los celulares olvidan su tiro guardado). */
  reiniciarTodos(fecha: string, ahora: string): Promise<number>;
  marcaReinicio(): Promise<string>;
}

export interface RepoAjustes {
  obtener(): Promise<Ajustes & { diseno: Diseno }>;
  guardar(a: Partial<Ajustes & { diseno: Diseno }>): Promise<void>;
}

export interface Admin {
  id: string;
  usuario: string;
  clave_hash: string;
  activo: boolean;
  creado: string;
  ultimo_ingreso: string | null;
}

export interface Sesion {
  id: string;
  admin_id: string;
  creada: string;
  ultimo_uso: string;
  expira: string;
}

export interface RepoAdmins {
  porUsuario(usuario: string): Promise<Admin | null>;
  porId(id: string): Promise<Admin | null>;
  crear(usuario: string, claveHash: string): Promise<Admin>;
  cambiarClave(usuario: string, claveHash: string): Promise<boolean>;
  activar(usuario: string, activo: boolean): Promise<boolean>;
  marcarIngreso(id: string): Promise<void>;
  listar(): Promise<Admin[]>;
}

export interface RepoSesiones {
  crear(s: Sesion & { ip: string; agente: string }): Promise<void>;
  obtener(id: string): Promise<Sesion | null>;
  tocar(id: string, ahora: string): Promise<void>;
  eliminar(id: string): Promise<void>;
  eliminarDeAdmin(adminId: string): Promise<number>;
}

export interface RepoMedios {
  registrar(m: { id: string; ruta: string; uso: string; ancho: number; alto: number; peso: number }): Promise<void>;
  existe(ruta: string): Promise<boolean>;
  eliminar(ruta: string): Promise<void>;
}

export interface RepoAuditoria {
  anotar(a: { admin_id?: string | null; accion: string; entidad?: string; entidad_id?: string; detalle?: string; ip?: string }): Promise<void>;
}

export interface Repos {
  sorteos: RepoSorteos;
  reservas: RepoReservas;
  contactos: RepoContactos;
  ruleta: RepoRuleta;
  ajustes: RepoAjustes;
  admins: RepoAdmins;
  sesiones: RepoSesiones;
  medios: RepoMedios;
  auditoria: RepoAuditoria;
  seguridad: RepoSeguridad;
}
