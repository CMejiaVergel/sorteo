import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { z } from 'zod';

/** Raíz del repositorio (dos niveles arriba de apps/api). */
export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_ORIGIN: z.string().url(),
  /** Uno o varios orígenes del panel, separados por coma (p. ej. localhost y un túnel de prueba). */
  ADMIN_ORIGIN: z
    .string()
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  MEDIA_DIR: z.string().min(1),
  MEDIA_BASE_URL: z.string().default('/medios'),
  TZ_NEGOCIO: z.string().default('America/Bogota'),
  /** Cabecera con la IP real del visitante cuando hay un proxy delante (p. ej. cf-connecting-ip con Cloudflare, x-real-ip con nginx). Vacío: la IP de la conexión. */
  IP_CABECERA: z.string().trim().toLowerCase().default(''),
  RATE_LIMIT_RESERVAS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GIRO: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_CONTACTOS: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_MIS_NUMEROS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_LECTURAS: z.coerce.number().int().positive().default(120),
});

export type Config = z.infer<typeof esquema> & { rutaDb: string; dirMedios: string; produccion: boolean };

/** Lee .env de la raíz (si existe) y valida. Si falta una variable, se detiene y dice cuál. */
export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const archivo = resolve(RAIZ, '.env');
  // El archivo .env local manda sobre variables heredadas (p. ej. un PORT que pone otra herramienta).
  if (env === process.env && existsSync(archivo)) Object.assign(process.env, parseEnv(readFileSync(archivo, 'utf8')));
  const r = esquema.safeParse(env);
  if (!r.success) {
    const faltan = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida. Revisa el archivo .env:\n${faltan}`);
  }
  const c = r.data;
  const rutaDb = c.DATABASE_URL === ':memory:' ? ':memory:' : resolve(RAIZ, c.DATABASE_URL.replace(/^file:/, ''));
  return { ...c, rutaDb, dirMedios: resolve(RAIZ, c.MEDIA_DIR), produccion: c.NODE_ENV === 'production' };
}
