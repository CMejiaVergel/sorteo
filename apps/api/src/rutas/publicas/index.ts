import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import {
  normalizarTelefono,
  sorteoAbierto,
  telefonoValido,
  type ConfigPublica,
  type Sorteo,
  type SorteoPublico,
} from '@pato/shared';
import { esquemaGiro, esquemaReserva } from '@pato/shared/esquemas';
import { ErrorApi, noDisponible } from '../../errores.ts';
import { dispositivoDe, ipCliente } from '../../seguridad/dispositivo.ts';
import { EnVivo } from '../../servicios/envivo.ts';
import { girar, misNumeros, reservar, sinAbrir } from '../../servicios/negocio.ts';

export const rutasPublicas: FastifyPluginAsync<{ sinLimites: boolean }> = async (app, opts) => {
  const c = app.config;
  const limite = (max: number) => (opts.sinLimites ? {} : { config: { rateLimit: { max, timeWindow: '1 minute' } } });
  const { repos } = app.ctx;
  const envivo = new EnVivo((id) => repos.reservas.ocupados(id));
  app.addHook('preClose', async () => envivo.cerrar());

  app.get('/salud', async () => ({ ok: true }));

  app.get('/config', limite(c.RATE_LIMIT_LECTURAS), async (req, reply): Promise<ConfigPublica> => {
    // Al abrir la página el navegador recibe su identificador de dispositivo (cookie, sin pedir nada).
    dispositivoDe(req, reply, c, 'aleatorio');
    const [a, r, reinicio] = await Promise.all([
      repos.ajustes.obtener(),
      repos.ruleta.config(),
      repos.ruleta.marcaReinicio(),
    ]);
    // Nunca se envían las probabilidades.
    return {
      negocio: a.negocio,
      whatsapp: a.whatsapp,
      plantilla_ticket: a.plantilla_ticket,
      diseno: a.diseno,
      ruleta: {
        activo: r.activo,
        premio_tres: r.premio_tres,
        premio_dos: r.premio_dos,
        premios_tres: r.premios_tres,
        reinicio,
      },
    };
  });

  /** El sorteo que los clientes pueden ver ahora: visible y, si tiene apertura programada, ya abierto. */
  const abierto = async (id: string, avisarApertura = false): Promise<Sorteo> => {
    const s = await repos.sorteos.obtener(id);
    if (!s || !s.activo) throw noDisponible();
    if (!sorteoAbierto(s, app.ctx.ahora(), app.ctx.zona)) throw avisarApertura ? sinAbrir(s.abre) : noDisponible();
    return s;
  };

  // Los programados aparecen solos a su hora de apertura.
  app.get('/sorteos', limite(c.RATE_LIMIT_LECTURAS), async () =>
    (await repos.sorteos.listarActivos())
      .filter((s) => sorteoAbierto({ activo: true, abre: s.abre }, app.ctx.ahora(), app.ctx.zona))
      .map(({ abre: _a, ...s }) => s),
  );

  app.get<{ Params: { id: string } }>(
    '/sorteos/:id',
    limite(c.RATE_LIMIT_LECTURAS),
    async (req): Promise<SorteoPublico> => {
      const s = await abierto(req.params.id, true);
      const ocupados = await repos.reservas.ocupados(s.id);
      const {
        orden: _o,
        etiqueta: _e,
        activo: _a,
        fondo_imagen: _f,
        creado: _c,
        abre: _ab,
        lista_encabezado: _le,
        lista_pie: _lp,
        ...pub
      } = s;
      return { ...pub, ocupados };
    },
  );

  // Más margen: el tablero lo consulta cada pocos segundos cuando no hay canal en vivo, y varias personas
  // pueden compartir IP (datos móviles).
  app.get<{ Params: { id: string } }>(
    '/sorteos/:id/ocupados',
    limite(c.RATE_LIMIT_LECTURAS * 5),
    async (req, reply) => {
      const s = await abierto(req.params.id);
      const ocupados = await repos.reservas.ocupados(s.id);
      const etag = '"' + createHash('sha1').update(ocupados.join(',')).digest('base64url').slice(0, 16) + '"';
      reply.header('ETag', etag).header('Cache-Control', 'no-cache');
      if (req.headers['if-none-match'] === etag) return reply.status(304).send();
      return { ocupados };
    },
  );

  /** Tablero en vivo: envía la lista de ocupados al conectarse y cada vez que cambia. */
  app.get<{ Params: { id: string } }>('/sorteos/:id/en-vivo', limite(c.RATE_LIMIT_LECTURAS), async (req, reply) => {
    const s = await abierto(req.params.id);
    if (envivo.lleno())
      throw new ErrorApi(
        503,
        'en_vivo_lleno',
        'Hay mucha gente conectada. El tablero se actualiza cada pocos segundos.',
      );
    const inicial = await repos.reservas.ocupados(s.id);
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream', // sin "; charset": algunos túneles solo transmiten al instante con el tipo exacto
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
      connection: 'keep-alive',
    });
    envivo.unir(s.id, reply.raw, inicial);
  });

  app.get<{ Params: { telefono: string } }>('/contactos/:telefono', limite(c.RATE_LIMIT_CONTACTOS), async (req) => {
    const t = normalizarTelefono(req.params.telefono);
    if (!telefonoValido(t))
      throw new ErrorApi(422, 'telefono_invalido', 'Escribe tu celular de 10 dígitos. Debe empezar por 3.');
    const ct = await repos.contactos.buscar(t);
    if (!ct) throw new ErrorApi(404, 'no_encontrado', 'No está en la lista.');
    return { nombre: ct.nombre };
  });

  app.post<{ Params: { id: string } }>('/sorteos/:id/reservas', limite(c.RATE_LIMIT_RESERVAS), async (req, reply) => {
    const r = esquemaReserva.safeParse(req.body);
    if (!r.success) throw new ErrorApi(400, 'peticion_invalida', 'La petición no es válida.');
    const origen = {
      dispositivo: dispositivoDe(req, reply, c, 'red'),
      ip: ipCliente(req, c),
      agente: String(req.headers['user-agent'] ?? ''),
    };
    try {
      const hecho = await reservar(app.ctx, req.params.id, r.data, origen);
      return reply.status(201).send(hecho);
    } finally {
      void envivo.revisar(req.params.id);
    }
  });

  app.get<{ Querystring: { telefono?: string } }>('/mis-numeros', limite(c.RATE_LIMIT_MIS_NUMEROS), async (req) =>
    misNumeros(app.ctx, req.query.telefono ?? ''),
  );

  app.post('/ruleta/giro', limite(c.RATE_LIMIT_GIRO), async (req) => {
    const r = esquemaGiro.safeParse(req.body);
    if (!r.success) throw new ErrorApi(400, 'peticion_invalida', 'La petición no es válida.');
    return girar(app.ctx, r.data.telefono);
  });
};
