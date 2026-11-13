import { dinero } from './dinero.ts';
import { dosDigitos, fechaLarga, formatearFecha, nombreDia } from './fechas.ts';

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

export const PAGADO = '✅';
export const NO_PAGADO = '❌';

/** Encabezado predeterminado de la lista para el grupo. */
export const ENCABEZADO_LISTA = 'LISTADO DE PARTICIPANTES PARA {SORTEO} ({FECHA})';

/** Variables del encabezado y el final. En MAYÚSCULAS ponen el mismo dato en mayúsculas ({SORTEO}, {FECHA}…). */
export const VARIABLES_LISTA = [
  'sorteo',
  'loteria',
  'fecha',
  'dia',
  'hora',
  'jornada',
  'valor',
  'premio',
  'ocupados',
  'libres',
  'personas',
];

export interface SorteoLista {
  nombre: string;
  loteria?: string;
  jornada?: string;
  fecha: string | null;
  hora: string;
  valor_boleta?: number;
  premio_total?: number;
  gratis?: boolean;
  lista_encabezado?: string;
  lista_pie?: string;
}

/** Sustituye {variable} y {VARIABLE} (en mayúsculas). Una variable desconocida se deja intacta. */
function rellenar(plantilla: string, v: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (x, k: string) => {
    if (k in v) return v[k];
    const min = k.toLowerCase();
    return k === k.toUpperCase() && min in v ? v[min].toUpperCase() : x;
  });
}

export function variablesLista(s: SorteoLista, reservas: ReservaBasica[]): Record<string, string> {
  const ocupados = new Set(reservas.map((r) => r.numero)).size;
  return {
    sorteo: s.nombre,
    loteria: s.loteria ?? '',
    fecha: fechaLarga(s.fecha),
    dia: nombreDia(s.fecha),
    hora: s.hora,
    jornada: s.jornada === 'noche' ? 'noche' : 'día',
    valor: s.gratis ? 'gratis' : dinero(s.valor_boleta ?? 0),
    premio: dinero(s.premio_total ?? 0),
    ocupados: String(ocupados),
    libres: String(100 - ocupados),
    personas: String(new Set(reservas.map((r) => r.telefono)).size),
  };
}

/**
 * Lista final para pegar en el grupo de WhatsApp: encabezado, fijos, demás participantes y final.
 * Una línea por persona ("01-02-03- Nombre"); lo pagado lleva ✅. En un pago parcial va primero la línea
 * con lo pagado y justo debajo la de lo pendiente. ❌ en lo pendiente solo si se pide (`marcarNoPagados`):
 * a algunos les molesta, así que lo decide el administrador. En un sorteo gratis no se marca nada.
 */
export function listaWhatsApp(
  s: SorteoLista,
  reservas: ReservaBasica[],
  op: { marcarNoPagados?: boolean; incluirLibres?: boolean } = {},
): string {
  const v = variablesLista(s, reservas);
  const linea = (nums: number[], nombre: string, marca = '') =>
    `${nums.map(dosDigitos).join('-')}- ${nombre}${marca ? ' ' + marca : ''}`;
  const lineas = (g: Persona): string[] => {
    if (s.gratis) return [linea(g.numeros, g.nombre)];
    const pend = g.numeros.filter((n) => !g.pagados.includes(n));
    const x = op.marcarNoPagados ? NO_PAGADO : '';
    if (!pend.length) return [linea(g.numeros, g.nombre, PAGADO)];
    if (!g.pagados.length) return [linea(pend, g.nombre, x)];
    return [linea(g.pagados, g.nombre, PAGADO), linea(pend, g.nombre, x)];
  };
  const grupos = agruparPorPersona(reservas);
  const fijos = grupos.filter((g) => g.fijo);
  const otros = grupos.filter((g) => !g.fijo);

  const bloques: string[] = [rellenar(s.lista_encabezado?.trim() || ENCABEZADO_LISTA, v)];
  if (fijos.length) bloques.push(['FIJOS', '', ...fijos.flatMap(lineas)].join('\n'));
  if (otros.length) bloques.push((fijos.length ? ['PARTICIPANTES', ''] : []).concat(otros.flatMap(lineas)).join('\n'));
  if (!grupos.length) bloques.push('Aún no hay números apartados.');
  if (op.incluirLibres) {
    const ocupados = new Set(reservas.map((r) => r.numero));
    const libres = Array.from({ length: 100 }, (_, n) => n).filter((n) => !ocupados.has(n));
    if (libres.length) bloques.push(`LIBRES: ${libres.map(dosDigitos).join('-')}`);
  }
  if (s.lista_pie?.trim()) bloques.push(rellenar(s.lista_pie.trim(), v));
  return bloques.join('\n\n');
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
