/// <reference types="vite/client" />
// Portadas de la marca (resources/RECURSOS SORTEO). Se usan cuando el sorteo no tiene portada propia,
// igual que el color automático: según el nombre del sorteo.
import caribena from './recursos/portada-caribena.webp';
import diarios from './recursos/portada-diarios.webp';
import paisita from './recursos/portada-paisita.webp';
import vip from './recursos/portada-vip.webp';
import fondoTablero from './recursos/fondo-tablero.webp';

export const FONDO_TABLERO = fondoTablero;

/** Portada propia del sorteo o, si no tiene, la de la marca según el nombre. */
export function portadaDe(s: { nombre?: string | null; imagen?: string | null }): string {
  if (s.imagen) return s.imagen;
  const n = (s.nombre ?? '').toLowerCase();
  if (n.includes('vip')) return vip;
  if (n.includes('carib')) return caribena;
  if (n.includes('paisa') || n.includes('paisit')) return paisita;
  return diarios;
}
