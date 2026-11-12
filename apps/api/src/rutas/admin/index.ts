import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { decidirGiro, dosDigitos, hoyBogota, leerTexto, normalizarTelefono, telefonoValido, type Diseno, type UsoMedio } from '@pato/shared';
import {
  esquemaAjustes,
  esquemaApartarAdmin,
  esquemaBloqueo,
  esquemaLimite,
  esquemaContacto,
  esquemaLiberar,
  esquemaCopiarFijos,
  esquemaDiseno,
  esquemaLogin,
  esquemaPago,
  esquemaReclamado,
  esquemaRuleta,
  esquemaSorteo,
  esquemaTexto,
  limpiarDiseno,
  USOS_MEDIO,
} from '@pato/shared/esquemas';
import { hashRelleno, verificarClave } from '../../auth/claves.ts';
import { LimiteIntentos } from '../../auth/intentos.ts';
import { crearSesion, leerSesion, ponerCookie, quitarCookie } from '../../auth/sesion.ts';
import { ErrorApi } from '../../errores.ts';
import { borrarArchivo, procesarImagen } from '../../medios/procesar.ts';
import { CelularDeOtro, NumerosOcupados, type Admin } from '../../repositorios/tipos.ts';
import { agregarFijos, copiarFijos } from '../../servicios/negocio.ts';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: Admin;
    sesionId?: string;
  }
}

const sinSesion = () => new ErrorApi(401, 'sin_sesion', 'Inicia sesión para continuar.');
const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Todas las imágenes del documento de diseño. */
const imagenesDiseno = (d: Diseno): string[] =>
  [d.ruleta.fondo, d.ruleta.logo, d.ruleta.mascota, d.ruleta.maquina, d.ruleta.botonImagen, d.tablero.logoOcupado, ...Object.values(d.ruleta.simbolos)].filter(
    (x): x is string => !!x,
  );

