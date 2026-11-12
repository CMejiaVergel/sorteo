import { describe, expect, it } from 'vitest';
import { describirAgente } from '../src/servicios/agente.ts';
import { ADMIN_ORIGIN, crearAdmin, entrar, montar, sorteoBase } from './ayuda.ts';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

/** Sitio público + panel con sesión. `nuevoDispositivo()` simula abrir la página en otro celular. */
async function preparar(env?: Record<string, string>) {
  const m = await montar({ env });
  await crearAdmin(m.repos);
  const { cookie } = await entrar(m.app);
  const s = await m.repos.sorteos.guardar(sorteoBase());
  const admin = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    m.app.inject({ method, url: '/api/admin' + url, headers: { cookie, origin: ADMIN_ORIGIN }, payload });
  async function nuevoDispositivo(ua = ANDROID, extra: Record<string, string> = {}) {
    const r = await m.app.inject({ url: '/api/public/config', headers: { 'user-agent': ua, ...extra } });
    const c = r.cookies.find((x) => x.name === 'pato_disp')!;
    const headers = { 'user-agent': ua, cookie: `pato_disp=${c.value}`, ...extra };
    return {
      cookie: c,
      apartar: (numeros: number[], telefono = '3001112233', nombre = 'Ana Ruiz') =>
        m.app.inject({ method: 'POST', url: `/api/public/sorteos/${s.id}/reservas`, headers, payload: { numeros, nombre, telefono } }),
    };
  }
  return { ...m, s, admin, nuevoDispositivo };
}

describe('dispositivo', () => {
  it('al abrir la página recibe una cookie firmada, de solo servidor y de larga duración', async () => {
    const { nuevoDispositivo } = await preparar();
    const { cookie } = await nuevoDispositivo();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/api/public');
    expect(cookie.maxAge).toBeGreaterThan(365 * 24 * 3600);
    expect(cookie.value).toContain('.'); // firmada
  });

  it('cada reserva guarda dispositivo, red y navegador, y el panel lo muestra', async () => {
    const { nuevoDispositivo, admin, s } = await preparar();
    const d = await nuevoDispositivo();
    expect((await d.apartar([4, 9])).statusCode).toBe(201);
    const r = (await admin('GET', '/seguridad')).json();
    expect(r.limite).toBe(20);
    expect(r.dispositivos).toHaveLength(1);
    expect(r.dispositivos[0]).toMatchObject({
      descripcion: 'Android (SM-A515F) · Chrome',
      ip: '127.0.0.1',
      apartados: 2,
      bloqueado: false,
      personas: [{ telefono: '3001112233', nombre: 'Ana Ruiz' }],
      sorteos: [{ sorteo_id: s.id, numeros: [4, 9], pagados: 0 }],
    });
    const intentos = (await admin('GET', `/seguridad/dispositivos/${r.dispositivos[0].id}/intentos`)).json();
    expect(intentos[0]).toMatchObject({ resultado: 'ok', numeros: [4, 9] });
    // Buscar por celular o nombre.
    expect((await admin('GET', '/seguridad?q=111')).json().dispositivos).toHaveLength(1);
    expect((await admin('GET', '/seguridad?q=pedro')).json().dispositivos).toHaveLength(0);
  });

  it('con IP_CABECERA usa la IP real que manda el proxy', async () => {
    const { nuevoDispositivo, admin } = await preparar({ IP_CABECERA: 'cf-connecting-ip' });
    const d = await nuevoDispositivo(ANDROID, { 'cf-connecting-ip': '181.50.1.2' });
    await d.apartar([1]);
    expect((await admin('GET', '/seguridad')).json().dispositivos[0].ip).toBe('181.50.1.2');
  });

  it('sin cookie (un programa) usa un identificador fijo por red y navegador', async () => {
    const { app, s, repos } = await preparar();
    await repos.seguridad.guardarLimite(2);
    const p = (n: number) =>
      app.inject({ method: 'POST', url: `/api/public/sorteos/${s.id}/reservas`, headers: { 'user-agent': 'curl/8' }, payload: { numeros: [n], nombre: 'Bot', telefono: `300000000${n}` } });
    expect((await p(1)).statusCode).toBe(201);
    expect((await p(2)).statusCode).toBe(201);
    expect((await p(3)).json().error.codigo).toBe('limite_dispositivo');
  });
});

