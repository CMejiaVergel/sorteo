import type { Diseno } from './esquemas/index.ts';
import type { PremiosTres, Simbolo } from './simbolos.ts';

/** Forma de error de la API (docs/05 §1). */
export interface ErrorApi {
  error: { codigo: string; mensaje: string; detalle?: Record<string, unknown> };
}

export interface ConfigPublica {
  negocio: string;
  whatsapp: string;
  diseno: Diseno;
  plantilla_ticket: string;
  /** Momento del último "reiniciar la ruleta de hoy para todos": los celulares olvidan su tiro guardado anterior. */
  ruleta: { activo: boolean; premio_tres: string; premio_dos: string; premios_tres: PremiosTres; reinicio: string };
}

export interface SorteoResumen {
  id: string;
  nombre: string;
  loteria: string;
  jornada: 'dia' | 'noche';
  fecha: string | null;
  hora: string;
  valor_boleta: number;
  premio_total: number;
  color: string;
  etiqueta: string;
  orden: number;
  imagen: string;
  libres: number;
  gratis: boolean;
}

export interface Sorteo {
  id: string;
  nombre: string;
  loteria: string;
  jornada: 'dia' | 'noche';
  fecha: string | null;
  hora: string;
  orden: number;
  color: string;
  etiqueta: string;
  activo: boolean;
  valor_boleta: number;
  premio_total: number;
  premio_ultimas: number;
  premio_primeras: number;
  premio_medio: number;
  /** Premio "Unido": el número sale con la primera y la última cifra del resultado. 0 = este sorteo no lo da. */
  premio_unido: number;
  nequi: string;
  nequi_titular: string;
  imagen: string;
  logo_loteria: string;
  logo_ocupado: string;
  fondo_imagen: string;
  creado: string;
  /** Sorteo de regalo: la boleta vale 0 y el ticket no pide pago. */
  gratis: boolean;
  /** Números que puede apartar cada celular en este sorteo desde la página. 0 = sin límite. */
  max_por_celular: number;
  /** Apertura programada "AAAA-MM-DDTHH:MM" (hora de Bogotá). Antes de eso los clientes no lo ven. null = ya. */
  abre: string | null;
  /** Imagen que ven los clientes cuando se venden los 100 números (vacío = la general de Diseño). */
  imagen_agotado: string;
  /** Encabezado y final de la lista para WhatsApp, con variables (vacío = predeterminado). */
  lista_encabezado: string;
  lista_pie: string;
}

export interface SorteoPublico extends Omit<
  Sorteo,
  'orden' | 'etiqueta' | 'activo' | 'fondo_imagen' | 'creado' | 'abre' | 'lista_encabezado' | 'lista_pie'
> {
  ocupados: number[];
}

export interface SorteoAdmin extends Sorteo {
  ocupados: number;
}

export interface Reserva {
  id: string;
  sorteo_id: string;
  numero: number;
  telefono: string;
  nombre: string;
  tipo: 'cliente' | 'fijo';
  pagado: boolean;
  creado: string;
}

export interface SorteoMisNumeros {
  id: string;
  nombre: string;
  fecha: string | null;
  hora: string;
  jornada: 'dia' | 'noche';
  valor_boleta: number;
  nequi: string;
  nequi_titular: string;
  color: string;
  imagen: string;
  gratis: boolean;
  numeros: number[];
  pagados: number[];
}

export interface MisNumeros {
  nombre: string;
  sorteos: SorteoMisNumeros[];
}

/** Número que se liberó (queda en el historial para volver a ofrecerlo). */
export interface Liberado {
  id: string;
  sorteo_id: string;
  numero: number;
  telefono: string;
  nombre: string;
  tipo: 'cliente' | 'fijo';
  pagado: boolean;
  liberado: string;
}

export interface Contacto {
  telefono: string;
  nombre: string;
  creado?: string;
}

export interface Giro {
  id: string;
  telefono: string;
  fecha: string;
  resultado: Simbolo[];
  gano: 0 | 2 | 3;
  premio: string;
  reclamado: boolean;
  creado: string;
  nombre?: string;
}

export interface Ajustes {
  negocio: string;
  whatsapp: string;
  plantilla: string;
  plantilla_ticket: string;
}

/** Seguridad: un navegador identificado por su cookie, con lo que ha apartado. */
export interface DispositivoResumen {
  id: string;
  /** "Android · Chrome", "iPhone · Safari"… */
  descripcion: string;
  agente: string;
  ip: string;
  creado: string;
  visto: string;
  bloqueado: boolean;
  bloqueado_en: string | null;
  motivo: string;
  /** Números que tiene apartados ahora, en todos los sorteos. */
  apartados: number;
  rechazados: number;
  personas: { telefono: string; nombre: string }[];
  sorteos: { sorteo_id: string; nombre: string; numeros: number[]; pagados: number }[];
}

export interface IntentoReserva {
  id: string;
  dispositivo_id: string;
  ip: string;
  sorteo_id: string;
  sorteo: string;
  telefono: string;
  nombre: string;
  numeros: number[];
  /** ok, ocupados, limite, bloqueado */
  resultado: string;
  creado: string;
}

export interface AlertaSeguridad {
  id: string;
  /** limite, bloqueado, varios_celulares, misma_red */
  tipo: string;
  dispositivo_id: string;
  ip: string;
  sorteo_id: string;
  sorteo: string;
  detalle: string;
  veces: number;
  vista: boolean;
  creado: string;
}

export interface ResumenSeguridad {
  limite: number;
  pendientes: number;
  alertas: AlertaSeguridad[];
  dispositivos: DispositivoResumen[];
}
