import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Azar } from '@pato/shared';
import type { Config } from './config.ts';
import { ErrorApi } from './errores.ts';
import { ipCliente } from './seguridad/dispositivo.ts';
import type { Repos } from './repositorios/tipos.ts';
import { rutasAdmin } from './rutas/admin/index.ts';
import { rutasPublicas } from './rutas/publicas/index.ts';
import type { Contexto } from './servicios/negocio.ts';
import { PESO_MAXIMO } from './medios/procesar.ts';
import { mkdirSync } from 'node:fs';

export interface Dependencias {
  config: Config;
  repos: Repos;
  ahora?: () => Date;
  azar?: Azar;
  /** Desactiva los límites de peticiones (solo pruebas). */
  sinLimites?: boolean;
  registros?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: Contexto;
    config: Config;
  }
}

export async function crearApp(dep: Dependencias): Promise<FastifyInstance> {
  const { config } = dep;
  const app = Fastify({
    logger: dep.registros === false ? false : { level: config.produccion ? 'info' : 'warn', redact: ['req.headers.cookie', 'req.body.clave'] },
    bodyLimit: 64 * 1024,
    trustProxy: config.produccion ? 'loopback' : false,
  });

  app.decorate('config', config);
  app.decorate('ctx', {
    repos: dep.repos,
    ahora: dep.ahora ?? (() => new Date()),
    azar: dep.azar ?? Math.random,
    zona: config.TZ_NEGOCIO,
  } satisfies Contexto);

  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(multipart, { limits: { fileSize: PESO_MAXIMO, files: 1, fields: 5 } });
  await app.register(rateLimit, {
    global: false,
    // Por visitante real (detrás de un túnel o proxy todas las conexiones llegan desde la misma IP).
    keyGenerator: (req) => ipCliente(req, config),
    errorResponseBuilder: () => new ErrorApi(429, 'demasiadas_peticiones', 'Vas muy rápido. Espera un momento e intenta de nuevo.'),
  });

  mkdirSync(config.dirMedios, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.dirMedios,
    prefix: config.MEDIA_BASE_URL + '/',
    immutable: true,
    maxAge: '365d',
    index: false,
    list: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof ErrorApi) {
      return reply.status(err.status).send({ error: { codigo: err.codigo, mensaje: err.mensaje, ...(err.detalle ? { detalle: err.detalle } : {}) } });
    }
    if (err instanceof ZodError) {
      const mensaje = err.issues.find((i) => i.message && !i.message.startsWith('Expected') && !/^(Required|Invalid)/.test(i.message))?.message;
      return reply.status(422).send({
        error: { codigo: 'datos_invalidos', mensaje: mensaje ?? 'Revisa los datos e intenta de nuevo.', detalle: { campos: err.issues.map((i) => i.path.join('.')) } },
      });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode === 429) return reply.status(429).send({ error: { codigo: 'demasiadas_peticiones', mensaje: 'Vas muy rápido. Espera un momento e intenta de nuevo.' } });
    if (e.code === 'FST_REQ_FILE_TOO_LARGE' || e.statusCode === 413)
      return reply.status(413).send({ error: { codigo: 'archivo_grande', mensaje: 'La imagen pesa más de 8 MB.' } });
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500)
      return reply.status(400).send({ error: { codigo: 'peticion_invalida', mensaje: 'La petición no es válida.' } });
    req.log.error(err);
    return reply.status(500).send({ error: { codigo: 'error_interno', mensaje: 'Algo salió mal. Intenta de nuevo.' } });
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { codigo: 'no_encontrado', mensaje: 'No existe.' } }));

  await app.register(rutasPublicas, { prefix: '/api/public', sinLimites: dep.sinLimites ?? false });
  await app.register(rutasAdmin, { prefix: '/api/admin', sinLimites: dep.sinLimites ?? false });
  return app;
}
