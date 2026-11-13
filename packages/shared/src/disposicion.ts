import type { Diseno } from './esquemas/index.ts';

/**
 * Variables CSS con el tamaño y la posición de cada bloque de la ruleta (título, máquina, celular, botón):
 * --{bloque}-s (escala en veces), --{bloque}-x (% del ancho) y --{bloque}-y (% del alto).
 * Solo se ponen las que cambian; un diseño viejo sin `disposicion` deja todo como viene.
 */
export function variablesDisposicion(p: Partial<Diseno['ruleta']['disposicion']> | undefined): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, e] of Object.entries(p ?? {})) {
    if (!e) continue;
    if (e.escala !== 100) r[`--${k}-s`] = String(e.escala / 100);
    if (e.x) r[`--${k}-x`] = String(e.x);
    if (e.y) r[`--${k}-y`] = String(e.y);
  }
  return r;
}
