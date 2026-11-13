import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../src/app.ts';
import { cargarConfig } from '../src/config.ts';
import { abrirDb } from '../src/db/conexion.ts';
import { reposSqlite } from '../src/repositorios/sqlite.ts';
import { cifrarClave } from '../src/auth/claves.ts';
import type { SorteoEntrada } from '@pato/shared';

export const ADMIN_ORIGIN = 'http://admin.test';
/** Segundo origen permitido del panel (como un túnel de prueba). */
export const ADMIN_ORIGIN_2 = 'https://tunel.test';

export async function montar(
  op: { ahora?: () => Date; azar?: () => number; sinLimites?: boolean; env?: Record<string, string> } = {},
) {
  const config = cargarConfig({
    ...op.env,
    NODE_ENV: 'test',
    PUBLIC_ORIGIN: 'http://publico.test',
    ADMIN_ORIGIN: `${ADMIN_ORIGIN}, ${ADMIN_ORIGIN_2}`,
    DATABASE_URL: ':memory:',
    SESSION_SECRET: 'x'.repeat(64),
    MEDIA_DIR: mkdtempSync(join(tmpdir(), 'pato-medios-')),
  });
  const db = abrirDb(':memory:');
  const repos = reposSqlite(db);
  const app = await crearApp({
    config,
    repos,
    registros: false,
    sinLimites: op.sinLimites ?? true,
    ahora: op.ahora,
    azar: op.azar,
  });
  return { app, repos, db, config };
}

export const sorteoBase = (extra: Partial<SorteoEntrada> = {}): SorteoEntrada => ({
  nombre: 'Paisita Día',
  loteria: 'Paisita Día',
  jornada: 'dia',
  fecha: '2026-11-08',
  hora: '2:30 p. m.',
  orden: 1,
  color: '',
  etiqueta: '',
  activo: true,
  valor_boleta: 10000,
  premio_total: 700000,
  premio_ultimas: 500000,
  premio_primeras: 100000,
  premio_medio: 100000,
  premio_unido: 0,
  nequi: '3001234567',
  nequi_titular: 'Titular',
  imagen: '',
  logo_loteria: '',
  logo_ocupado: '',
  fondo_imagen: '',
  gratis: false,
  max_por_celular: 0,
  abre: null,
  imagen_agotado: '',
  lista_encabezado: '',
  lista_pie: '',
  ...extra,
});

export async function crearAdmin(
  repos: ReturnType<typeof reposSqlite>,
  usuario = 'miguel',
  clave = 'clave-de-prueba-123',
) {
  return repos.admins.crear(usuario, await cifrarClave(clave));
}

/** Inicia sesión y devuelve la cabecera Cookie lista para usar. */
export async function entrar(
  app: Awaited<ReturnType<typeof montar>>['app'],
  usuario = 'miguel',
  clave = 'clave-de-prueba-123',
) {
  const r = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    headers: { origin: ADMIN_ORIGIN },
    payload: { usuario, clave },
  });
  const c = r.cookies[0];
  return { respuesta: r, cookie: c ? `${c.name}=${c.value}` : '' };
}
