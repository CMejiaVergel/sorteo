/**
 * Instala los recursos gráficos de la marca (resources/RECURSOS SORTEO) en los espacios del diseño:
 * fondo, máquina con su ventana ya calibrada, logo, botón LANZA, símbolos y logo de números ocupados.
 * Cada imagen pasa por el mismo procesado que una subida desde el panel (validación, WebP, sin metadatos).
 * Las portadas por sorteo y el fondo de la imagen exportada van en el paquete de interfaz (portadas automáticas).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Diseno, UsoMedio } from '@pato/shared';
import { esquemaDiseno } from '@pato/shared/esquemas';
import { RAIZ, type Config } from './config.ts';
import { procesarImagen } from './medios/procesar.ts';
import type { Repos } from './repositorios/tipos.ts';

export const DIR_RECURSOS = resolve(RAIZ, 'resources/RECURSOS SORTEO');

export async function instalarRecursos(repos: Repos, config: Config, dir = DIR_RECURSOS): Promise<Diseno> {
  async function subir(archivo: string, uso: UsoMedio): Promise<string | null> {
    const ruta = resolve(dir, archivo);
    if (!existsSync(ruta)) {
      console.warn(`  · No encontré "${archivo}"; ese espacio queda con la proforma base.`);
      return null;
    }
    const m = await procesarImagen(readFileSync(ruta), uso, config.dirMedios);
    const url = `${config.MEDIA_BASE_URL}/${m.nombre}`;
    await repos.medios.registrar({ id: m.id, ruta: url, uso, ancho: m.ancho, alto: m.alto, peso: m.peso });
    return url;
  }

  const logo = await subir('LOGO SORTEO.png', 'logo');
  const diseno = esquemaDiseno.parse({
    ruleta: {
      fondo: await subir('FONDO RULETA.jpg', 'fondo'),
      maquina: await subir('RULETA BASE.png', 'maquina'),
      // La máquina ya trae el logo y las mascotas dibujados: el logo queda guardado pero oculto arriba.
      logo,
      ocultarLogo: true,
      mascota: null,
      ventana: { x: 15.5, y: 45, w: 69.5, h: 33.5 },
      rodillosBlancos: false,
      escalaSimbolos: 70,
      botonImagen: await subir('Boton.png', 'boton'),
      simbolos: {
        moneda: await subir('MONEDA.png', 'simbolo'),
        trebol: await subir('TREBOL.png', 'simbolo'),
        herradura: await subir('HERRADURA.png', 'simbolo'),
        siete: await subir('ICONO GANADOR O 7.png', 'simbolo'),
        diamante: await subir('DIAMANTE.png', 'simbolo'),
      },
    },
    tablero: { logoOcupado: await subir('LOGO SORTEO.png', 'ocupado') },
  });
  await repos.ajustes.guardar({ diseno });
  return diseno;
}
