const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Pesos sin decimales ni espacios: 10000 → "$10.000". */
export const dinero = (v: unknown): string => COP.format(Number(v) || 0).replace(/\s/g, '');
