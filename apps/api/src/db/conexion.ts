import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRACIONES } from './esquema.ts';

export type Db = DatabaseSync;

/** Abre la base, activa claves foráneas y aplica las migraciones pendientes. */
export function abrirDb(ruta: string): Db {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (ruta !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  for (let i = version; i < MIGRACIONES.length; i++) {
    const m = MIGRACIONES[i];
    const sinClaves = typeof m !== 'string';
    // PRAGMA foreign_keys no tiene efecto dentro de una transacción: se cambia antes y después.
    if (sinClaves) db.exec('PRAGMA foreign_keys = OFF');
    try {
      transaccion(db, () => {
        db.exec(typeof m === 'string' ? m : m.sql);
        if (sinClaves) {
          const rotas = db.prepare('PRAGMA foreign_key_check').all();
          if (rotas.length) throw new Error(`Migración ${i + 1}: ${rotas.length} referencia(s) rota(s).`);
        }
        db.exec(`PRAGMA user_version = ${i + 1}`);
      });
    } finally {
      if (sinClaves) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return db;
}

/** Ejecuta fn dentro de una transacción; deshace todo si algo falla. */
export function transaccion<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** ¿El error es una violación de unicidad de SQLite? */
export const esUnicidad = (e: unknown): boolean => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
