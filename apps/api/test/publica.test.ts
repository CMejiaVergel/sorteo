import { describe, expect, it } from 'vitest';
import { montar, sorteoBase } from './ayuda.ts';

describe('API pública', () => {
  it('salud y config sin probabilidades', async () => {
    const { app } = await montar();
    expect((await app.inject('/api/public/salud')).json()).toEqual({ ok: true });
    const cfg = (await app.inject('/api/public/config')).json();
    expect(cfg.negocio).toBe('El Pato de la Suerte');
    expect(cfg.ruleta).toEqual({
      activo: true,
      premio_tres: 'Un número gratis',
      premio_dos: '$1.000 de descuento',
      premios_tres: {},
      reinicio: '',
    });
    expect(JSON.stringify(cfg)).not.toMatch(/prob_/);
  });

  it('lista solo sorteos activos y oculta el detalle de los ocultos', async () => {
    const { app, repos } = await montar();
    await repos.sorteos.guardar(sorteoBase({ nombre: 'Visible', orden: 2 }));
    const oculto = await repos.sorteos.guardar(sorteoBase({ nombre: 'Oculto', activo: false }));
    const lista = (await app.inject('/api/public/sorteos')).json();
    expect(lista.map((s: { nombre: string }) => s.nombre)).toEqual(['Visible']);
    expect(lista[0].libres).toBe(100);
    const r = await app.inject(`/api/public/sorteos/${oculto.id}`);
    expect(r.statusCode).toBe(404);
    expect(r.json().error.codigo).toBe('sorteo_no_disponible');
  });

  it('apartar es todo o nada', async () => {
    const { app, repos } = await montar();
    const s = await repos.sorteos.guardar(sorteoBase());
    const url = `/api/public/sorteos/${s.id}/reservas`;
    const a = await app.inject({
      method: 'POST',
      url,
      payload: { numeros: [23, 48], nombre: 'Luisa', telefono: '300 000 0003' },
    });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toEqual({ nombre: 'Luisa', numeros: [23, 48], total: 20000, gratis: false });
    const b = await app.inject({
      method: 'POST',
      url,
      payload: { numeros: [5, 23, 48], nombre: 'Carlos', telefono: '3109876543' },
    });
    expect(b.statusCode).toBe(409);
    expect(b.json().error).toMatchObject({ codigo: 'numeros_ocupados', detalle: { ocupados: [23, 48] } });
    expect(b.json().error.mensaje).toBe(
      'Otra persona apartó los 23, 48 unos segundos antes que tú. Elige otros números.',
    );
    expect(await repos.reservas.ocupados(s.id)).toEqual([23, 48]);
  });

  it('valida celular, nombre, cantidad y rango', async () => {
    const { app, repos } = await montar();
    const s = await repos.sorteos.guardar(sorteoBase());
    const url = `/api/public/sorteos/${s.id}/reservas`;
    const p = (payload: object) => app.inject({ method: 'POST', url, payload });
    expect((await p({ numeros: [1], nombre: 'Ana', telefono: '6001234567' })).json().error.codigo).toBe(
      'telefono_invalido',
    );
    expect((await p({ numeros: [1], nombre: 'A', telefono: '3001234567' })).json().error.codigo).toBe(
      'nombre_invalido',
    );
    expect((await p({ numeros: [], nombre: 'Ana', telefono: '3001234567' })).json().error.codigo).toBe(
      'cantidad_invalida',
    );
    expect(
      (await p({ numeros: Array.from({ length: 31 }, (_, i) => i), nombre: 'Ana', telefono: '3001234567' })).json()
        .error.codigo,
    ).toBe('cantidad_invalida');
    expect((await p({ numeros: [100], nombre: 'Ana', telefono: '3001234567' })).json().error.codigo).toBe(
      'numero_fuera_de_rango',
    );
  });

  it('20 peticiones simultáneas por el mismo número: una 201 y diecinueve 409', async () => {
    const { app, repos } = await montar();
    const s = await repos.sorteos.guardar(sorteoBase());
    const r = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/api/public/sorteos/${s.id}/reservas`,
          payload: { numeros: [7], nombre: `Cliente ${i}`, telefono: `31000000${String(i).padStart(2, '0')}` },
        }),
      ),
    );
    const codigos = r.map((x) => x.statusCode);
    expect(codigos.filter((c) => c === 201)).toHaveLength(1);
    expect(codigos.filter((c) => c === 409)).toHaveLength(19);
  });

  it('un celular existente conserva su nombre guardado', async () => {
    const { app, repos } = await montar();
    const s = await repos.sorteos.guardar(sorteoBase());
    await repos.contactos.guardar([{ telefono: '3109876543', nombre: 'Carlos Díaz' }]);
    const r = await app.inject({
      method: 'POST',
      url: `/api/public/sorteos/${s.id}/reservas`,
      payload: { numeros: [5], nombre: 'Otro Nombre', telefono: '3109876543' },
    });
    expect(r.json().nombre).toBe('Carlos Díaz');
    expect((await repos.reservas.porSorteo(s.id))[0].nombre).toBe('Carlos Díaz');
    expect((await app.inject('/api/public/contactos/3109876543')).json()).toEqual({ nombre: 'Carlos Díaz' });
    expect((await app.inject('/api/public/contactos/3109999999')).statusCode).toBe(404);
  });

  it('ocupados con ETag y 304; nunca devuelve nombres', async () => {
    const { app, repos } = await montar();
    const s = await repos.sorteos.guardar(sorteoBase());
    await repos.reservas.apartar(s.id, [3, 1], { telefono: '3000000001', nombre: 'Ana' }, 'cliente');
    const a = await app.inject(`/api/public/sorteos/${s.id}/ocupados`);
    expect(a.json()).toEqual({ ocupados: [1, 3] });
    expect(a.body).not.toMatch(/Ana|300000/);
    const b = await app.inject({
      url: `/api/public/sorteos/${s.id}/ocupados`,
      headers: { 'if-none-match': a.headers.etag as string },
    });
    expect(b.statusCode).toBe(304);
  });

  it('mis números respeta la ventana de 7 días', async () => {
    const ahora = () => new Date('2026-11-10T15:00:00Z');
    const { app, repos } = await montar({ ahora });
    const tel = { telefono: '3000000001', nombre: 'Ana' };
    await repos.contactos.guardar([tel]);
    const viejo = await repos.sorteos.guardar(sorteoBase({ nombre: 'Viejo', fecha: '2026-11-02', activo: false }));
    const reciente = await repos.sorteos.guardar(
      sorteoBase({ nombre: 'Reciente', fecha: '2026-11-03', activo: false }),
    );
    const activo = await repos.sorteos.guardar(sorteoBase({ nombre: 'Activo', fecha: '2026-10-01' }));
    for (const s of [viejo, reciente, activo]) await repos.reservas.apartar(s.id, [4, 2], tel, 'cliente');
    await repos.reservas.marcarPago(activo.id, tel.telefono, true);
    const r = (await app.inject('/api/public/mis-numeros?telefono=3000000001')).json();
    expect(r.nombre).toBe('Ana');
    expect(r.sorteos.map((s: { nombre: string }) => s.nombre)).toEqual(['Reciente', 'Activo']);
    expect(r.sorteos[1]).toMatchObject({ numeros: [2, 4], pagados: [2, 4] });
    const vacio = (await app.inject('/api/public/mis-numeros?telefono=3109999999')).json();
    expect(vacio.sorteos).toEqual([]);
  });
});

describe('ruleta', () => {
  it('un giro por día; el segundo responde ya_giro con el resultado anterior', async () => {
    const { app } = await montar({ azar: () => 0.001 });
    const a = await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } });
    expect(a.statusCode).toBe(200);
    expect(a.json().gano).toBe(3);
    const b = await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } });
    expect(b.statusCode).toBe(409);
    expect(b.json().error.codigo).toBe('ya_giro');
    expect(b.json().error.detalle).toMatchObject({
      resultado: a.json().resultado,
      gano: 3,
      premio: 'Un número gratis',
    });
  });

  it('el cambio de día se calcula en hora de Colombia (23:59 y 00:01)', async () => {
    let t = new Date('2026-11-09T04:59:00Z'); // 23:59 del 8 en Bogotá
    const { app } = await montar({ ahora: () => t });
    const g = () => app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } });
    expect((await g()).statusCode).toBe(200);
    t = new Date('2026-11-09T04:59:59Z');
    expect((await g()).statusCode).toBe(409);
    t = new Date('2026-11-09T05:01:00Z'); // 00:01 del 9 en Bogotá
    expect((await g()).statusCode).toBe(200);
  });

  it('ruleta apagada y celular inválido', async () => {
    const { app, repos } = await montar();
    expect(
      (await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '123' } })).json().error
        .codigo,
    ).toBe('telefono_invalido');
    await repos.ruleta.guardarConfig({
      activo: false,
      prob_tres: 1,
      premio_tres: 'a',
      prob_dos: 10,
      premio_dos: 'b',
      premios_tres: {},
    });
    const r = await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.codigo).toBe('ruleta_inactiva');
  });

  it('límite de 5 giros por minuto por IP', async () => {
    const { app } = await montar({ sinLimites: false });
    const r = [];
    for (let i = 0; i < 6; i++)
      r.push(
        (await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: `310000000${i}` } }))
          .statusCode,
      );
    expect(r.slice(0, 5).every((c) => c !== 429)).toBe(true);
    expect(r[5]).toBe(429);
  });
});
