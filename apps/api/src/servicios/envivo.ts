import type { ServerResponse } from 'node:http';

interface Sala {
  clientes: Set<ServerResponse>;
  ultimo: string;
  reloj: NodeJS.Timeout;
}

/**
 * Tablero en vivo (Server-Sent Events). Por cada sorteo con alguien mirando se revisa la lista de ocupados
 * cada segundo y, si cambió, se envía a todos. Detecta cualquier cambio: reservas desde la página, desde el
 * panel, pagos liberados, etc. Cuando nadie mira un sorteo, deja de revisarlo.
 */
export class EnVivo {
  private salas = new Map<string, Sala>();
  private total = 0;
  private latido: NodeJS.Timeout;

  constructor(
    private leer: (sorteoId: string) => Promise<number[]>,
    private cadaMs = 1000,
    private maximo = 3000,
  ) {
    // Comentario periódico para que proxies y túneles no corten la conexión por inactividad.
    this.latido = setInterval(() => this.enviarATodos(': ping\n\n'), 25_000);
    this.latido.unref();
  }

  get conectados() {
    return this.total;
  }

  lleno() {
    return this.total >= this.maximo;
  }

  unir(sorteoId: string, res: ServerResponse, inicial: number[]) {
    let sala = this.salas.get(sorteoId);
    if (!sala) {
      const reloj = setInterval(() => void this.revisar(sorteoId), this.cadaMs);
      reloj.unref();
      sala = { clientes: new Set(), ultimo: inicial.join(','), reloj };
      this.salas.set(sorteoId, sala);
    }
    sala.clientes.add(res);
    this.total++;
    // Relleno inicial: algunos proxies y túneles retienen los primeros bytes hasta juntar ~2 KB.
    res.write(`:${' '.repeat(2048)}\n\nretry: 3000\ndata: ${JSON.stringify({ ocupados: inicial })}\n\n`);
    res.on('close', () => this.salir(sorteoId, res));
  }

  private salir(sorteoId: string, res: ServerResponse) {
    const sala = this.salas.get(sorteoId);
    if (!sala?.clientes.delete(res)) return;
    this.total--;
    if (!sala.clientes.size) {
      clearInterval(sala.reloj);
      this.salas.delete(sorteoId);
    }
  }

  /** Revisa ya (por ejemplo, justo después de una reserva) en vez de esperar al siguiente segundo. */
  async revisar(sorteoId: string) {
    const sala = this.salas.get(sorteoId);
    if (!sala) return;
    let lista: number[];
    try {
      lista = await this.leer(sorteoId);
    } catch {
      return;
    }
    const clave = lista.join(',');
    if (clave === sala.ultimo) return;
    sala.ultimo = clave;
    const msg = `data: ${JSON.stringify({ ocupados: lista })}\n\n`;
    for (const r of sala.clientes) r.write(msg);
  }

  private enviarATodos(msg: string) {
    for (const sala of this.salas.values()) for (const r of sala.clientes) r.write(msg);
  }

  cerrar() {
    clearInterval(this.latido);
    for (const sala of this.salas.values()) {
      clearInterval(sala.reloj);
      for (const r of sala.clientes) r.end();
    }
    this.salas.clear();
    this.total = 0;
  }
}
