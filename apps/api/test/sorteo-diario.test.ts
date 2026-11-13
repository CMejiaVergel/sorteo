import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { abrirDb } from '../src/db/conexion.ts';
import { MIGRACIONES } from '../src/db/esquema.ts';
import { reposSqlite } from '../src/repositorios/sqlite.ts';
import { ADMIN_ORIGIN, crearAdmin, entrar, montar, sorteoBase } from './ayuda.ts';

/** Sorteos que se reutilizan cada día: gratis, máximo por persona, apertura programada, reinicio y premios por símbolo. */
async function preparar(op: Parameters<typeof montar>[0] = {}) {
  const m = await montar(op);
  await crearAdmin(m.repos);
  const { cookie } = await entrar(m.app);
  const H = { cookie, origin: ADMIN_ORIGIN };
  const admin = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    m.app.inject({ method, url: '/api/admin' + url, headers: H, payload });
  const apartar = (id: string, numeros: number[], telefono = '3001234567', nombre = 'Luisa') =>
    m.app.inject({ method: 'POST', url: `/api/public/sorteos/${id}/reservas`, payload: { numeros, nombre, telefono } });
  return { ...m, admin, apartar };
}

describe('migración 5', () => {
  it('conserva sorteos y reservas al reconstruir la tabla, y deja crear sorteos de valor 0 solo si son gratis', () => {
    const ruta = join(mkdtempSync(join(tmpdir(), 'pato-mig-')), 'pato.db');
    const vieja = new DatabaseSync(ruta);
    for (const m of MIGRACIONES.slice(0, 4)) vieja.exec(typeof m === 'string' ? m : m.sql);
    vieja.exec('PRAGMA user_version = 4');
    vieja.exec(`INSERT INTO sorteos (id, nombre, valor_boleta, creado) VALUES ('s1', 'Paisita', 5000, '2026-11-01')`);
    vieja.exec(
      `INSERT INTO reservas (id, sorteo_id, numero, telefono, nombre, tipo, creado) VALUES ('r1', 's1', 7, '3001234567', 'Ana', 'cliente', 'x')`,
    );
    vieja.close();

    const db = abrirDb(ruta);
    expect(Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)).toBe(
      MIGRACIONES.length,
    );
    expect(db.prepare('SELECT nombre, valor_boleta, gratis, max_por_celular, abre FROM sorteos').get()).toEqual({
      nombre: 'Paisita',
      valor_boleta: 5000,
      gratis: 0,
      max_por_celular: 0,
      abre: null,
    });
    expect(db.prepare('SELECT count(*) AS n FROM reservas').get()).toEqual({ n: 1 });
    // Las claves foráneas siguen activas y apuntan a la tabla nueva.
    expect(Number((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys)).toBe(1);
    db.exec(`DELETE FROM sorteos WHERE id = 's1'`);
    expect(db.prepare('SELECT count(*) AS n FROM reservas').get()).toEqual({ n: 0 });
    expect(() => db.exec(`INSERT INTO sorteos (id, nombre, valor_boleta, creado) VALUES ('s2', 'X', 0, 'x')`)).toThrow(
      /CHECK/,
    );
    db.exec(`INSERT INTO sorteos (id, nombre, valor_boleta, gratis, creado) VALUES ('s3', 'Gratis', 0, 1, 'x')`);
    db.close();
  });
});

describe('sorteo gratis', () => {
  it('se crea con valor 0, la reserva no cobra y uno pagado sigue pidiendo valor', async () => {
    const { admin, apartar } = await preparar();
    const sinValor = await admin('POST', '/sorteos', { ...sorteoBase({ valor_boleta: 0 }) });
    expect(sinValor.statusCode).toBe(422);

    const r = await admin('POST', '/sorteos', {
      ...sorteoBase({ nombre: 'Regalo', gratis: true, valor_boleta: 5000 }),
    });
    expect(r.statusCode).toBe(201);
    const s = r.json().sorteo;
    expect(s).toMatchObject({ gratis: true, valor_boleta: 0 });

    const a = await apartar(s.id, [3, 9]);
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ total: 0, gratis: true });
  });
});

describe('máximo de números por persona', () => {
  it('cuenta lo que el celular ya tiene en el sorteo y no afecta a otras personas', async () => {
    const { repos, apartar } = await preparar();
    const s = await repos.sorteos.guardar(sorteoBase({ max_por_celular: 3 }));

    const muchos = await apartar(s.id, [1, 2, 3, 4]);
    expect(muchos.statusCode).toBe(409);
    expect(muchos.json().error).toMatchObject({ codigo: 'limite_celular', detalle: { limite: 3, tiene: 0 } });

    expect((await apartar(s.id, [1, 2])).statusCode).toBe(201);
    const otra = await apartar(s.id, [5, 6]);
    expect(otra.statusCode).toBe(409);
    expect(otra.json().error.detalle).toMatchObject({ tiene: 2, quedan: 1 });
    expect(otra.json().error.mensaje).toMatch(/hasta 3 números y ya tienes 2/);
    expect((await apartar(s.id, [5])).statusCode).toBe(201);

    // Otra persona tiene su propio cupo.
    expect((await apartar(s.id, [10, 11, 12], '3109876543', 'Ana')).statusCode).toBe(201);
    expect(await repos.reservas.ocupados(s.id)).toEqual([1, 2, 5, 10, 11, 12]);
  });

  it('el panel puede apartar sin ese límite', async () => {
    const { repos, admin } = await preparar();
    const s = await repos.sorteos.guardar(sorteoBase({ max_por_celular: 1 }));
    const r = await admin('POST', `/sorteos/${s.id}/apartar`, {
      telefono: '3001234567',
      nombre: 'Luisa',
      numeros: [1, 2, 3],
    });
    expect(r.statusCode).toBe(201);
  });
});

