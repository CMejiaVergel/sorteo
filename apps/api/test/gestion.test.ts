import { describe, expect, it } from 'vitest';
import { ADMIN_ORIGIN, crearAdmin, entrar, montar, sorteoBase } from './ayuda.ts';

/** Gestión desde el panel: apartar por WhatsApp, pagos parciales, liberar por número y contactos. */
async function preparar() {
  const m = await montar();
  await crearAdmin(m.repos);
  const { cookie } = await entrar(m.app);
  const s = await m.repos.sorteos.guardar(sorteoBase());
  const H = { cookie, origin: ADMIN_ORIGIN };
  const pedir = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    m.app.inject({ method, url: '/api/admin' + url, headers: H, payload });
  return { ...m, s, pedir };
}

describe('apartar desde el panel', () => {
  it('aparta a nombre de alguien, guarda el contacto y respeta los ocupados', async () => {
    const { s, pedir, repos } = await preparar();
    const r = await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '+57 310 987 6543', nombre: ' Ana  Ruiz ', numeros: [7, 3, 7] });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ numeros: [3, 7], nombre: 'Ana Ruiz', telefono: '3109876543' });
    expect((await repos.contactos.buscar('3109876543'))?.nombre).toBe('Ana Ruiz');
    const res = await repos.reservas.porSorteo(s.id);
    expect(res.map((x) => [x.numero, x.tipo])).toEqual([
      [3, 'cliente'],
      [7, 'cliente'],
    ]);

    const choque = await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [7, 8] });
    expect(choque.statusCode).toBe(409);
    expect(choque.json().error.detalle.ocupados).toEqual([7]);
    expect(await repos.reservas.ocupados(s.id)).toEqual([3, 7]); // todo o nada
  });

  it('marca como fijo cuando se pide y valida nombre y celular', async () => {
    const { s, pedir, repos } = await preparar();
    expect((await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [1, 5], fijo: true })).statusCode).toBe(201);
    expect((await repos.reservas.porSorteo(s.id)).every((x) => x.tipo === 'fijo')).toBe(true);
    const malo = await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '2001112233', nombre: 'Leo', numeros: [2] });
    expect(malo.statusCode).toBe(422);
    expect(malo.json().error.mensaje).toMatch(/10 dígitos/);
    expect((await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'L', numeros: [2] })).statusCode).toBe(422);
    expect((await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [] })).statusCode).toBe(422);
  });

  it('los fijos de cada sorteo son independientes', async () => {
    const { s, pedir, repos } = await preparar();
    const otro = await repos.sorteos.guardar(sorteoBase({ nombre: 'Caribeña' }));
    await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [1, 5], fijo: true });
    await pedir('POST', `/sorteos/${otro.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [9], fijo: true });
    await pedir('POST', `/sorteos/${s.id}/reservas/liberar`, { telefono: '3001112233', numeros: [5] });
    expect(await repos.reservas.ocupados(s.id)).toEqual([1]);
    expect(await repos.reservas.ocupados(otro.id)).toEqual([9]);
  });
});

describe('pagos y liberación por número', () => {
  it('marca pagados solo los números elegidos', async () => {
    const { s, pedir, repos } = await preparar();
    await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3109876543', nombre: 'Ana', numeros: [3, 4, 5] });
    const r = await pedir('PATCH', `/sorteos/${s.id}/reservas`, { telefono: '3109876543', pagado: true, numeros: [3, 5] });
    expect(r.json().cambiadas).toBe(2);
    const pag = (await repos.reservas.porSorteo(s.id)).filter((x) => x.pagado).map((x) => x.numero);
    expect(pag).toEqual([3, 5]);
    // Sin lista: todos.
    await pedir('PATCH', `/sorteos/${s.id}/reservas`, { telefono: '3109876543', pagado: true });
    expect((await repos.reservas.porSorteo(s.id)).every((x) => x.pagado)).toBe(true);
  });

  it('libera solo los números elegidos y los guarda en el historial', async () => {
    const { s, pedir, repos } = await preparar();
    await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3109876543', nombre: 'Ana', numeros: [10, 11, 12, 13] });
    await pedir('PATCH', `/sorteos/${s.id}/reservas`, { telefono: '3109876543', pagado: true, numeros: [10, 11] });
    const r = await pedir('POST', `/sorteos/${s.id}/reservas/liberar`, { telefono: '3109876543', numeros: [12, 13] });
    expect(r.json().liberadas).toBe(2);
    expect(await repos.reservas.ocupados(s.id)).toEqual([10, 11]);
    const lib = (await pedir('GET', `/sorteos/${s.id}/liberados`)).json();
    expect(lib.map((x: { numero: number }) => x.numero).sort()).toEqual([12, 13]);
    expect(lib[0]).toMatchObject({ nombre: 'Ana', telefono: '3109876543' });
    // Ya se pueden volver a apartar.
    expect((await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3001112233', nombre: 'Leo', numeros: [12] })).statusCode).toBe(201);
    // El número de otra persona no se libera.
    await pedir('POST', `/sorteos/${s.id}/reservas/liberar`, { telefono: '3109876543', numeros: [12] });
    expect(await repos.reservas.ocupados(s.id)).toEqual([10, 11, 12]);
    expect((await pedir('DELETE', `/sorteos/${s.id}/liberados`)).json().borrados).toBe(2);
  });
});

describe('contactos', () => {
  it('agrega uno con nombre y celular y no pisa uno existente', async () => {
    const { pedir, repos } = await preparar();
    expect((await pedir('POST', '/contactos', { nombre: 'Ana Ruiz', telefono: '310 987 6543' })).statusCode).toBe(201);
    expect((await repos.contactos.buscar('3109876543'))?.nombre).toBe('Ana Ruiz');
    const otra = await pedir('POST', '/contactos', { nombre: 'Otra', telefono: '3109876543' });
    expect(otra.statusCode).toBe(409);
    expect(otra.json().error.mensaje).toMatch(/Ana Ruiz/);
  });

  it('corrige nombre y celular y lo aplica a sus números apartados', async () => {
    const { s, pedir, repos } = await preparar();
    await pedir('POST', `/sorteos/${s.id}/apartar`, { telefono: '3109876543', nombre: 'Anita', numeros: [20] });
    const r = await pedir('PUT', '/contactos/3109876543', { nombre: 'Ana Ruiz', telefono: '3209876543' });
    expect(r.statusCode).toBe(200);
    expect(await repos.contactos.buscar('3109876543')).toBeNull();
    expect((await repos.contactos.buscar('3209876543'))?.nombre).toBe('Ana Ruiz');
    expect((await repos.reservas.porSorteo(s.id))[0]).toMatchObject({ telefono: '3209876543', nombre: 'Ana Ruiz' });
  });

  it('no deja poner el celular de otro contacto', async () => {
    const { pedir } = await preparar();
    await pedir('POST', '/contactos', { nombre: 'Ana', telefono: '3109876543' });
    await pedir('POST', '/contactos', { nombre: 'Leo', telefono: '3001112233' });
    const r = await pedir('PUT', '/contactos/3109876543', { nombre: 'Ana', telefono: '3001112233' });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.mensaje).toMatch(/Leo/);
    expect((await pedir('PUT', '/contactos/3000000000', { nombre: 'Nadie', telefono: '3000000000' })).statusCode).toBe(404);
  });
});
