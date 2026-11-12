/**
 * Deja solo dígitos y quita el indicativo de Colombia si viene: "+57 300…", "57300…", "0057300…" o "057300…"
 * quedan igual que "300…". Así el mismo celular siempre se guarda y se busca igual.
 */
export function normalizarTelefono(t: unknown): string {
  let d = String(t ?? '').replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0057')) d = d.slice(4);
  else if (d.length === 13 && d.startsWith('057')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}

/** Para los campos de celular: si lo escrito ya es un celular válido, lo muestra como "300 123 4567". */
export function textoCelular(escrito: string): string {
  const d = normalizarTelefono(escrito);
  return /^3\d{9}$/.test(d) ? formatearTelefono(d) : escrito;
}

/** Celular colombiano: 10 dígitos que empiezan por 3. */
export const telefonoValido = (d: string): boolean => /^3\d{9}$/.test(d);

/** 3001234567 → "300 123 4567". */
export function formatearTelefono(d: string | null | undefined): string {
  if (!d) return '';
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
}