describe('apertura programada', () => {
  it('el sorteo no se ve ni se puede apartar hasta la hora de Bogotá programada', async () => {
    let ahora = new Date('2026-11-13T23:59:00Z'); // 18:59 en Bogotá
    const { repos, app, apartar } = await preparar({ ahora: () => ahora });
    const s = await repos.sorteos.guardar(sorteoBase({ abre: '2026-11-13T19:00' }));
    const lista = async () =>
      (await app.inject({ method: 'GET', url: '/api/public/sorteos' })).json().map((x: { id: string }) => x.id);

    expect(await lista()).toEqual([]);
    const ver = await app.inject({ method: 'GET', url: `/api/public/sorteos/${s.id}` });
    expect(ver.statusCode).toBe(403);
    expect(ver.json().error).toMatchObject({ codigo: 'sin_abrir', detalle: { abre: '2026-11-13T19:00' } });
    expect(ver.json().error.mensaje).toMatch(/viernes 13 nov · 7:00 p\. m\./);
    expect((await app.inject({ method: 'GET', url: `/api/public/sorteos/${s.id}/ocupados` })).statusCode).toBe(404);
    expect((await apartar(s.id, [1])).json().error.codigo).toBe('sin_abrir');

    ahora = new Date('2026-11-14T00:00:00Z'); // 19:00 en Bogotá
    expect(await lista()).toEqual([s.id]);
    const abierto = await app.inject({ method: 'GET', url: `/api/public/sorteos/${s.id}` });
    expect(abierto.statusCode).toBe(200);
    expect(abierto.json()).not.toHaveProperty('abre');
    expect(abierto.json()).not.toHaveProperty('lista_encabezado');
    expect((await apartar(s.id, [1])).statusCode).toBe(201);
  });
});

describe('reiniciar el sorteo para un nuevo día', () => {
  it('guarda el día en el historial, conserva los fijos por pagar y cambia fecha y apertura', async () => {
    const { repos, admin, apartar, db } = await preparar();
    const s = await repos.sorteos.guardar(sorteoBase());
    await repos.reservas.apartar(s.id, [1, 2], { telefono: '3001112233', nombre: 'Fijo' }, 'fijo');
    await repos.reservas.marcarPago(s.id, '3001112233', true);
    expect((await apartar(s.id, [40, 41])).statusCode).toBe(201);
    await repos.reservas.liberar(s.id, '3001234567', [41]);

    const r = await admin('POST', `/sorteos/${s.id}/reiniciar`, { fecha: '2026-11-09', abre: '2026-11-09T07:00' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      archivadas: 3,
      conservados: 2,
      sorteo: { fecha: '2026-11-09', abre: '2026-11-09T07:00' },
    });

    const quedan = await repos.reservas.porSorteo(s.id);
    expect(quedan.map((x) => [x.numero, x.tipo, x.pagado])).toEqual([
      [1, 'fijo', false],
      [2, 'fijo', false],
    ]);
    expect(await repos.reservas.liberados(s.id)).toEqual([]);
    const cierre = db.prepare('SELECT nombre, fecha, reservas FROM cierres WHERE sorteo_id = ?').get(s.id) as {
      nombre: string;
      fecha: string;
      reservas: string;
    };
    expect(cierre).toMatchObject({ nombre: 'Paisita Día', fecha: '2026-11-08' });
    expect(JSON.parse(cierre.reservas).map((x: { numero: number }) => x.numero)).toEqual([1, 2, 40]);
  });

  it('sin conservar fijos deja el tablero vacío; valida la fecha y el sorteo', async () => {
    const { repos, admin } = await preparar();
    const s = await repos.sorteos.guardar(sorteoBase());
    await repos.reservas.apartar(s.id, [1], { telefono: '3001112233', nombre: 'Fijo' }, 'fijo');
    const r = await admin('POST', `/sorteos/${s.id}/reiniciar`, { fecha: '2026-11-09', conservar_fijos: false });
    expect(r.json()).toMatchObject({ archivadas: 1, conservados: 0, sorteo: { abre: null } });
    expect(await repos.reservas.ocupados(s.id)).toEqual([]);
    expect((await admin('POST', `/sorteos/${s.id}/reiniciar`, { fecha: 'mañana' })).statusCode).toBe(422);
    expect((await admin('POST', '/sorteos/nada/reiniciar', { fecha: '2026-11-09' })).statusCode).toBe(404);
  });
});

