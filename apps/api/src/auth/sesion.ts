import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.ts';
import type { Admin, Repos } from '../repositorios/tipos.ts';

export const INACTIVIDAD_MS = 8 * 60 * 60 * 1000;
export const MAXIMO_MS = 7 * 24 * 60 * 60 * 1000;

/** En producción la cookie es __Host-sesion (Secure, sin Domain). En desarrollo, sobre http://localhost, "sesion". */
export const nombreCookie = (c: Config) => (c.produccion ? '__Host-sesion' : 'sesion');

export function ponerCookie(reply: FastifyReply, c: Config, id: string) {
  reply.setCookie(nombreCookie(c), id, {
    httpOnly: true,
    secure: c.produccion,
    sameSite: 'strict',
    path: '/',
    signed: true,
    maxAge: MAXIMO_MS / 1000,
  });
}

export function quitarCookie(reply: FastifyReply, c: Config) {
  reply.clearCookie(nombreCookie(c), { path: '/', httpOnly: true, secure: c.produccion, sameSite: 'strict' });
}

export async function crearSesion(repos: Repos, adminId: string, req: FastifyRequest, ahora: Date): Promise<string> {
  const id = randomBytes(32).toString('base64url');
  const t = ahora.toISOString();
  await repos.sesiones.crear({
    id,
    admin_id: adminId,
    creada: t,
    ultimo_uso: t,
    expira: new Date(ahora.getTime() + MAXIMO_MS).toISOString(),
    ip: req.ip,
    agente: String(req.headers['user-agent'] ?? ''),
  });
  return id;
}

/** Devuelve el administrador de la sesión, o null si no hay sesión válida. */
export async function leerSesion(req: FastifyRequest, repos: Repos, c: Config, ahora: Date): Promise<{ admin: Admin; sesionId: string } | null> {
  const crudo = req.cookies[nombreCookie(c)];
  if (!crudo) return null;
  const firmado = req.unsignCookie(crudo);
  if (!firmado.valid || !firmado.value) return null;
  const s = await repos.sesiones.obtener(firmado.value);
  if (!s) return null;
  const t = ahora.getTime();
  if (t > Date.parse(s.expira) || t - Date.parse(s.ultimo_uso) > INACTIVIDAD_MS) {
    await repos.sesiones.eliminar(s.id);
    return null;
  }
  const admin = await repos.admins.porId(s.admin_id);
  if (!admin || !admin.activo) return null;
  await repos.sesiones.tocar(s.id, ahora.toISOString());
  return { admin, sesionId: s.id };
}
