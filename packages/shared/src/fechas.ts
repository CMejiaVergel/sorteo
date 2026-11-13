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

/** Fecha y hora "AAAA-MM-DDTHH:MM" en la zona de negocio (el formato de un <input type="datetime-local">). */
export function ahoraLocal(ahora: Date, zona: string = ZONA_NEGOCIO): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
}

/**
 * ¿Los clientes pueden ver y apartar el sorteo? Visible y, si tiene apertura programada
 * ("AAAA-MM-DDTHH:MM", hora de Bogotá), solo desde ese minuto.
 */
export function sorteoAbierto(
  s: { activo: boolean; abre?: string | null },
  ahora: Date,
  zona: string = ZONA_NEGOCIO,
): boolean {
  return s.activo && (!s.abre || s.abre <= ahoraLocal(ahora, zona));
}

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "2026-11-13" → "13 de noviembre". */
export function fechaLarga(f: string | null | undefined): string {
  if (!f) return '';
  const [, m, d] = f.split('-').map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]}`;
}

/** "2026-11-13" → "jueves". */
export const nombreDia = (f: string | null | undefined): string => (f ? DIAS[diaSemana(f)] : '');

/** "2026-11-13T19:00" → "jueves 13 nov · 7:00 p. m.". */
export function formatearApertura(abre: string | null | undefined): string {
  if (!abre) return '';
  const [f, h] = abre.split('T');
  const [hh, mm] = h.split(':').map(Number);
  const h12 = hh % 12 || 12;
  return `${formatearFecha(f)} · ${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
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