describe('límite por dispositivo', () => {
  it('no deja pasar del límite, explica cuántos quedan y avisa al panel', async () => {
    const { nuevoDispositivo, admin, repos, s } = await preparar();
    expect((await admin('PUT', '/seguridad/limite', { limite: 5 })).json()).toEqual({ limite: 5 });
    const d = await nuevoDispositivo();
    expect((await d.apartar([1, 2, 3, 4])).statusCode).toBe(201);
    const r = await d.apartar([10, 11, 12], '3005556677', 'Pedro');
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatchObject({ codigo: 'limite_dispositivo', detalle: { limite: 5, tiene: 4, quedan: 1, numeros: [10, 11, 12] } });
    expect(r.json().error.mensaje).toBe(
      'Por seguridad, desde un mismo celular se pueden apartar hasta 5 números por sorteo y ya tienes 4. Aquí puedes apartar 1 más; los demás pídelos por WhatsApp y te los separamos.',
    );
    expect(await repos.reservas.ocupados(s.id)).toEqual([1, 2, 3, 4]);
    // El intento rechazado no guarda el contacto.
    expect(await repos.contactos.buscar('3005556677')).toBeNull();
    // Otro celular sí puede.
    expect((await (await nuevoDispositivo()).apartar([10, 11, 12], '3005556677', 'Pedro')).statusCode).toBe(201);

    const seg = (await admin('GET', '/seguridad')).json();
    expect(seg.pendientes).toBe(1);
    expect(seg.alertas[0]).toMatchObject({ tipo: 'limite', sorteo: 'Paisita Día', veces: 1, vista: false });
    expect(seg.alertas[0].detalle).toContain('10, 11, 12');
    // Otro intento igual no crea otra alerta: suma una vez.
    await d.apartar([20, 21]);
    expect((await admin('GET', '/seguridad')).json().alertas[0].veces).toBe(2);
    await admin('POST', '/seguridad/alertas/vistas');
    expect((await admin('GET', '/seguridad/pendientes')).json()).toEqual({ pendientes: 0 });
  });

  it('peticiones simultáneas del mismo dispositivo no se saltan el límite', async () => {
    const { nuevoDispositivo, repos, s } = await preparar();
    await repos.seguridad.guardarLimite(5);
    const d = await nuevoDispositivo();
    const r = await Promise.all(Array.from({ length: 12 }, (_, i) => d.apartar([i], `30000000${10 + i}`, 'Rápido')));
    expect(r.filter((x) => x.statusCode === 201)).toHaveLength(5);
    expect(await repos.reservas.ocupados(s.id)).toHaveLength(5);
  });

  it('límite 0 = sin límite; valida el valor', async () => {
    const { nuevoDispositivo, admin } = await preparar();
    await admin('PUT', '/seguridad/limite', { limite: 0 });
    expect((await (await nuevoDispositivo()).apartar(Array.from({ length: 30 }, (_, i) => i))).statusCode).toBe(201);
    expect((await admin('PUT', '/seguridad/limite', { limite: 101 })).statusCode).toBe(422);
  });

  it('avisa (sin bloquear) cuando un dispositivo usa muchos celulares distintos', async () => {
    const { nuevoDispositivo, admin } = await preparar();
    const d = await nuevoDispositivo();
    for (let i = 0; i < 4; i++) expect((await d.apartar([i], `300123456${i}`, `Persona ${i}`)).statusCode).toBe(201);
    const a = (await admin('GET', '/seguridad')).json().alertas;
    expect(a.map((x: { tipo: string }) => x.tipo)).toEqual(['varios_celulares']);
  });
});

describe('bloqueo', () => {
  it('bloquea, explica cómo pedir por WhatsApp, libera lo no pagado y se puede desbloquear', async () => {
    const { nuevoDispositivo, admin, repos, s } = await preparar();
    const d = await nuevoDispositivo();
    await d.apartar([5, 6, 7]);
    await repos.reservas.marcarPago(s.id, '3001112233', true, [5]);
    const id = (await admin('GET', '/seguridad')).json().dispositivos[0].id;

    const b = await admin('POST', `/seguridad/dispositivos/${id}/bloqueo`, { bloqueado: true, motivo: 'Acaparando', liberar: true });
    expect(b.json()).toEqual({ bloqueado: true, liberados: 2 });
    expect(await repos.reservas.ocupados(s.id)).toEqual([5]); // el pagado se queda
    expect((await repos.reservas.liberados(s.id)).map((l) => l.numero).sort()).toEqual([6, 7]);

    const r = await d.apartar([30]);
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toMatchObject({ codigo: 'dispositivo_bloqueado', detalle: { numeros: [30] } });
    expect(r.json().error.mensaje).toContain('WhatsApp');
    const seg = (await admin('GET', '/seguridad')).json();
    expect(seg.dispositivos[0]).toMatchObject({ bloqueado: true, motivo: 'Acaparando', rechazados: 1 });
    expect(seg.alertas[0].tipo).toBe('bloqueado');

    await admin('POST', `/seguridad/dispositivos/${id}/bloqueo`, { bloqueado: false });
    expect((await d.apartar([30])).statusCode).toBe(201);
    expect((await admin('POST', '/seguridad/dispositivos/nada/bloqueo', { bloqueado: true })).statusCode).toBe(404);
  });

  it('las rutas de seguridad exigen sesión', async () => {
    const { app } = await preparar();
    expect((await app.inject('/api/admin/seguridad')).statusCode).toBe(401);
  });
});

describe('tablero en vivo', () => {
  it('envía los ocupados al conectarse y cada vez que alguien aparta', async () => {
    const { app, s, repos } = await preparar();
    await repos.reservas.apartar(s.id, [3], { telefono: '3000000001', nombre: 'Ana' }, 'cliente');
    const dir = await app.listen({ port: 0, host: '127.0.0.1' });
    const ctrl = new AbortController();
    try {
      const res = await fetch(`${dir}/api/public/sorteos/${s.id}/en-vivo`, { signal: ctrl.signal });
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const lector = res.body!.getReader();
      const dec = new TextDecoder();
      const siguiente = async () => {
        let t = '';
        while (!t.includes('\n\n')) t += dec.decode((await lector.read()).value);
        return JSON.parse(/data: (.*)/.exec(t)![1]);
      };
      expect(await siguiente()).toEqual({ ocupados: [3] });
      await fetch(`${dir}/api/public/sorteos/${s.id}/reservas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numeros: [8], nombre: 'Luis', telefono: '3000000002' }),
      });
      expect(await siguiente()).toEqual({ ocupados: [3, 8] });
    } finally {
      ctrl.abort();
      await app.close();
    }
  });
});

describe('describirAgente', () => {
  it('nombra sistema y navegador en palabras sencillas', () => {
    expect(describirAgente(ANDROID)).toBe('Android (SM-A515F) · Chrome');
    expect(describirAgente('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe('Android · Chrome');
    expect(describirAgente('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(
      'iPhone · Safari',
    );
    expect(describirAgente('curl/8.4.0')).toBe('Programa automático');
    expect(describirAgente('')).toBe('Desconocido');
  });
});
