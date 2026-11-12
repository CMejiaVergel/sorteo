import { dosDigitos, formatearFecha } from './fechas.ts';

export interface ReservaBasica {
  numero: number;
  telefono: string;
  nombre: string;
  tipo: 'cliente' | 'fijo';
  pagado: boolean;
}

export interface Persona {
  telefono: string;
  nombre: string;
  numeros: number[];
  pagados: number[];
  pagado: boolean;
  fijo: boolean;
}

/** Agrupa reservas por celular; números ordenados y personas por su número más bajo. */
export function agruparPorPersona(reservas: ReservaBasica[]): Persona[] {
  const m = new Map<string, Persona>();
  for (const r of reservas) {
    let g = m.get(r.telefono);
    if (!g) {
      g = { telefono: r.telefono, nombre: r.nombre, numeros: [], pagados: [], pagado: true, fijo: false };
      m.set(r.telefono, g);
    }
    if (!g.numeros.includes(r.numero)) g.numeros.push(r.numero);
    if (r.pagado) g.pagados.push(r.numero);
    else g.pagado = false;
    if (r.tipo === 'fijo') g.fijo = true;
  }
  const arr = [...m.values()];
  arr.forEach((g) => {
    g.numeros.sort((a, b) => a - b);
    g.pagados.sort((a, b) => a - b);
  });
  arr.sort((a, b) => a.numeros[0] - b.numeros[0]);
  return arr;
}

export type EstadoPago = 'pagado' | 'pendiente' | 'parcial';

export function estadoPago(numeros: number[], pagados: number[]): EstadoPago {
  const pend = numeros.filter((n) => !pagados.includes(n));
  if (!pend.length) return 'pagado';
  return pend.length === numeros.length ? 'pendiente' : 'parcial';
}

/** Texto de la lista final para WhatsApp. */
export function listaFinal(
  s: { nombre: string; fecha: string | null; hora: string },
  reservas: ReservaBasica[],
  incluirLibres = false,
): string {
  const grupos = agruparPorPersona(reservas);
  let t =
    `${s.nombre} · ${formatearFecha(s.fecha)}${s.hora ? ' · ' + s.hora : ''}\n\n` +
    grupos.map((g) => `${g.numeros.map(dosDigitos).join('-')} ${g.nombre}`).join('\n');
  const ocupados = new Set(reservas.map((r) => r.numero));
  const libres = Array.from({ length: 100 }, (_, n) => n).filter((n) => !ocupados.has(n));
  if (incluirLibres && libres.length) t += `\n\nLibres: ${libres.map(dosDigitos).join('-')}`;
  return t;
}

/** Nombres que se repiten con celulares distintos (en minúscula). */
export function nombresRepetidos(personas: Persona[]): string[] {
  const c = new Map<string, number>();
  for (const p of personas) {
    const k = p.nombre.trim().toLowerCase();
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c].filter(([, n]) => n > 1).map(([k]) => k);
}
