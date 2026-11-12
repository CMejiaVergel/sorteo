/**
 * Instala los recursos gráficos de la marca en el diseño.
 *   npm run recursos                 → usa resources/RECURSOS SORTEO
 *   npm run recursos -- <carpeta>    → otra carpeta con los mismos nombres de archivo
 * Reemplaza el diseño actual (lo que se haya subido desde el panel en "Diseño").
 */
import { resolve } from 'node:path';
import { cargarConfig } from '../config.ts';
import { abrirDb } from '../db/conexion.ts';
import { DIR_RECURSOS, instalarRecursos } from '../recursos.ts';
import { reposSqlite } from '../repositorios/sqlite.ts';

const config = cargarConfig();
const db = abrirDb(config.rutaDb);
const dir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DIR_RECURSOS;
try {
  await instalarRecursos(reposSqlite(db), config, dir);
  console.log(`Recursos gráficos instalados desde ${dir}`);
} finally {
  db.close();
}
