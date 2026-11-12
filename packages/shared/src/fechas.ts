const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const ZONA_NEGOCIO = 'America/Bogota';

export const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/** "2026-11-08" → "domingo 8 nov". */
export function formatearFecha(f: string | null | undefined): string {
  if (!f) return '';
  const [y, m, d] = f.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} ${MESES[m - 1]}`;
}

/** Fecha AAAA-MM-DD en la zona de negocio para el instante dado. */
export function hoyBogota(ahora: Date, zona: string = ZONA_NEGOCIO): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

/** Suma días a una fecha AAAA-MM-DD sin depender de la zona del equipo. */
export function sumarDias(f: string, n: number): string {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD. */
export function diaSemana(f: string): number {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2:30 p. m." → "2:30PM". */
export const horaCorta = (h: string | null | undefined): string =>
  String(h ?? '')
    .replace(/[\s.]/g, '')
    .toUpperCase();
