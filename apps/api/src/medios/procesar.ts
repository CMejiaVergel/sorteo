import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { UsoMedio } from '@pato/shared';
import { ErrorApi } from '../errores.ts';

/** Lado mayor máximo según el uso (docs/03 §6). */
const LADO_MAXIMO: Record<UsoMedio, number> = {
  fondo: 1400,
  maquina: 1400,
  portada: 900,
  logo: 600,
  simbolo: 600,
  mascota: 600,
  boton: 600,
  ocupado: 600,
  agotado: 1200,
};

export const PESO_MAXIMO = 8 * 1024 * 1024;

export interface MedioProcesado {
  id: string;
  nombre: string;
  ancho: number;
  alto: number;
  peso: number;
}

/**
 * Valida el tipo real por contenido (JPG, PNG o WebP), reprocesa, quita metadatos,
 * limita el tamaño y guarda en WebP con un nombre generado por el servidor.
 */
export async function procesarImagen(entrada: Buffer, uso: UsoMedio, dir: string): Promise<MedioProcesado> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(entrada, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ErrorApi(422, 'imagen_invalida', 'Ese archivo no es una imagen JPG, PNG o WebP.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages ?? 1) > 1)
    throw new ErrorApi(422, 'imagen_invalida', 'Ese archivo no es una imagen JPG, PNG o WebP.');

  const lado = LADO_MAXIMO[uso];
  const { data, info } = await sharp(entrada, { limitInputPixels: 50_000_000 })
    .rotate() // respeta la orientación EXIF antes de quitar metadatos
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer({ resolveWithObject: true });

  const id = randomBytes(12).toString('hex');
  const nombre = `${id}.webp`;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, nombre), data, { flag: 'wx' });
  return { id, nombre, ancho: info.width, alto: info.height, peso: info.size };
}

export async function borrarArchivo(dir: string, nombre: string) {
  if (!/^[a-z0-9]+\.webp$/.test(nombre)) return;
  try {
    await unlink(join(dir, nombre));
  } catch {
    /* ya no existía */
  }
}