export const rutasAdmin: FastifyPluginAsync<{ sinLimites: boolean }> = async (app, opts) => {
  const { repos } = app.ctx;
  const c = app.config;
  const intentos = new LimiteIntentos();
  const ahora = () => app.ctx.ahora();
  const anotar = (req: FastifyRequest, accion: string, entidad = '', entidad_id = '', detalle = '') =>
    repos.auditoria.anotar({ admin_id: req.admin?.id ?? null, accion, entidad, entidad_id, detalle, ip: req.ip });

  /** Borra los archivos que dejaron de usarse. */
  async function limpiarSinUso(candidatas: string[]) {
    if (!candidatas.length) return;
    const [enSorteos, a] = await Promise.all([repos.sorteos.imagenesEnUso(), repos.ajustes.obtener()]);
    const enUso = new Set([...enSorteos, ...imagenesDiseno(a.diseno)]);
    for (const ruta of new Set(candidatas)) {
      if (!ruta || enUso.has(ruta)) continue;
      await borrarArchivo(c.dirMedios, ruta.split('/').pop() ?? '');
      await repos.medios.eliminar(ruta);
    }
  }

  // ---- Protecciones de todo /api/admin ----
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    reply.header('Cache-Control', 'no-store');
    if (!LECTURA.has(req.method) && !c.ADMIN_ORIGIN.includes(String(req.headers.origin ?? '')))
      throw new ErrorApi(403, 'origen_no_permitido', 'Origen no permitido.');
    if (req.routeOptions.url === '/api/admin/auth/login') return;
    const s = await leerSesion(req, repos, c, ahora());
    if (!s) throw sinSesion();
    req.admin = s.admin;
    req.sesionId = s.sesionId;
  });

  // ---- Autenticación ----
  app.post('/auth/login', async (req, reply) => {
    const r = esquemaLogin.safeParse(req.body);
    if (!r.success) throw new ErrorApi(400, 'peticion_invalida', 'La petición no es válida.');
    const usuario = r.data.usuario.toLowerCase();
    const claves = [`ip:${req.ip}`, `u:${usuario}`];
    const espera = opts.sinLimites ? 0 : intentos.espera(...claves);
    if (espera > 0) {
      reply.header('Retry-After', String(espera));
      throw new ErrorApi(429, 'demasiados_intentos', 'Demasiados intentos. Espera unos minutos e intenta de nuevo.');
    }
    const admin = await repos.admins.porUsuario(usuario);
    const ok = admin ? await verificarClave(admin.clave_hash, r.data.clave) : (await verificarClave(await hashRelleno(), r.data.clave), false);
    if (!admin || !ok || !admin.activo) {
      intentos.fallo(...claves);
      await repos.auditoria.anotar({ admin_id: admin?.id ?? null, accion: 'login_fallido', entidad: 'admin', detalle: usuario, ip: req.ip });
      throw new ErrorApi(401, 'credenciales', 'Usuario o contraseña incorrectos');
    }
    intentos.limpiar(`u:${usuario}`);
    const id = await crearSesion(repos, admin.id, req, ahora());
    await repos.admins.marcarIngreso(admin.id);
    await repos.auditoria.anotar({ admin_id: admin.id, accion: 'login', entidad: 'admin', ip: req.ip });
    ponerCookie(reply, c, id);
    return { usuario: admin.usuario };
  });

  app.post('/auth/logout', async (req, reply) => {
    if (req.sesionId) await repos.sesiones.eliminar(req.sesionId);
    quitarCookie(reply, c);
    return { ok: true };
  });

  app.get('/auth/yo', async (req) => ({ usuario: req.admin!.usuario, public_origin: c.PUBLIC_ORIGIN }));

  // ---- Sorteos ----
  app.get('/sorteos', async () => repos.sorteos.listarTodos());

  app.post('/sorteos', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const datos = esquemaSorteo.parse(body);
    const s = await repos.sorteos.guardar(datos);
    await anotar(req, 'crear_sorteo', 'sorteo', s.id, s.nombre);
    const fijos = typeof body.fijos === 'string' && body.fijos.trim() ? await agregarFijos(app.ctx, s.id, body.fijos) : { agregadas: 0, errores: [] };
    return reply.status(201).send({ sorteo: s, fijos });
  });

  app.get<{ Params: { id: string } }>('/sorteos/:id', async (req) => {
    const s = await repos.sorteos.obtener(req.params.id);
    if (!s) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
    return s;
  });

  app.put<{ Params: { id: string } }>('/sorteos/:id', async (req) => {
    const antes = await repos.sorteos.obtener(req.params.id);
    if (!antes) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const datos = esquemaSorteo.parse({ ...antes, ...body });
    const s = await repos.sorteos.guardar(datos, antes.id);
    await anotar(req, 'editar_sorteo', 'sorteo', s.id, s.nombre);
    await limpiarSinUso([antes.imagen, antes.logo_loteria, antes.logo_ocupado, antes.fondo_imagen]);
    const fijos = typeof body.fijos === 'string' && body.fijos.trim() ? await agregarFijos(app.ctx, s.id, body.fijos) : { agregadas: 0, errores: [] };
    return { sorteo: s, fijos };
  });

  app.delete<{ Params: { id: string } }>('/sorteos/:id', async (req) => {
    const antes = await repos.sorteos.obtener(req.params.id);
    if (!antes) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
    await repos.sorteos.eliminar(antes.id);
    await anotar(req, 'eliminar_sorteo', 'sorteo', antes.id, antes.nombre);
    await limpiarSinUso([antes.imagen, antes.logo_loteria, antes.logo_ocupado, antes.fondo_imagen]);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/sorteos/:id/reservas', async (req) => repos.reservas.porSorteo(req.params.id));

  app.post<{ Params: { id: string } }>('/sorteos/:id/fijos', async (req) => {
    const { texto } = esquemaTexto.parse(req.body);
    const r = await agregarFijos(app.ctx, req.params.id, texto);
    await anotar(req, 'agregar_fijos', 'sorteo', req.params.id, `${r.agregadas} personas`);
    return r;
  });

  app.post<{ Params: { id: string } }>('/sorteos/:id/fijos/copiar', async (req) => {
    const { origen_id } = esquemaCopiarFijos.parse(req.body);
    const r = await copiarFijos(app.ctx, req.params.id, origen_id);
    await anotar(req, 'copiar_fijos', 'sorteo', req.params.id, `desde ${origen_id}`);
    return r;
  });

  // Apartar a nombre de alguien desde el panel (pedidos por WhatsApp) o agregar fijos.
  app.post<{ Params: { id: string } }>('/sorteos/:id/apartar', async (req, reply) => {
    const s = await repos.sorteos.obtener(req.params.id);
    if (!s) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
    const { telefono, nombre, numeros, fijo } = esquemaApartarAdmin.parse(req.body);
    const lista = [...new Set(numeros)].sort((a, b) => a - b);
    await repos.contactos.guardar([{ telefono, nombre }]);
    try {
      await repos.reservas.apartar(s.id, lista, { telefono, nombre }, fijo ? 'fijo' : 'cliente');
    } catch (e) {
      if (e instanceof NumerosOcupados) {
        const o = e.ocupados.map(dosDigitos).join(', ');
        throw new ErrorApi(409, 'numeros_ocupados', `${o} ya ${e.ocupados.length === 1 ? 'está ocupado' : 'están ocupados'}. Quítalos e intenta de nuevo.`, {
          ocupados: e.ocupados,
        });
      }
      throw e;
    }
    await anotar(req, fijo ? 'apartar_fijo' : 'apartar_panel', 'sorteo', s.id, `${telefono}: ${lista.map(dosDigitos).join('-')}`);
    return reply.status(201).send({ numeros: lista, nombre, telefono });
  });

  app.patch<{ Params: { id: string } }>('/sorteos/:id/reservas', async (req) => {
    const { telefono, pagado, numeros } = esquemaPago.parse(req.body);
    const n = await repos.reservas.marcarPago(req.params.id, telefono, pagado, numeros);
    await anotar(req, pagado ? 'marcar_pagado' : 'marcar_por_pagar', 'sorteo', req.params.id, numeros ? `${telefono}: ${numeros.map(dosDigitos).join('-')}` : telefono);
    return { cambiadas: n };
  });

  app.post<{ Params: { id: string } }>('/sorteos/:id/reservas/liberar', async (req) => {
    const { telefono, numeros } = esquemaLiberar.parse(req.body);
    const n = await repos.reservas.liberar(req.params.id, telefono, numeros, ahora().toISOString());
    await anotar(req, 'liberar', 'sorteo', req.params.id, `${telefono}: ${numeros ? numeros.map(dosDigitos).join('-') : 'todos'} (${n})`);
    return { liberadas: n };
  });

  app.get<{ Params: { id: string } }>('/sorteos/:id/liberados', async (req) => repos.reservas.liberados(req.params.id));

  app.delete<{ Params: { id: string } }>('/sorteos/:id/liberados', async (req) => {
    const n = await repos.reservas.borrarLiberados(req.params.id);
    await anotar(req, 'limpiar_liberados', 'sorteo', req.params.id, String(n));
    return { borrados: n };
  });

  app.delete<{ Params: { id: string }; Querystring: { telefono?: string } }>('/sorteos/:id/reservas', async (req) => {
    const t = normalizarTelefono(req.query.telefono);
    if (!telefonoValido(t)) throw new ErrorApi(422, 'telefono_invalido', 'Celular no válido.');
    const n = await repos.reservas.liberar(req.params.id, t, undefined, ahora().toISOString());
    await anotar(req, 'liberar', 'sorteo', req.params.id, `${t}: ${n} números`);
    return { liberadas: n };
  });

  // ---- Contactos ----
  app.get<{ Querystring: { q?: string } }>('/contactos', async (req) => repos.contactos.listar(req.query.q));

  app.put('/contactos', async (req) => {
    const { texto } = esquemaTexto.parse(req.body);
    const buenos: { telefono: string; nombre: string }[] = [];
    const errores: string[] = [];
    for (const l of leerTexto(texto)) {
      if (telefonoValido(l.telefono) && l.nombre.length >= 2 && !l.numeros.length) buenos.push({ telefono: l.telefono, nombre: l.nombre });
      else errores.push(l.linea);
    }
    if (buenos.length) await repos.contactos.guardar(buenos);
    return { guardados: buenos.length, errores };
  });

  // Agregar un contacto (formulario de nombre y celular). Si el celular ya existe, avisa en vez de pisarlo.
  app.post('/contactos', async (req, reply) => {
    const c = esquemaContacto.parse(req.body);
    const ya = await repos.contactos.buscar(c.telefono);
    if (ya) throw new ErrorApi(409, 'contacto_existe', `Ese celular ya está guardado como ${ya.nombre}.`, { contacto: ya });
    await repos.contactos.guardar([c]);
    await anotar(req, 'crear_contacto', 'contacto', c.telefono, c.nombre);
    return reply.status(201).send(c);
  });

  // Corregir nombre o celular. Se aplica también a sus números apartados.
  app.put<{ Params: { telefono: string } }>('/contactos/:telefono', async (req) => {
    const antes = normalizarTelefono(req.params.telefono);
    const c = esquemaContacto.parse(req.body);
    try {
      if (!(await repos.contactos.editar(antes, c))) throw new ErrorApi(404, 'no_encontrado', 'Ese contacto no existe.');
    } catch (e) {
      if (e instanceof CelularDeOtro) throw new ErrorApi(409, 'celular_de_otro', `Ese celular ya es de ${e.contacto.nombre}.`);
      throw e;
    }
    await anotar(req, 'editar_contacto', 'contacto', c.telefono, antes === c.telefono ? c.nombre : `${antes} → ${c.telefono}`);
    return c;
  });

  app.delete<{ Params: { telefono: string } }>('/contactos/:telefono', async (req) => {
    const ok = await repos.contactos.eliminar(normalizarTelefono(req.params.telefono));
    if (!ok) throw new ErrorApi(404, 'no_encontrado', 'Ese contacto no existe.');
    await anotar(req, 'borrar_contacto', 'contacto', req.params.telefono);
    return { ok: true };
  });

  // ---- Ruleta ----
  app.get('/ruleta', async () => repos.ruleta.config());

  app.put('/ruleta', async (req) => {
    const r = esquemaRuleta.safeParse(req.body);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.code === 'custom')?.message ?? 'Las probabilidades van de 0 a 100.';
      throw new ErrorApi(422, 'probabilidades_invalidas', msg);
    }
    const antes = await repos.ruleta.config();
    await repos.ruleta.guardarConfig(r.data);
    await anotar(req, 'config_ruleta', 'ruleta', '1', JSON.stringify({ antes, despues: r.data }));
    return r.data;
  });

  app.post('/ruleta/prueba', async () => decidirGiro(await repos.ruleta.config(), app.ctx.azar));

  app.get('/ruleta/giros', async () => {
    const [ganadores, total] = await Promise.all([repos.ruleta.ganadores(), repos.ruleta.total()]);
    return { ganadores, total };
  });

  app.patch<{ Params: { id: string } }>('/ruleta/giros/:id', async (req) => {
    const { reclamado } = esquemaReclamado.parse(req.body);
    if (!(await repos.ruleta.marcarReclamado(req.params.id, reclamado))) throw new ErrorApi(404, 'no_encontrado', 'Ese giro no existe.');
    await anotar(req, reclamado ? 'premio_entregado' : 'premio_no_entregado', 'giro', req.params.id);
    return { ok: true };
  });

  // Reinicia el tiro de hoy de todos los celulares (por ejemplo, después de pruebas).
  app.delete('/ruleta/giros/hoy', async (req) => {
    const fecha = hoyBogota(ahora(), app.ctx.zona);
    const borrados = await repos.ruleta.reiniciarTodos(fecha, ahora().toISOString());
    await anotar(req, 'reiniciar_tiros_todos', 'giro', '', `${fecha}: ${borrados}`);
    return { borrados };
  });

  app.delete<{ Querystring: { telefono?: string; fecha?: string } }>('/ruleta/giros', async (req) => {
    const t = normalizarTelefono(req.query.telefono);
    if (!telefonoValido(t)) throw new ErrorApi(422, 'telefono_invalido', 'Escribe un celular de 10 dígitos que empiece por 3.');
    const fecha = !req.query.fecha || req.query.fecha === 'hoy' ? hoyBogota(ahora(), app.ctx.zona) : req.query.fecha;
    const borrado = await repos.ruleta.reiniciar(t, fecha);
    await anotar(req, 'reiniciar_tiro', 'giro', t, fecha);
    return { borrado };
  });

  // ---- Diseño y ajustes ----
  app.get('/diseno', async () => (await repos.ajustes.obtener()).diseno);

  app.put('/diseno', async (req) => {
    const r = esquemaDiseno.safeParse(req.body);
    if (!r.success) throw new ErrorApi(422, 'diseno_invalido', 'Hay valores del diseño fuera de rango.');
    const antes = (await repos.ajustes.obtener()).diseno;
    const diseno = limpiarDiseno(r.data);
    await repos.ajustes.guardar({ diseno });
    await anotar(req, 'guardar_diseno', 'diseno');
    await limpiarSinUso(imagenesDiseno(antes));
    return diseno;
  });

  app.delete('/diseno', async (req) => {
    const antes = (await repos.ajustes.obtener()).diseno;
    const base = esquemaDiseno.parse({ tablero: antes.tablero });
    await repos.ajustes.guardar({ diseno: base });
    await anotar(req, 'restablecer_diseno', 'diseno');
    await limpiarSinUso(imagenesDiseno(antes));
    return base;
  });

  app.get('/ajustes', async () => {
    const { negocio, whatsapp, plantilla, plantilla_ticket } = await repos.ajustes.obtener();
    return { negocio, whatsapp, plantilla, plantilla_ticket };
  });

  app.put('/ajustes', async (req) => {
    const a = esquemaAjustes.parse(req.body);
    await repos.ajustes.guardar(a);
    await anotar(req, 'guardar_ajustes', 'ajustes');
    return a;
  });

  // ---- Seguridad (acaparamiento) ----
  app.get<{ Querystring: { q?: string } }>('/seguridad', async (req) => {
    const [limite, pendientes, alertas, dispositivos] = await Promise.all([
      repos.seguridad.limite(),
      repos.seguridad.pendientes(),
      repos.seguridad.alertas(),
      repos.seguridad.dispositivos(req.query.q),
    ]);
    return { limite, pendientes, alertas, dispositivos };
  });

  app.get('/seguridad/pendientes', async () => ({ pendientes: await repos.seguridad.pendientes() }));

  app.get<{ Params: { id: string } }>('/seguridad/dispositivos/:id/intentos', async (req) => repos.seguridad.intentos(req.params.id));

  app.post<{ Params: { id: string } }>('/seguridad/dispositivos/:id/bloqueo', async (req) => {
    const b = esquemaBloqueo.parse(req.body);
    if (!(await repos.seguridad.bloquear(req.params.id, b.bloqueado, b.motivo))) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese dispositivo.');
    const lib = b.bloqueado && b.liberar ? await repos.seguridad.liberarDeDispositivo(req.params.id) : { liberados: 0, sorteos: [] };
    await anotar(req, b.bloqueado ? 'bloquear_dispositivo' : 'desbloquear_dispositivo', 'dispositivo', req.params.id, b.motivo + (lib.liberados ? ` · liberó ${lib.liberados}` : ''));
    return { bloqueado: b.bloqueado, liberados: lib.liberados };
  });

  app.post('/seguridad/alertas/vistas', async () => ({ marcadas: await repos.seguridad.marcarVistas() }));

  app.put('/seguridad/limite', async (req) => {
    const { limite } = esquemaLimite.parse(req.body);
    await repos.seguridad.guardarLimite(limite);
    await anotar(req, 'limite_dispositivo', 'ajustes', '', String(limite));
    return { limite };
  });

  // ---- Medios ----
  app.post<{ Querystring: { uso?: string } }>('/medios', async (req, reply) => {
    const archivo = await req.file();
    if (!archivo) throw new ErrorApi(400, 'sin_archivo', 'Elige una imagen.');
    const usoCampo = (archivo.fields.uso as { value?: string } | undefined)?.value;
    const uso = (req.query.uso ?? usoCampo ?? '') as UsoMedio;
    if (!USOS_MEDIO.includes(uso)) throw new ErrorApi(422, 'uso_invalido', 'Uso de imagen no válido.');
    const buffer = await archivo.toBuffer();
    if (archivo.file.truncated) throw new ErrorApi(413, 'archivo_grande', 'La imagen pesa más de 8 MB.');
    const m = await procesarImagen(buffer, uso, c.dirMedios);
    const url = `${c.MEDIA_BASE_URL}/${m.nombre}`;
    await repos.medios.registrar({ id: m.id, ruta: url, uso, ancho: m.ancho, alto: m.alto, peso: m.peso });
    return reply.status(201).send({ url, ancho: m.ancho, alto: m.alto });
  });

  app.delete('/medios', async (req) => {
    const url = String((req.body as { url?: string } | null)?.url ?? '');
    if (!(await repos.medios.existe(url))) throw new ErrorApi(404, 'no_encontrado', 'Esa imagen no existe.');
    await limpiarSinUso([url]);
    return { ok: true };
  });
};
