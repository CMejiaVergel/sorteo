export const SIMBOLOS = ['moneda', 'trebol', 'herradura', 'siete', 'diamante'] as const;
export type Simbolo = (typeof SIMBOLOS)[number];

export const NOMBRE_SIMBOLO: Record<Simbolo, string> = {
  moneda: 'moneda',
  trebol: 'trébol',
  herradura: 'herradura',
  siete: '7',
  diamante: 'diamante',
};

/** Premio por cada trío (3 iguales) de cada símbolo. Un símbolo vacío o ausente usa el premio general `premio_tres`. */
export type PremiosTres = Partial<Record<Simbolo, string>>;

export interface Probabilidades {
  prob_tres: number;
  premio_tres: string;
  prob_dos: number;
  premio_dos: string;
  premios_tres?: PremiosTres;
}

/** Premio de 3 iguales de ese símbolo: el propio si lo tiene, si no el general. */
export const premioTrio = (c: Pick<Probabilidades, 'premio_tres' | 'premios_tres'>, k: Simbolo): string =>
  c.premios_tres?.[k]?.trim() || c.premio_tres;

export interface ResultadoGiro {
  resultado: [Simbolo, Simbolo, Simbolo];
  gano: 0 | 2 | 3;
  premio: string;
}

/** Generador de azar inyectable: devuelve un número en [0, 1). */
export type Azar = () => number;

function barajar<T>(lista: readonly T[], azar: Azar): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Decide el resultado de la ruleta. Solo se usa en el servidor. */
export function decidirGiro(c: Probabilidades, azar: Azar = Math.random): ResultadoGiro {
  const m = barajar(SIMBOLOS, azar);
  const r = azar() * 100;
  if (r < c.prob_tres) return { resultado: [m[0], m[0], m[0]], gano: 3, premio: premioTrio(c, m[0]) };
  if (r < c.prob_tres + c.prob_dos) {
    const opciones: [Simbolo, Simbolo, Simbolo][] = [
      [m[0], m[0], m[1]],
      [m[0], m[1], m[0]],
      [m[1], m[0], m[0]],
    ];
    return { resultado: opciones[Math.min(2, Math.floor(azar() * 3))], gano: 2, premio: c.premio_dos };
  }
  return { resultado: [m[0], m[1], m[2]], gano: 0, premio: '' };
}

/** Cuántos iguales hay en una fila: 3, 2 o 0. */
export function ganoDe(fila: readonly string[]): 0 | 2 | 3 {
  const distintos = new Set(fila).size;
  return distintos === 1 ? 3 : distintos === 2 ? 2 : 0;
}