describe('premios de la ruleta por símbolo', () => {
  it('cada trío paga el premio de su símbolo; sin premio propio usa el general', async () => {
    const { admin, app, repos } = await preparar({ azar: () => 0 });
    const g = await admin('PUT', '/ruleta', {
      activo: true,
      prob_tres: 100,
      premio_tres: 'Un número gratis',
      prob_dos: 0,
      premio_dos: '$1.000',
      premios_tres: { trebol: ' $20.000 ', moneda: '', siete: 'Boleta doble' },
    });
    expect(g.statusCode).toBe(200);
    expect((await repos.ruleta.config()).premios_tres).toEqual({ trebol: '$20.000', siete: 'Boleta doble' });

    const cfg = (await app.inject({ method: 'GET', url: '/api/public/config' })).json();
    expect(cfg.ruleta.premios_tres).toEqual({ trebol: '$20.000', siete: 'Boleta doble' });

    const r = (
      await app.inject({ method: 'POST', url: '/api/public/ruleta/giro', payload: { telefono: '3001234567' } })
    ).json();
    expect(r.gano).toBe(3);
    const esperado = { trebol: '$20.000', siete: 'Boleta doble' }[r.resultado[0] as string] ?? 'Un número gratis';
    expect(r.premio).toBe(esperado);
  });

  it('un valor guardado dañado no rompe la configuración', async () => {
    const { db } = await preparar();
    db.exec(`UPDATE config_ruleta SET premios_tres = 'no es json' WHERE id = 1`);
    expect((await reposSqlite(db).ruleta.config()).premios_tres).toEqual({});
  });
});

describe('diseño: tamaño y posición de la ruleta', () => {
  it('se guarda desde el panel y llega al sitio público; fuera de rango se rechaza', async () => {
    const { admin, app } = await preparar();
    const actual = (await admin('GET', '/diseno')).json();
    const nuevo = {
      ...actual,
      ruleta: {
        ...actual.ruleta,
        disposicion: { ...actual.ruleta.disposicion, maquina: { escala: 150, x: 0, y: -5 } },
      },
    };
    const r = await admin('PUT', '/diseno', nuevo);
    expect(r.statusCode).toBe(200);
    expect(r.json().ruleta.disposicion.maquina).toEqual({ escala: 150, x: 0, y: -5 });
    const pub = (await app.inject({ method: 'GET', url: '/api/public/config' })).json();
    expect(pub.diseno.ruleta.disposicion.maquina).toEqual({ escala: 150, x: 0, y: -5 });
    const malo = await admin('PUT', '/diseno', {
      ...nuevo,
      ruleta: { ...nuevo.ruleta, disposicion: { boton: { escala: 999 } } },
    });
    expect(malo.statusCode).toBe(422);
  });
});

describe('premio Unido (primera y última cifra)', () => {
  it('es opcional: por defecto no existe, se activa por sorteo y llega a la página pública', async () => {
    const { admin, app } = await preparar();
    const sin = (await admin('POST', '/sorteos', { ...sorteoBase({ nombre: 'Sin unido' }) })).json().sorteo;
    expect(sin.premio_unido).toBe(0);

    const con = await admin('POST', '/sorteos', { ...sorteoBase({ nombre: 'Con unido', premio_unido: 50000 }) });
    expect(con.statusCode).toBe(201);
    const id = con.json().sorteo.id;
    const pub = (await app.inject({ method: 'GET', url: `/api/public/sorteos/${id}` })).json();
    expect(pub.premio_unido).toBe(50000);

    // Desactivarlo es dejarlo en 0; negativo no se acepta.
    expect((await admin('PUT', `/sorteos/${id}`, { premio_unido: 0 })).json().sorteo.premio_unido).toBe(0);
    expect((await admin('PUT', `/sorteos/${id}`, { premio_unido: -5 })).statusCode).toBe(422);
  });

  it('la migración 6 agrega el premio en 0 a los sorteos que ya existían', () => {
    const ruta = join(mkdtempSync(join(tmpdir(), 'pato-mig6-')), 'pato.db');
    const vieja = new DatabaseSync(ruta);
    for (const m of MIGRACIONES.slice(0, 5)) {
      if (typeof m === 'string') vieja.exec(m);
      else {
        vieja.exec('PRAGMA foreign_keys = OFF');
        vieja.exec(m.sql);
        vieja.exec('PRAGMA foreign_keys = ON');
      }
    }
    vieja.exec('PRAGMA user_version = 5');
    vieja.exec(`INSERT INTO sorteos (id, nombre, valor_boleta, creado) VALUES ('s1', 'Paisita', 5000, 'x')`);
    vieja.close();
    const db = abrirDb(ruta);
    expect(db.prepare('SELECT premio_unido FROM sorteos').get()).toEqual({ premio_unido: 0 });
    expect(() => db.exec(`UPDATE sorteos SET premio_unido = -1`)).toThrow(/CHECK/);
    db.close();
  });
});
