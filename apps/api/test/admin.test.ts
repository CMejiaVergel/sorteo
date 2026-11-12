import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ADMIN_ORIGIN, ADMIN_ORIGIN_2, crearAdmin, entrar, montar, sorteoBase } from './ayuda.ts';
import { cifrarClave } from '../src/auth/claves.ts';

const H = (cookie: string) => ({ cookie, origin: ADMIN_ORIGIN });

describe('autenticación', () => {
  it('un administrador creado inicia sesión; uno desactivado no', async () => {
    const { app, repos } = await montar();
    await crearAdmin(repos);
    const { respuesta, cookie } = await entrar(app);
    expect(respuesta.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/admin/auth/yo', headers: { cookie } })).json().usuario).toBe('miguel');
    await repos.admins.activar('miguel', false);
    expect((await app.inject({ url: '/api/admin/auth/yo', headers: { cookie } })).statusCode).toBe(401);
    expect((await entrar(app)).respuesta.statusCode).toBe(401);
  });

  it('mensaje idéntico para usuario inexistente y contraseña incorrecta', async () => {
    const { app, repos } = await montar();
    await crearAdmin(repos);
    const a = (await entrar(app, 'nadie', 'clave-de-prueba-123')).respuesta;
    const b = (await entrar(app, 'miguel', 'otra-clave-mala')).respuesta;
    expect(a.statusCode).toBe(401);
    expect(a.body).toBe(b.body);
    expect(a.json().error.mensaje).toBe('Usuario o contraseña incorrectos');
  });

  it('el sexto intento fallido en 15 minutos recibe 429', async () => {
    const { app, repos } = await montar({ sinLimites: false });
    await crearAdmin(repos);
    const codigos = [];
    for (let i = 0; i < 6; i++) codigos.push((await entrar(app, 'miguel', 'mala-' + i)).respuesta.statusCode);
    expect(codigos.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codigos[5]).toBe(429);
  });

  it('sin cookie, las rutas de administración responden 401', async () => {
    const { app } = await montar();
    for (const url of ['/api/admin/sorteos', '/api/admin/contactos', '/api/admin/ruleta', '/api/admin/diseno', '/api/admin/ajustes'])
      expect((await app.inject(url)).statusCode).toBe(401);
  });

  it('una escritura con Origin distinto responde 403', async () => {
    const { app, repos } = await montar();
    await crearAdmin(repos);
    const { cookie } = await entrar(app);
    const r = await app.inject({ method: 'PUT', url: '/api/admin/ajustes', headers: { cookie, origin: 'http://malo.test' }, payload: {} });
    expect(r.statusCode).toBe(403);
    const sinOrigin = await app.inject({ method: 'PUT', url: '/api/admin/ajustes', headers: { cookie }, payload: {} });
    expect(sinOrigin.statusCode).toBe(403);
  });

  it('acepta escrituras desde cualquiera de los orígenes configurados del panel', async () => {
    const { app, repos } = await montar();
    await crearAdmin(repos);
    const { cookie } = await entrar(app);
    const a = await app.inject({ method: 'GET', url: '/api/admin/ajustes', headers: { cookie } });
    const r = await app.inject({ method: 'PUT', url: '/api/admin/ajustes', headers: { cookie, origin: ADMIN_ORIGIN_2 }, payload: a.json() });
    expect(r.statusCode).toBe(200);
  });

  it('cambiar la contraseña invalida las sesiones abiertas', async () => {
    const { app, repos } = await montar();
    const a = await crearAdmin(repos);
    const { cookie } = await entrar(app);
    await repos.admins.cambiarClave('miguel', await cifrarClave('otra-clave-larga-1'));
    await repos.sesiones.eliminarDeAdmin(a.id);
    expect((await app.inject({ url: '/api/admin/auth/yo', headers: { cookie } })).statusCode).toBe(401);
  });

  it('cerrar sesión borra la sesión en el servidor', async () => {
    const { app, repos } = await montar();
    await crearAdmin(repos);
    const { cookie } = await entrar(app);
    expect((await app.inject({ method: 'POST', url: '/api/admin/auth/logout', headers: H(cookie) })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/admin/auth/yo', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('administración', () => {
  async function conSesion() {
    const m = await montar();
    await crearAdmin(m.repos);
    const { cookie } = await entrar(m.app);
    return { ...m, cookie };
  }

  it('crea sorteo con fijos; líneas con error una a una y las válidas se aplican', async () => {
    const { app, repos, cookie } = await conSesion();
    await repos.contactos.guardar([{ telefono: '3109876543', nombre: 'Carlos' }]);
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/sorteos',
      headers: H(cookie),
      payload: { ...sorteoBase(), fijos: '01-02-03 Miguel 3001234567\n05-07 Carlos\n09 Desconocido\n3001112222\n01 Ana 3005556666' },
    });
    expect(r.statusCode).toBe(201);
    const { sorteo, fijos } = r.json();
    expect(fijos.agregadas).toBe(2);
    expect(fijos.errores).toHaveLength(3);
    expect(fijos.errores[0]).toContain('falta el celular de Desconocido');
    expect(fijos.errores[2]).toContain('01 ya está ocupado');
    const res = await repos.reservas.porSorteo(sorteo.id);
    expect(res.map((x) => x.numero)).toEqual([1, 2, 3, 5, 7]);
    expect(res.every((x) => x.tipo === 'fijo' && !x.pagado)).toBe(true);
  });

  it('el número de cobro y su titular son obligatorios al crear un sorteo', async () => {
    const { app, cookie } = await conSesion();
    const sinNequi = await app.inject({ method: 'POST', url: '/api/admin/sorteos', headers: H(cookie), payload: { ...sorteoBase(), nequi: '' } });
    expect(sinNequi.statusCode).toBe(422);
    expect(sinNequi.json().error.mensaje).toContain('número de cobro');
    const sinTitular = await app.inject({ method: 'POST', url: '/api/admin/sorteos', headers: H(cookie), payload: { ...sorteoBase(), nequi_titular: '' } });
    expect(sinTitular.statusCode).toBe(422);
  });

  it('copiar fijos salta los ocupados y los informa', async () => {
    const { app, repos, cookie } = await conSesion();
    const o = await repos.sorteos.guardar(sorteoBase({ nombre: 'Origen' }));
    const d = await repos.sorteos.guardar(sorteoBase({ nombre: 'Destino' }));
    await repos.reservas.apartar(o.id, [1, 2], { telefono: '3000000001', nombre: 'Ana' }, 'fijo');
    await repos.reservas.apartar(o.id, [9], { telefono: '3000000002', nombre: 'Cliente' }, 'cliente');
    await repos.reservas.apartar(d.id, [2], { telefono: '3000000003', nombre: 'Luisa' }, 'cliente');
    const r = (await app.inject({ method: 'POST', url: `/api/admin/sorteos/${d.id}/fijos/copiar`, headers: H(cookie), payload: { origen_id: o.id } })).json();
    expect(r.copiadas).toBe(1);
    expect(r.saltados).toEqual(['Ana: 02 ya estaban ocupados.']);
    expect(await repos.reservas.ocupados(d.id)).toEqual([1, 2]);
  });

  it('marcar pago, liberar y eliminar sorteo con sus reservas', async () => {
    const { app, repos, cookie } = await conSesion();
    const s = await repos.sorteos.guardar(sorteoBase());
    await repos.reservas.apartar(s.id, [1, 2], { telefono: '3000000001', nombre: 'Ana' }, 'cliente');
    await app.inject({ method: 'PATCH', url: `/api/admin/sorteos/${s.id}/reservas`, headers: H(cookie), payload: { telefono: '3000000001', pagado: true } });
    expect((await repos.reservas.porSorteo(s.id)).every((r) => r.pagado)).toBe(true);
    await app.inject({ method: 'DELETE', url: `/api/admin/sorteos/${s.id}/reservas?telefono=3000000001`, headers: H(cookie) });
    expect(await repos.reservas.ocupados(s.id)).toEqual([]);
    await repos.reservas.apartar(s.id, [5], { telefono: '3000000001', nombre: 'Ana' }, 'cliente');
    expect((await app.inject({ method: 'DELETE', url: `/api/admin/sorteos/${s.id}`, headers: H(cookie) })).statusCode).toBe(200);
    expect(await repos.reservas.porSorteo(s.id)).toEqual([]);
  });

  it('probabilidades que suman más de 100 se rechazan; probar no crea giros', async () => {
    const { app, repos, cookie } = await conSesion();
    const malo = await app.inject({
      method: 'PUT',
      url: '/api/admin/ruleta',
      headers: H(cookie),
      payload: { activo: true, prob_tres: 60, premio_tres: 'a', prob_dos: 50, premio_dos: 'b' },
    });
    expect(malo.statusCode).toBe(422);
    for (let i = 0; i < 5; i++) expect((await app.inject({ method: 'POST', url: '/api/admin/ruleta/prueba', headers: H(cookie) })).statusCode).toBe(200);
    expect(await repos.ruleta.total()).toBe(0);
  });

  it('reiniciar el tiro de hoy de un celular', async () => {
    const { app, cookie } = await conSesion();
    const g = () => app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } });
    expect((await g()).statusCode).toBe(200);
    expect((await g()).statusCode).toBe(409);
    const r = await app.inject({ method: 'DELETE', url: '/api/admin/ruleta/giros?telefono=3001234567&fecha=hoy', headers: H(cookie) });
    expect(r.json().borrado).toBe(true);
    expect((await g()).statusCode).toBe(200);
  });

  it('reiniciar los tiros de hoy para todos deja una marca que ven los celulares', async () => {
    const { app, cookie } = await conSesion();
    const g = (t: string) => app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: t } });
    await g('3001234567');
    await g('3109876543');
    const r = await app.inject({ method: 'DELETE', url: '/api/admin/ruleta/giros/hoy', headers: H(cookie) });
    expect(r.json().borrados).toBe(2);
    expect((await app.inject('/api/public/config')).json().ruleta.reinicio).not.toBe('');
    expect((await g('3001234567')).statusCode).toBe(200);
  });

  it('el mensaje del ticket se guarda en ajustes y se publica', async () => {
    const { app, cookie } = await conSesion();
    await app.inject({ method: 'PUT', url: '/api/admin/ajustes', headers: H(cookie), payload: { negocio: 'Pato', whatsapp: '', plantilla: 'x', plantilla_ticket: 'Hola {nombre}' } });
    expect((await app.inject('/api/public/config')).json().plantilla_ticket).toBe('Hola {nombre}');
  });

  it('contactos: importar devuelve las líneas inválidas', async () => {
    const { app, cookie } = await conSesion();
    const r = (await app.inject({ method: 'PUT', url: '/api/admin/contactos', headers: H(cookie), payload: { texto: 'Miguel 3001234567\nsin celular\n3109876543 Carlos Díaz' } })).json();
    expect(r).toEqual({ guardados: 2, errores: ['sin celular'] });
    expect((await app.inject({ url: '/api/admin/contactos?q=carl', headers: { cookie } })).json()).toHaveLength(1);
  });

  it('diseño se guarda validado y se ve en /config', async () => {
    const { app, cookie } = await conSesion();
    const r = await app.inject({ method: 'PUT', url: '/api/admin/diseno', headers: H(cookie), payload: { ruleta: { colorBoton: '#112233', escalaSimbolos: 80 } } });
    expect(r.statusCode).toBe(200);
    const cfg = (await app.inject('/api/public/config')).json();
    expect(cfg.diseno.ruleta.colorBoton).toBe('#112233');
    expect((await app.inject({ method: 'PUT', url: '/api/admin/diseno', headers: H(cookie), payload: { ruleta: { escalaSimbolos: 5 } } })).statusCode).toBe(422);
  });

  describe('imágenes', () => {
    const subir = (app: Awaited<ReturnType<typeof montar>>['app'], cookie: string, contenido: Buffer, nombre: string) => {
      const limite = '----pato';
      const cuerpo = Buffer.concat([
        Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: image/png\r\n\r\n`),
        contenido,
        Buffer.from(`\r\n--${limite}--\r\n`),
      ]);
      return app.inject({
        method: 'POST',
        url: '/api/admin/medios?uso=logo',
        headers: { ...H(cookie), 'content-type': `multipart/form-data; boundary=${limite}` },
        payload: cuerpo,
      });
    };

    it('un archivo que no es imagen se rechaza aunque tenga extensión .png', async () => {
      const { app, cookie } = await conSesion();
      const r = await subir(app, cookie, Buffer.from('<svg onload=alert(1)>'), 'falso.png');
      expect(r.statusCode).toBe(422);
    });

    it('toda imagen sale reprocesada, en WebP, sin metadatos y dentro del tamaño máximo', async () => {
      const { app, cookie } = await conSesion();
      const png = await sharp({ create: { width: 2000, height: 1000, channels: 4, background: '#ff0000' } })
        .png()
        .withMetadata({ exif: { IFD0: { Copyright: 'secreto' } } })
        .toBuffer();
      const r = await subir(app, cookie, png, 'logo.png');
      expect(r.statusCode).toBe(201);
      const { url } = r.json();
      expect(url).toMatch(/^\/medios\/[a-f0-9]+\.webp$/);
      const archivo = await app.inject(url);
      expect(archivo.headers['x-content-type-options']).toBe('nosniff');
      const meta = await sharp(archivo.rawPayload).metadata();
      expect(meta.format).toBe('webp');
      expect(Math.max(meta.width!, meta.height!)).toBe(600);
      expect(meta.exif).toBeUndefined();
    });
  });
});
