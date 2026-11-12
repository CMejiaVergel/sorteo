import { normalizarTelefono } from './telefono.ts';

export interface LineaLeida {
  numeros: number[];
  nombre: string;
  telefono: string;
  linea: string;
}

/** "01-02-03 Miguel 3001234567" → { numeros: [1,2,3], nombre: 'Miguel', telefono: '3001234567' } */
export function leerLinea(linea: string): LineaLeida {
  let l = ' ' + linea + ' ';
  let telefono = '';
  const m = l.match(/(\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (m) {
    telefono = normalizarTelefono(m[0]);
    l = l.replace(m[0], ' ');
  }
  const numeros: number[] = [];
  l = l.replace(/(^|[^\d])(\d{1,2})(?=[^\d]|$)/g, (_x, a: string, n: string) => {
    numeros.push(Number(n));
    return a + ' ';
  });
  const nombre = l
    .replace(/[-–—,;:|.#*+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { numeros: [...new Set(numeros)], nombre, telefono, linea: linea.trim() };
}

/** Lee un texto con una persona por línea; ignora líneas vacías. */
export const leerTexto = (t: string | null | undefined): LineaLeida[] =>
  String(t ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(leerLinea);
