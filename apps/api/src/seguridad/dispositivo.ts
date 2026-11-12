import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.ts';

export const COOKIE_DISPOSITIVO = 'pato_disp';
const FORMATO = /^[A-Za-z0-9_-]{16,40}$/;
const DOS_ANOS = 2 * 365 * 24 * 3600;

/** IP del visitante. Detrás de un proxy de confianza se lee la cabecera configurada (IP_CABECERA). */
export function ipCliente(req: FastifyRequest, c: Pick<Config, 'IP_CABECERA'>): string {
  if (c.IP_CABECERA) {
    const v = req.headers[c.IP_CABECERA];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) return s.split(',')[0].trim().slice(0, 64);
  }
  return req.ip;
}

/**
 * Identificador del navegador, guardado en una cookie firmada que dura dos años. No pide nada al visitante.
 * - Al abrir la página (`nuevo: 'aleatorio'`) se le asigna uno al azar.
 * - Si llega a apartar sin cookie (un programa que no guarda cookies), se usa uno fijo calculado con su red y
 *   navegador (`nuevo: 'red'`): así no puede saltarse el límite por dispositivo con solo borrar cookies.
 */
export function dispositivoDe(
  req: FastifyRequest,
  reply: FastifyReply,
  c: Pick<Config, 'IP_CABECERA' | 'produccion'>,
  nuevo: 'aleatorio' | 'red',
): string {
  const crudo = req.cookies[COOKIE_DISPOSITIVO];
  if (crudo) {
    const u = req.unsignCookie(crudo);
    if (u.valid && u.value && FORMATO.test(u.value)) return u.value;
  }
  const id =
    nuevo === 'aleatorio'
      ? randomBytes(16).toString('base64url')
      : 'r' + createHash('sha256').update(`${ipCliente(req, c)}|${req.headers['user-agent'] ?? ''}`).digest('base64url').slice(0, 21);
  reply.setCookie(COOKIE_DISPOSITIVO, id, {
    path: '/api/public',
    httpOnly: true,
    sameSite: 'lax',
    secure: c.produccion,
    signed: true,
    maxAge: DOS_ANOS,
  });
  return id;
}
