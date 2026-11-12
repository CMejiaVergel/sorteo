import { dinero } from './dinero.ts';
import { dosDigitos, formatearFecha } from './fechas.ts';
import { formatearTelefono, normalizarTelefono } from './telefono.ts';

export const PLANTILLA_BASE =
  'Hola {nombre}, {saludo}. Tienes {numeros} por un valor de {total} en el sorteo {sorteo} del {fecha}. Para cancelar, Nequi {nequi} a nombre de {titular}. ¡Mucha suerte!';

export const saludo = (jornada: string): string => (jornada === 'noche' ? 'buenas noches' : 'buenos días');

export interface SorteoCobro {
  nombre: string;
  jornada: string;
  fecha: string | null;
  hora?: string;
  valor_boleta: number;
  nequi?: string;
  nequi_titular?: string;
}

/** Sustituye las variables de la plantilla. Una variable desconocida se deja intacta. */
export function mensajeCobro(plantilla: string, s: SorteoCobro, p: { nombre: string; numeros: number[] }): string {
  const v: Record<string, string> = {
    saludo: saludo(s.jornada),
    nombre: p.nombre,
    numeros: p.numeros.map(dosDigitos).join(', '),
    cantidad: String(p.numeros.length),
    valor: dinero(s.valor_boleta),
    total: dinero(p.numeros.length * s.valor_boleta),
    sorteo: s.nombre,
    fecha: formatearFecha(s.fecha),
    hora: s.hora ?? '',
    nequi: formatearTelefono(s.nequi ?? ''),
    titular: s.nequi_titular ?? '',
  };
  return String(plantilla ?? '').replace(/\{(\w+)\}/g, (x, k: string) => (k in v ? v[k] : x));
}

export interface DatosTicket {
  negocio: string;
  nombre: string;
  telefono: string;
  sorteo: string;
  fecha: string | null;
  hora?: string;
  numeros: number[];
  valor_boleta: number;
  nequi?: string;
  nequi_titular?: string;
}

/** Ticket predeterminado. Se edita en el panel (Ajustes → Mensaje del ticket). */
export const PLANTILLA_TICKET = [
  '🦆🍀 *{NEGOCIO}* 🍀🦆',
  '',
  'Soy, {nombre} 👉🏻{celular}',
  '',
  '*TENGO LOS NUMEROS: {numeros}*✅',
  '*{SORTEO}*',
  '',
  '💰 *TOTAL A PAGAR: {total}*',
  '',
  '*NEQUI* 👉🏻 {nequi}',
  '*{TITULAR}*',
].join('\n');

/** Las variables en MAYÚSCULAS ponen el mismo dato en mayúsculas. */
export const VARIABLES_TICKET = [
  'negocio',
  'NEGOCIO',
  'nombre',
  'celular',
  'sorteo',
  'SORTEO',
  'fecha',
  'hora',
  'numeros',
  'cantidad',
  'valor',
  'total',
  'nequi',
  'titular',
  'TITULAR',
];

/**
 * Ticket que el cliente le envía al recaudador por WhatsApp al finalizar.
 * Usa *negrita* de WhatsApp y emojis. Si en una línea todas las variables quedan vacías
 * (por ejemplo, un sorteo sin titular), esa línea se quita; un separador " · " que quede suelto también.
 */
export function mensajeTicket(t: DatosTicket, plantilla: string = PLANTILLA_TICKET): string {
  const nums = [...t.numeros].sort((a, b) => a - b);
  const v: Record<string, string> = {
    negocio: t.negocio,
    NEGOCIO: t.negocio.toUpperCase(),
    nombre: t.nombre,
    celular: formatearTelefono(t.telefono),
    sorteo: t.sorteo,
    SORTEO: t.sorteo.toUpperCase(),
    fecha: formatearFecha(t.fecha),
    hora: t.hora ?? '',
    numeros: nums.map(dosDigitos).join('-'),
    cantidad: String(nums.length),
    valor: dinero(t.valor_boleta),
    total: dinero(nums.length * t.valor_boleta),
    nequi: t.nequi ? formatearTelefono(t.nequi) : '',
    titular: t.nequi_titular ?? '',
    TITULAR: (t.nequi_titular ?? '').toUpperCase(),
  };
  const lineas: string[] = [];
  for (const linea of String(plantilla.trim() ? plantilla : PLANTILLA_TICKET).split(/\r?\n/)) {
    const usadas = [...linea.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in v);
    if (usadas.length && usadas.every((k) => !v[k])) continue;
    lineas.push(
      linea
        .replace(/\{(\w+)\}/g, (x, k: string) => (k in v ? v[k] : x))
        .replace(/(\s·\s*)+$/, '') // "martes 10 nov · " sin hora
        .replace(/(\*\s*)·\s+/, '$1'), // "*Juega:* · 2:30" sin fecha
    );
  }
  // Sin líneas en blanco repetidas al quitar bloques.
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const enlaceWhatsApp = (tel: string, texto: string): string =>
  `https://wa.me/57${normalizarTelefono(tel)}?text=${encodeURIComponent(texto)}`;

/**
 * Pedido por WhatsApp cuando la página no deja apartar (límite por celular o bloqueo):
 * reúne los números que la persona quería para que el administrador se los separe por chat.
 */
export function mensajePedido(p: { negocio: string; nombre: string; telefono: string; sorteo: string; numeros: number[]; valor_boleta: number }): string {
  const nums = [...p.numeros].sort((a, b) => a - b);
  const quien = [p.nombre.trim(), telefonoSiValido(p.telefono)].filter(Boolean);
  return [
    `🦆🍀 *${p.negocio.toUpperCase()}* 🍀🦆`,
    '',
    quien.length ? `Hola, soy ${quien.join(' 👉🏻')}` : 'Hola',
    'Quiero apartar estos números por aquí:',
    '',
    `*${nums.map(dosDigitos).join('-')}*`,
    `*${p.sorteo.toUpperCase()}*`,
    '',
    `💰 *TOTAL: ${dinero(nums.length * p.valor_boleta)}*`,
  ].join('\n');
}

const telefonoSiValido = (t: string) => {
  const n = normalizarTelefono(t);
  return /^3\d{9}$/.test(n) ? formatearTelefono(n) : '';
};
