import type { ConfigPublica, MisNumeros, SorteoPublico, SorteoResumen } from '@pato/shared';

export class FalloApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public detalle?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

const SIN_RED = 'No se pudo conectar. Revisa tu internet e intenta de nuevo.';

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api/public' + ruta, {
      ...init,
      headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new FalloApi(0, 'sin_red', SIN_RED);
  }
  if (r.ok) return r.status === 204 ? (undefined as T) : r.json();
  const cuerpo = await r.json().catch(() => null);
  const e = cuerpo?.error;
  throw new FalloApi(r.status, e?.codigo ?? 'error', e?.mensaje ?? 'No se pudo cargar. Revisa tu conexión y vuelve a abrir el link.', e?.detalle);
}

const post = <T>(ruta: string, body: unknown) => pedir<T>(ruta, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  config: () => pedir<ConfigPublica>('/config'),
  sorteos: () => pedir<SorteoResumen[]>('/sorteos'),
  sorteo: (id: string) => pedir<SorteoPublico>(`/sorteos/${encodeURIComponent(id)}`),
  /** Lista de ocupados con ETag: el navegador revalida y el servidor responde 304 si no cambió. */
  ocupados: (id: string) => pedir<{ ocupados: number[] }>(`/sorteos/${encodeURIComponent(id)}/ocupados`, { cache: 'no-cache' }),
  /** Canal del tablero en vivo (Server-Sent Events). */
  urlEnVivo: (id: string) => `/api/public/sorteos/${encodeURIComponent(id)}/en-vivo`,
  contacto: (tel: string) => pedir<{ nombre: string }>(`/contactos/${tel}`),
  reservar: (id: string, b: { numeros: number[]; nombre: string; telefono: string }) =>
    post<{ nombre: string; numeros: number[]; total: number }>(`/sorteos/${encodeURIComponent(id)}/reservas`, b),
  misNumeros: (tel: string) => pedir<MisNumeros>(`/mis-numeros?telefono=${tel}`),
  girar: (telefono: string) => post<{ resultado: string[]; gano: 0 | 2 | 3; premio: string }>('/ruleta/giro', { telefono }),
};
