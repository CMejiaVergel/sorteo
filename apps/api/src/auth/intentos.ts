/**
 * Límite de intentos de login: 5 por IP y 5 por usuario cada 15 minutos.
 * Se guarda en memoria del proceso (la API corre como un solo proceso).
 */
export class LimiteIntentos {
  private fallos = new Map<string, number[]>();

  constructor(
    private max = 5,
    private ventanaMs = 15 * 60 * 1000,
    private ahora: () => number = Date.now,
  ) {}

  private recientes(clave: string): number[] {
    const t = this.ahora();
    const l = (this.fallos.get(clave) ?? []).filter((x) => t - x < this.ventanaMs);
    this.fallos.set(clave, l);
    return l;
  }

  /** ¿Está bloqueada alguna de las claves? Devuelve los segundos de espera o 0. */
  espera(...claves: string[]): number {
    let maxEspera = 0;
    for (const c of claves) {
      const l = this.recientes(c);
      if (l.length >= this.max) {
        // Espera creciente: cuanto más fallos, más larga (hasta la ventana completa).
        const extra = Math.min(this.ventanaMs, (l.length - this.max + 1) * 60_000);
        const fin = Math.max(l[0] + this.ventanaMs, l[l.length - 1] + extra);
        maxEspera = Math.max(maxEspera, Math.ceil((fin - this.ahora()) / 1000));
      }
    }
    return maxEspera;
  }

  fallo(...claves: string[]) {
    const t = this.ahora();
    for (const c of claves) this.recientes(c).push(t);
  }

  limpiar(...claves: string[]) {
    for (const c of claves) this.fallos.delete(c);
  }
}
