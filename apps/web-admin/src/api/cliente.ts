import type { Ajustes, ConfigRuleta, Contacto, Diseno, Giro, IntentoReserva, Liberado, Reserva, ResultadoGiro, ResumenSeguridad, Sorteo, SorteoAdmin } from '@pato/shared';

export class FalloApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Se avisa cuando el servidor responde 401 para volver al login. */
export const alPerderSesion = new EventTarget();

async function pedir<T>(metodo: string, ruta: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api/admin' + ruta, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body !== undefined && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {},
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new FalloApi(0, 'sin_red', 'No se pudo conectar. Revisa tu internet e intenta de nuevo.');
  }
  if (r.ok) return r.json();
  const e = (await r.json().catch(() => null))?.error;
  if (r.status === 401 && ruta !== '/auth/login') alPerderSesion.dispatchEvent(new Event('401'));
  throw new FalloApi(r.status, e?.codigo ?? 'error', e?.mensaje ?? 'Algo salió mal. Intenta de nuevo.');
}

const get = <T>(r: string) => pedir<T>('GET', r);
const enviar = <T>(m: string, r: string, b?: unknown) => pedir<T>(m, r, b ?? {});

export type SorteoDatos = Omit<Sorteo, 'id' | 'creado'>;
export interface ResultadoFijos {
  agregadas: number;
  errores: string[];
}

export const api = {
  seguridad: (q = '') => get<ResumenSeguridad>('/seguridad' + (q ? '?q=' + encodeURIComponent(q) : '')),
  alertasPendientes: () => get<{ pendientes: number }>('/seguridad/pendientes'),
  intentos: (id: string) => get<IntentoReserva[]>(`/seguridad/dispositivos/${encodeURIComponent(id)}/intentos`),
  bloquear: (id: string, b: { bloqueado: boolean; motivo?: string; liberar?: boolean }) =>
    enviar<{ bloqueado: boolean; liberados: number }>('POST', `/seguridad/dispositivos/${encodeURIComponent(id)}/bloqueo`, b),
  marcarAlertasVistas: () => enviar<{ marcadas: number }>('POST', '/seguridad/alertas/vistas'),
  guardarLimite: (limite: number) => enviar<{ limite: number }>('PUT', '/seguridad/limite', { limite }),
  login: (usuario: string, clave: string) => enviar<{ usuario: string }>('POST', '/auth/login', { usuario, clave }),
  logout: () => enviar('POST', '/auth/logout'),
  yo: () => get<{ usuario: string; public_origin: string }>('/auth/yo'),

  sorteos: () => get<SorteoAdmin[]>('/sorteos'),
  sorteo: (id: string) => get<Sorteo>(`/sorteos/${id}`),
  crearSorteo: (d: SorteoDatos & { fijos?: string }) => enviar<{ sorteo: Sorteo; fijos: ResultadoFijos }>('POST', '/sorteos', d),
  editarSorteo: (id: string, d: Partial<SorteoDatos> & { fijos?: string }) =>
    enviar<{ sorteo: Sorteo; fijos: ResultadoFijos }>('PUT', `/sorteos/${id}`, d),
  eliminarSorteo: (id: string) => enviar('DELETE', `/sorteos/${id}`),
  reservas: (id: string) => get<Reserva[]>(`/sorteos/${id}/reservas`),
  fijos: (id: string, texto: string) => enviar<ResultadoFijos>('POST', `/sorteos/${id}/fijos`, { texto }),
  copiarFijos: (id: string, origen_id: string) =>
    enviar<{ copiadas: number; personas: number; saltados: string[] }>('POST', `/sorteos/${id}/fijos/copiar`, { origen_id }),
  apartar: (id: string, d: { telefono: string; nombre: string; numeros: number[]; fijo: boolean }) =>
    enviar<{ numeros: number[]; nombre: string; telefono: string }>('POST', `/sorteos/${id}/apartar`, d),
  /** Sin `numeros`, todos los de la persona. */
  marcarPago: (id: string, telefono: string, pagado: boolean, numeros?: number[]) =>
    enviar<{ cambiadas: number }>('PATCH', `/sorteos/${id}/reservas`, { telefono, pagado, numeros }),
  liberar: (id: string, telefono: string, numeros?: number[]) =>
    enviar<{ liberadas: number }>('POST', `/sorteos/${id}/reservas/liberar`, { telefono, numeros }),
  liberados: (id: string) => get<Liberado[]>(`/sorteos/${id}/liberados`),
  limpiarLiberados: (id: string) => enviar<{ borrados: number }>('DELETE', `/sorteos/${id}/liberados`),

  contactos: (q = '') => get<Contacto[]>(`/contactos?q=${encodeURIComponent(q)}`),
  crearContacto: (c: { nombre: string; telefono: string }) => enviar<Contacto>('POST', '/contactos', c),
  editarContacto: (antes: string, c: { nombre: string; telefono: string }) => enviar<Contacto>('PUT', `/contactos/${antes}`, c),
  guardarContactos: (texto: string) => enviar<{ guardados: number; errores: string[] }>('PUT', '/contactos', { texto }),
  borrarContacto: (tel: string) => enviar('DELETE', `/contactos/${tel}`),

  ruleta: () => get<ConfigRuleta>('/ruleta'),
  guardarRuleta: (c: ConfigRuleta) => enviar<ConfigRuleta>('PUT', '/ruleta', c),
  probarRuleta: () => enviar<ResultadoGiro>('POST', '/ruleta/prueba'),
  giros: () => get<{ ganadores: Giro[]; total: number }>('/ruleta/giros?ganadores=1'),
  marcarEntregado: (id: string, reclamado: boolean) => enviar('PATCH', `/ruleta/giros/${id}`, { reclamado }),
  reiniciarTodos: () => enviar<{ borrados: number }>('DELETE', '/ruleta/giros/hoy'),
  reiniciarTiro: (tel: string) => enviar<{ borrado: boolean }>('DELETE', `/ruleta/giros?telefono=${tel}&fecha=hoy`),

  diseno: () => get<Diseno>('/diseno'),
  guardarDiseno: (d: Diseno) => enviar<Diseno>('PUT', '/diseno', d),
  restablecerDiseno: () => enviar<Diseno>('DELETE', '/diseno'),
  ajustes: () => get<Ajustes>('/ajustes'),
  guardarAjustes: (a: Ajustes) => enviar<Ajustes>('PUT', '/ajustes', a),

  subirImagen: (archivo: File, uso: string) => {
    const f = new FormData();
    f.append('archivo', archivo);
    return pedir<{ url: string }>('POST', `/medios?uso=${uso}`, f);
  },
};
