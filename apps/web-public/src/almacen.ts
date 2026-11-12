import { hoyBogota } from '@pato/shared';

/** Comodidades del navegador (docs/01 §5.3). Nunca son reglas: el servidor valida siempre. */
const leer = <T>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
const escribir = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* almacenamiento bloqueado */
  }
};

export interface GiroGuardado {
  resultado: string[];
  gano: number;
  premio: string;
  tel: string;
  /** Cuándo se guardó, para compararlo con el reinicio de la ruleta. */
  guardado?: string;
}

export const hoy = () => hoyBogota(new Date());
export const miTel = (): string => leer<string>('mi_tel') ?? '';
export const guardarMiTel = (t: string) => escribir('mi_tel', t);
/**
 * Tiro de hoy guardado en este celular. Si el administrador reinició la ruleta de hoy después de
 * guardarlo (marca `reinicio` de /config), se olvida para que el celular vuelva a ver la ruleta.
 */
export const giroDeHoy = (reinicio = ''): GiroGuardado | null => {
  const g = leer<GiroGuardado>('giro_' + hoy());
  if (g && reinicio && (g.guardado ?? '') < reinicio) return null;
  return g;
};
export const guardarGiroDeHoy = (g: Omit<GiroGuardado, 'guardado'>) => escribir('giro_' + hoy(), { ...g, guardado: new Date().toISOString() });
