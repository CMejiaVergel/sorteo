import { crearApp } from './app.ts';
import { cargarConfig } from './config.ts';
import { abrirDb } from './db/conexion.ts';
import { reposSqlite } from './repositorios/sqlite.ts';

const config = cargarConfig();
const db = abrirDb(config.rutaDb);
const app = await crearApp({ config, repos: reposSqlite(db) });

try {
  await app.listen({ port: config.PORT, host: config.produccion ? '0.0.0.0' : '127.0.0.1' });
  console.log(`API lista en http://localhost:${config.PORT}  ·  base de datos: ${config.rutaDb}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}

const cerrar = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
