export interface Tema {
  c1: string;
  c2: string;
  neon: string;
  nombre: string;
}

export const TEMAS = {
  turquesa: { c1: '#3CC6CF', c2: '#178A97', neon: '#3FF5E0', nombre: 'Turquesa' },
  morado: { c1: '#8D4DF0', c2: '#5523B5', neon: '#A86BFF', nombre: 'Morado' },
  naranja: { c1: '#FF9A2E', c2: '#F05A05', neon: '#FF8F2E', nombre: 'Naranja' },
  verde: { c1: '#4FD443', c2: '#1C8F27', neon: '#5CFF6A', nombre: 'Verde' },
  rojo: { c1: '#F0354A', c2: '#B0101E', neon: '#FF2B2B', nombre: 'Rojo' },
  azul: { c1: '#3C8BF5', c2: '#1A4DB5', neon: '#4FA8FF', nombre: 'Azul' },
  dorado: { c1: '#F7C948', c2: '#C08414', neon: '#FFD24A', nombre: 'Dorado' },
} as const satisfies Record<string, Tema>;

export type ColorSorteo = keyof typeof TEMAS;
export const COLORES = Object.keys(TEMAS) as ColorSorteo[];

export const esColorHex = (c: string | null | undefined): c is string => /^#[0-9a-fA-F]{6}$/.test(c ?? '');

const aRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const aHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Mezcla el color con otro en la proporción p (0 = original, 1 = el otro). */
export const mezclar = (h: string, con: string, p: number) => {
  const a = aRgb(h);
  const b = aRgb(con);
  return aHex(a.map((v, i) => v + (b[i] - v) * p));
};

/** Luminancia relativa (WCAG) para elegir texto claro u oscuro encima del color. */
export function luminancia(h: string): number {
  const [r, g, b] = aRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Texto que se lee mejor encima del color: blanco o casi negro. */
export const tintaSobre = (h: string) => (luminancia(h) > 0.4 ? '#14141A' : '#FFFFFF');

/** Tema a partir de un color propio elegido en el panel. */
export const temaPersonalizado = (h: string): Tema => ({
  c1: h.toUpperCase(),
  c2: mezclar(h, '#000000', 0.32),
  neon: mezclar(h, '#FFFFFF', 0.25),
  nombre: 'Personalizado',
});

/** Color del sorteo: uno de los predefinidos, uno propio (#RRGGBB) o automático según el nombre. */
export function temaDe(s: { color?: string | null; nombre?: string | null }): Tema {
  if (s.color && s.color in TEMAS) return TEMAS[s.color as ColorSorteo];
  if (esColorHex(s.color)) return temaPersonalizado(s.color);
  const n = (s.nombre ?? '').toLowerCase();
  if (n.includes('vip')) return TEMAS.rojo;
  if (n.includes('carib')) return TEMAS.turquesa;
  if (n.includes('chontico')) return TEMAS.morado;
  if (n.includes('paisa') || n.includes('paisit')) return TEMAS.naranja;
  if (n.includes('sinuano')) return TEMAS.verde;
  return TEMAS.azul;
}

/** 2 columnas si hay 1, 2 o 4 sorteos; 3 en otro caso. */
export const columnasMenu = (n: number): number => (n <= 2 || n === 4 ? 2 : 3);

export const palabraArte = (nombre: string): string => (String(nombre ?? '').split(/\s+/)[0] ?? '').toUpperCase();

export const iniciales = (n: string): string =>
  String(n ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
