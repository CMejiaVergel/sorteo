import { randomUUID } from 'node:crypto';
import { disenoBase, esquemaDiseno } from '@pato/shared/esquemas';
import {
  PLANTILLA_BASE,
  type AlertaSeguridad,
  type Contacto,
  type DispositivoResumen,
  type Giro,
  type IntentoReserva,
  type Liberado,
  type Reserva,
  type Sorteo,
  type SorteoAdmin,
  type SorteoMisNumeros,
  type SorteoResumen,
} from '@pato/shared';
import { esUnicidad, transaccion, type Db } from '../db/conexion.ts';
import { describirAgente } from '../servicios/agente.ts';
import { CelularDeOtro, LimiteDispositivo, NumerosOcupados, UsuarioRepetido, YaGiro, type Admin, type Repos } from './tipos.ts';

type Fila = Record<string, unknown>;
const ahoraIso = () => new Date().toISOString();
/** Condición opcional "AND numero IN (...)" con parámetros. */
const filtroNumeros = (numeros?: number[]) =>
  numeros ? { sql: ` AND numero IN (${numeros.map(() => '?').join(',') || 'NULL'})`, args: numeros } : { sql: '', args: [] as number[] };

const aSorteo = (f: Fila): Sorteo => ({
  id: String(f.id),
  nombre: String(f.nombre),
  loteria: String(f.loteria),
  jornada: f.jornada === 'noche' ? 'noche' : 'dia',
  fecha: (f.fecha as string | null) ?? null,
  hora: String(f.hora),
  orden: Number(f.orden),
  color: String(f.color),
  etiqueta: String(f.etiqueta),
  activo: Number(f.activo) === 1,
  valor_boleta: Number(f.valor_boleta),
  premio_total: Number(f.premio_total),
  premio_ultimas: Number(f.premio_ultimas),
  premio_primeras: Number(f.premio_primeras),
  premio_medio: Number(f.premio_medio),
  nequi: String(f.nequi),
  nequi_titular: String(f.nequi_titular),
  imagen: String(f.imagen),
  logo_loteria: String(f.logo_loteria),
  logo_ocupado: String(f.logo_ocupado),
  fondo_imagen: String(f.fondo_imagen),
  creado: String(f.creado),
});

const aReserva = (f: Fila): Reserva => ({
  id: String(f.id),
  sorteo_id: String(f.sorteo_id),
  numero: Number(f.numero),
  telefono: String(f.telefono),
  nombre: String(f.nombre),
  tipo: f.tipo === 'fijo' ? 'fijo' : 'cliente',
  pagado: Number(f.pagado) === 1,
  creado: String(f.creado),
});

const aGiro = (f: Fila): Giro => ({
  id: String(f.id),
  telefono: String(f.telefono),
  fecha: String(f.fecha),
  resultado: JSON.parse(String(f.resultado)),
  gano: Number(f.gano) as 0 | 2 | 3,
  premio: String(f.premio),
  reclamado: Number(f.reclamado) === 1,
  creado: String(f.creado),
  ...(f.nombre != null ? { nombre: String(f.nombre) } : {}),
});

const aAdmin = (f: Fila): Admin => ({
  id: String(f.id),
  usuario: String(f.usuario),
  clave_hash: String(f.clave_hash),
  activo: Number(f.activo) === 1,
  creado: String(f.creado),
  ultimo_ingreso: (f.ultimo_ingreso as string | null) ?? null,
});

const ORDEN = 'ORDER BY s.orden, s.fecha, s.creado';
const CAMPOS_SORTEO = [
  'nombre', 'loteria', 'jornada', 'fecha', 'hora', 'orden', 'color', 'etiqueta', 'activo', 'valor_boleta',
  'premio_total', 'premio_ultimas', 'premio_primeras', 'premio_medio', 'nequi', 'nequi_titular',
  'imagen', 'logo_loteria', 'logo_ocupado', 'fondo_imagen',
] as const;

/** Implementación de los repositorios sobre SQLite (node:sqlite). */
export function reposSqlite(db: Db): Repos {
  const q = (sql: string) => db.prepare(sql);

  return {
    sorteos: {
      async listarActivos() {
        const filas = q(
          `SELECT s.*, 100 - (SELECT count(*) FROM reservas r WHERE r.sorteo_id = s.id) AS libres
           FROM sorteos s WHERE s.activo = 1 ${ORDEN}`,
        ).all() as Fila[];
        return filas.map((f): SorteoResumen => {
          const s = aSorteo(f);
          return {
            id: s.id, nombre: s.nombre, loteria: s.loteria, jornada: s.jornada, fecha: s.fecha, hora: s.hora,
            valor_boleta: s.valor_boleta, premio_total: s.premio_total, color: s.color, etiqueta: s.etiqueta,
            orden: s.orden, imagen: s.imagen, libres: Number(f.libres),
          };
        });
      },
      async listarTodos() {
        const filas = q(
          `SELECT s.*, (SELECT count(*) FROM reservas r WHERE r.sorteo_id = s.id) AS ocupados FROM sorteos s ${ORDEN}`,
        ).all() as Fila[];
        return filas.map((f): SorteoAdmin => ({ ...aSorteo(f), ocupados: Number(f.ocupados) }));
      },
      async obtener(id) {
        const f = q('SELECT * FROM sorteos WHERE id = ?').get(id) as Fila | undefined;
        return f ? aSorteo(f) : null;
      },
      async guardar(d, id) {
        const valores = CAMPOS_SORTEO.map((k) => {
          const v = d[k];
          return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
        });
        if (id) {
          q(`UPDATE sorteos SET ${CAMPOS_SORTEO.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...valores, id);
        } else {
          id = randomUUID();
          q(
            `INSERT INTO sorteos (id, ${CAMPOS_SORTEO.join(', ')}, creado) VALUES (?, ${CAMPOS_SORTEO.map(() => '?').join(', ')}, ?)`,
          ).run(id, ...valores, ahoraIso());
        }
        return aSorteo(q('SELECT * FROM sorteos WHERE id = ?').get(id) as Fila);
      },
      async eliminar(id) {
        return Number(q('DELETE FROM sorteos WHERE id = ?').run(id).changes) > 0;
      },
      async imagenesEnUso() {
        const filas = q('SELECT imagen, logo_loteria, logo_ocupado, fondo_imagen FROM sorteos').all() as Fila[];
        return filas.flatMap((f) => Object.values(f).map(String)).filter(Boolean);
      },
    },

    reservas: {
      async ocupados(sorteoId) {
        return (q('SELECT numero FROM reservas WHERE sorteo_id = ? ORDER BY numero').all(sorteoId) as Fila[]).map((f) =>
          Number(f.numero),
        );
      },
      async porSorteo(sorteoId) {
        return (q('SELECT * FROM reservas WHERE sorteo_id = ? ORDER BY numero').all(sorteoId) as Fila[]).map(aReserva);
      },
      async apartar(sorteoId, numeros, persona, tipo, origen) {
        const ins = q(
          'INSERT INTO reservas (id, sorteo_id, numero, telefono, nombre, tipo, pagado, creado, dispositivo_id, ip) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
        );
        try {
          transaccion(db, () => {
            if (origen?.max) {
              const f = q('SELECT count(*) AS n FROM reservas WHERE sorteo_id = ? AND dispositivo_id = ?').get(sorteoId, origen.dispositivo) as Fila;
              if (Number(f.n) + numeros.length > origen.max) throw new LimiteDispositivo(Number(f.n));
            }
            const creado = ahoraIso();
            for (const n of numeros)
              ins.run(randomUUID(), sorteoId, n, persona.telefono, persona.nombre, tipo, creado, origen?.dispositivo ?? null, origen?.ip ?? '');
          });
        } catch (e) {
          if (!esUnicidad(e)) throw e;
          // La restricción hizo fallar la transacción: informar cuáles estaban ocupados.
          const ocupados = new Set(await this.ocupados(sorteoId));
          throw new NumerosOcupados(numeros.filter((n) => ocupados.has(n)));
        }
      },
      async marcarPago(sorteoId, telefono, pagado, numeros) {
        const { sql, args } = filtroNumeros(numeros);
        return Number(
          q(`UPDATE reservas SET pagado = ? WHERE sorteo_id = ? AND telefono = ?${sql}`).run(pagado ? 1 : 0, sorteoId, telefono, ...args).changes,
        );
      },
      async liberar(sorteoId, telefono, numeros, ahora = ahoraIso()) {
        const { sql, args } = filtroNumeros(numeros);
        let n = 0;
        transaccion(db, () => {
          q(
            `INSERT INTO liberados (id, sorteo_id, numero, telefono, nombre, tipo, pagado, liberado)
             SELECT lower(hex(randomblob(16))), sorteo_id, numero, telefono, nombre, tipo, pagado, ? FROM reservas
             WHERE sorteo_id = ? AND telefono = ?${sql}`,
          ).run(ahora, sorteoId, telefono, ...args);
          n = Number(q(`DELETE FROM reservas WHERE sorteo_id = ? AND telefono = ?${sql}`).run(sorteoId, telefono, ...args).changes);
        });
        return n;
      },
      async liberados(sorteoId) {
        return (q('SELECT * FROM liberados WHERE sorteo_id = ? ORDER BY liberado DESC, numero').all(sorteoId) as Fila[]).map(
          (f): Liberado => ({
            id: String(f.id),
            sorteo_id: String(f.sorteo_id),
            numero: Number(f.numero),
            telefono: String(f.telefono),
            nombre: String(f.nombre),
            tipo: f.tipo === 'fijo' ? 'fijo' : 'cliente',
            pagado: Number(f.pagado) === 1,
            liberado: String(f.liberado),
          }),
        );
      },
      async borrarLiberados(sorteoId) {
        return Number(q('DELETE FROM liberados WHERE sorteo_id = ?').run(sorteoId).changes);
      },
      async porTelefono(telefono, desde) {
        const filas = q(
          `SELECT s.*, r.numero, r.pagado AS r_pagado FROM reservas r JOIN sorteos s ON s.id = r.sorteo_id
           WHERE r.telefono = ? AND (s.activo = 1 OR (s.fecha IS NOT NULL AND s.fecha >= ?))
           ORDER BY r.numero`,
        ).all(telefono, desde) as Fila[];
        const por = new Map<string, SorteoMisNumeros>();
        for (const f of filas) {
          const s = aSorteo(f);
          let g = por.get(s.id);
          if (!g) {
            g = {
              id: s.id, nombre: s.nombre, fecha: s.fecha, hora: s.hora, jornada: s.jornada, valor_boleta: s.valor_boleta,
              nequi: s.nequi, nequi_titular: s.nequi_titular, color: s.color, imagen: s.imagen, numeros: [], pagados: [],
            };
            por.set(s.id, g);
          }
          g.numeros.push(Number(f.numero));
          if (Number(f.r_pagado) === 1) g.pagados.push(Number(f.numero));
        }
        return [...por.values()].sort(
          (a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) || a.nombre.localeCompare(b.nombre),
        );
      },
    },

    contactos: {
      async buscar(telefono) {
        return (q('SELECT telefono, nombre, creado FROM contactos WHERE telefono = ?').get(telefono) as Contacto | undefined) ?? null;
      },
      async buscarPorNombre(nombre) {
        return (
          (q('SELECT telefono, nombre, creado FROM contactos WHERE lower(trim(nombre)) = lower(trim(?)) LIMIT 1').get(nombre) as
            | Contacto
            | undefined) ?? null
        );
      },
      async listar(texto) {
        const t = (texto ?? '').trim().toLowerCase();
        const d = t.replace(/\D/g, '');
        if (!t) return q('SELECT telefono, nombre, creado FROM contactos ORDER BY nombre COLLATE NOCASE LIMIT 300').all() as unknown as Contacto[];
        return q(
          `SELECT telefono, nombre, creado FROM contactos
           WHERE lower(nombre) LIKE ? OR (? <> '' AND telefono LIKE ?) ORDER BY nombre COLLATE NOCASE LIMIT 300`,
        ).all(`%${t}%`, d, `%${d}%`) as unknown as Contacto[];
      },
      async crearSiNoExiste(c) {
        q('INSERT INTO contactos (telefono, nombre, creado) VALUES (?, ?, ?) ON CONFLICT(telefono) DO NOTHING').run(
          c.telefono,
          c.nombre,
          ahoraIso(),
        );
        return q('SELECT telefono, nombre, creado FROM contactos WHERE telefono = ?').get(c.telefono) as unknown as Contacto;
      },
      async guardar(lista) {
        const st = q(
          'INSERT INTO contactos (telefono, nombre, creado) VALUES (?, ?, ?) ON CONFLICT(telefono) DO UPDATE SET nombre = excluded.nombre',
        );
        transaccion(db, () => {
          const creado = ahoraIso();
          for (const c of lista) st.run(c.telefono, c.nombre, creado);
        });
      },
      async eliminar(telefono) {
        return Number(q('DELETE FROM contactos WHERE telefono = ?').run(telefono).changes) > 0;
      },
      async editar(antes, c) {
        if (!q('SELECT 1 FROM contactos WHERE telefono = ?').get(antes)) return false;
        if (c.telefono !== antes) {
          const otro = q('SELECT telefono, nombre FROM contactos WHERE telefono = ?').get(c.telefono) as Contacto | undefined;
          if (otro) throw new CelularDeOtro(otro);
        }
        transaccion(db, () => {
          q('UPDATE contactos SET telefono = ?, nombre = ? WHERE telefono = ?').run(c.telefono, c.nombre, antes);
          q('UPDATE reservas SET telefono = ?, nombre = ? WHERE telefono = ?').run(c.telefono, c.nombre, antes);
        });
        return true;
      },
    },

    ruleta: {
      async config() {
        const f = q('SELECT * FROM config_ruleta WHERE id = 1').get() as Fila;
        return {
          activo: Number(f.activo) === 1,
          prob_tres: Number(f.prob_tres),
          premio_tres: String(f.premio_tres),
          prob_dos: Number(f.prob_dos),
          premio_dos: String(f.premio_dos),
        };
      },
      async guardarConfig(c) {
        q('UPDATE config_ruleta SET activo = ?, prob_tres = ?, premio_tres = ?, prob_dos = ?, premio_dos = ? WHERE id = 1').run(
          c.activo ? 1 : 0, c.prob_tres, c.premio_tres, c.prob_dos, c.premio_dos,
        );
      },
      async giroDe(telefono, fecha) {
        const f = q('SELECT * FROM giros WHERE telefono = ? AND fecha = ?').get(telefono, fecha) as Fila | undefined;
        return f ? aGiro(f) : null;
      },
      async registrar(g) {
        const nuevo: Giro = { ...g, id: randomUUID(), reclamado: false, creado: ahoraIso() };
        try {
          q('INSERT INTO giros (id, telefono, fecha, resultado, gano, premio, reclamado, creado) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').run(
            nuevo.id, nuevo.telefono, nuevo.fecha, JSON.stringify(nuevo.resultado), nuevo.gano, nuevo.premio, nuevo.creado,
          );
        } catch (e) {
          if (esUnicidad(e)) throw new YaGiro();
          throw e;
        }
        return nuevo;
      },
      async ganadores() {
        return (
          q(
            `SELECT g.*, c.nombre FROM giros g LEFT JOIN contactos c ON c.telefono = g.telefono
             WHERE g.gano > 0 ORDER BY g.creado DESC LIMIT 500`,
          ).all() as Fila[]
        ).map(aGiro);
      },
      async total() {
        return Number((q('SELECT count(*) AS n FROM giros').get() as Fila).n);
      },
      async marcarReclamado(id, reclamado) {
        return Number(q('UPDATE giros SET reclamado = ? WHERE id = ?').run(reclamado ? 1 : 0, id).changes) > 0;
      },
      async reiniciarTodos(fecha, ahora) {
        const n = Number(q('DELETE FROM giros WHERE fecha = ?').run(fecha).changes);
        q('UPDATE config_ruleta SET reinicio = ? WHERE id = 1').run(ahora);
        return n;
      },
      async marcaReinicio() {
        return String((q('SELECT reinicio FROM config_ruleta WHERE id = 1').get() as Fila).reinicio ?? '');
      },
      async reiniciar(telefono, fecha) {
        return Number(q('DELETE FROM giros WHERE telefono = ? AND fecha = ?').run(telefono, fecha).changes) > 0;
      },
    },

    ajustes: {
      async obtener() {
        const f = q('SELECT * FROM ajustes WHERE id = 1').get() as Fila;
        let diseno = disenoBase();
        try {
          diseno = esquemaDiseno.parse(JSON.parse(String(f.diseno || '{}')));
        } catch {
          /* documento dañado: se usa la proforma base */
        }
        return {
          negocio: String(f.negocio),
          whatsapp: String(f.whatsapp),
          plantilla: String(f.plantilla) || PLANTILLA_BASE,
          plantilla_ticket: String(f.plantilla_ticket ?? ''),
          diseno,
        };
      },
      async guardar(a) {
        const act = await this.obtener();
        const n = { ...act, ...a };
        q('UPDATE ajustes SET negocio = ?, whatsapp = ?, plantilla = ?, plantilla_ticket = ?, diseno = ? WHERE id = 1').run(
          n.negocio, n.whatsapp, n.plantilla, n.plantilla_ticket, JSON.stringify(n.diseno),
        );
      },
    },

    admins: {
      async porUsuario(usuario) {
        const f = q('SELECT * FROM admins WHERE usuario = ?').get(usuario) as Fila | undefined;
        return f ? aAdmin(f) : null;
      },
      async porId(id) {
        const f = q('SELECT * FROM admins WHERE id = ?').get(id) as Fila | undefined;
        return f ? aAdmin(f) : null;
      },
      async crear(usuario, claveHash) {
        const id = randomUUID();
        try {
          q('INSERT INTO admins (id, usuario, clave_hash, activo, creado) VALUES (?, ?, ?, 1, ?)').run(id, usuario, claveHash, ahoraIso());
        } catch (e) {
          if (esUnicidad(e)) throw new UsuarioRepetido();
          throw e;
        }
        return aAdmin(q('SELECT * FROM admins WHERE id = ?').get(id) as Fila);
      },
      async cambiarClave(usuario, claveHash) {
        return Number(q('UPDATE admins SET clave_hash = ? WHERE usuario = ?').run(claveHash, usuario).changes) > 0;
      },
      async activar(usuario, activo) {
        return Number(q('UPDATE admins SET activo = ? WHERE usuario = ?').run(activo ? 1 : 0, usuario).changes) > 0;
      },
      async marcarIngreso(id) {
        q('UPDATE admins SET ultimo_ingreso = ? WHERE id = ?').run(ahoraIso(), id);
      },
      async listar() {
        return (q('SELECT * FROM admins ORDER BY usuario').all() as Fila[]).map(aAdmin);
      },
    },

    sesiones: {
      async crear(s) {
        q('INSERT INTO sesiones (id, admin_id, creada, ultimo_uso, expira, ip, agente) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          s.id, s.admin_id, s.creada, s.ultimo_uso, s.expira, s.ip, s.agente.slice(0, 300),
        );
      },
      async obtener(id) {
        return (q('SELECT id, admin_id, creada, ultimo_uso, expira FROM sesiones WHERE id = ?').get(id) as
          | { id: string; admin_id: string; creada: string; ultimo_uso: string; expira: string }
          | undefined) ?? null;
      },
      async tocar(id, ahora) {
        q('UPDATE sesiones SET ultimo_uso = ? WHERE id = ?').run(ahora, id);
      },
      async eliminar(id) {
        q('DELETE FROM sesiones WHERE id = ?').run(id);
      },
      async eliminarDeAdmin(adminId) {
        return Number(q('DELETE FROM sesiones WHERE admin_id = ?').run(adminId).changes);
      },
    },

    medios: {
      async registrar(m) {
        q('INSERT INTO medios (id, ruta, uso, ancho, alto, peso, creado) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          m.id, m.ruta, m.uso, m.ancho, m.alto, m.peso, ahoraIso(),
        );
      },
      async existe(ruta) {
        return !!q('SELECT 1 FROM medios WHERE ruta = ?').get(ruta);
      },
      async eliminar(ruta) {
        q('DELETE FROM medios WHERE ruta = ?').run(ruta);
      },
    },

    seguridad: {
      async tocar(d) {
        const ahora = ahoraIso();
        q(
          `INSERT INTO dispositivos (id, ip, agente, creado, visto) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET ip = excluded.ip, agente = excluded.agente, visto = excluded.visto`,
        ).run(d.id, d.ip, d.agente.slice(0, 300), ahora, ahora);
        const f = q('SELECT bloqueado FROM dispositivos WHERE id = ?').get(d.id) as Fila;
        return { bloqueado: Number(f.bloqueado) === 1 };
      },
      async limite() {
        return Number((q('SELECT limite_dispositivo AS n FROM ajustes WHERE id = 1').get() as Fila).n);
      },
      async guardarLimite(n) {
        q('UPDATE ajustes SET limite_dispositivo = ? WHERE id = 1').run(n);
      },
      async usoDispositivo(sorteoId, dispositivo) {
        const f = q(
          'SELECT count(*) AS n, count(DISTINCT telefono) AS c FROM reservas WHERE sorteo_id = ? AND dispositivo_id = ?',
        ).get(sorteoId, dispositivo) as Fila;
        return { numeros: Number(f.n), celulares: Number(f.c) };
      },
      async usoRed(sorteoId, ip) {
        const f = q(
          "SELECT count(*) AS n, count(DISTINCT dispositivo_id) AS d FROM reservas WHERE sorteo_id = ? AND ip = ? AND ip <> ''",
        ).get(sorteoId, ip) as Fila;
        return { numeros: Number(f.n), dispositivos: Number(f.d) };
      },
      async registrarIntento(i) {
        q(
          'INSERT INTO intentos (id, dispositivo_id, ip, sorteo_id, telefono, nombre, numeros, resultado, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(randomUUID(), i.dispositivo_id, i.ip, i.sorteo_id, i.telefono, i.nombre.slice(0, 60), JSON.stringify(i.numeros), i.resultado, ahoraIso());
      },
      async alertar(a) {
        const ahora = ahoraIso();
        const previa = q(
          'SELECT id FROM alertas WHERE vista = 0 AND tipo = ? AND dispositivo_id = ? AND sorteo_id = ? AND ip = ?',
        ).get(a.tipo, a.dispositivo_id, a.sorteo_id, a.ip) as Fila | undefined;
        if (previa) q('UPDATE alertas SET detalle = ?, veces = veces + 1, creado = ? WHERE id = ?').run(a.detalle, ahora, String(previa.id));
        else
          q('INSERT INTO alertas (id, tipo, dispositivo_id, ip, sorteo_id, detalle, creado) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            randomUUID(), a.tipo, a.dispositivo_id, a.ip, a.sorteo_id, a.detalle, ahora,
          );
      },
      async alertas(limite = 50) {
        return (
          q(
            `SELECT a.*, coalesce(s.nombre, '') AS sorteo FROM alertas a LEFT JOIN sorteos s ON s.id = a.sorteo_id
             ORDER BY a.vista, a.creado DESC LIMIT ?`,
          ).all(limite) as Fila[]
        ).map(
          (f): AlertaSeguridad => ({
            id: String(f.id),
            tipo: String(f.tipo),
            dispositivo_id: String(f.dispositivo_id),
            ip: String(f.ip),
            sorteo_id: String(f.sorteo_id),
            sorteo: String(f.sorteo),
            detalle: String(f.detalle),
            veces: Number(f.veces),
            vista: Number(f.vista) === 1,
            creado: String(f.creado),
          }),
        );
      },
      async pendientes() {
        return Number((q('SELECT count(*) AS n FROM alertas WHERE vista = 0').get() as Fila).n);
      },
      async marcarVistas() {
        return Number(q('UPDATE alertas SET vista = 1 WHERE vista = 0').run().changes);
      },
      async dispositivos(busqueda) {
        const desde = new Date(Date.now() - 14 * 864e5).toISOString();
        const ids = (
          q(
            `SELECT id FROM (
               SELECT dispositivo_id AS id FROM reservas WHERE dispositivo_id IS NOT NULL
               UNION SELECT dispositivo_id FROM intentos WHERE creado >= ?
               UNION SELECT id FROM dispositivos WHERE bloqueado = 1)`,
          ).all(desde) as Fila[]
        ).map((f) => String(f.id));
        const lista: DispositivoResumen[] = [];
        for (const id of ids) {
          const d = q('SELECT * FROM dispositivos WHERE id = ?').get(id) as Fila | undefined;
          if (!d) continue;
          const res = q(
            `SELECT r.sorteo_id, s.nombre AS sorteo, r.numero, r.pagado, r.telefono, r.nombre FROM reservas r
             JOIN sorteos s ON s.id = r.sorteo_id WHERE r.dispositivo_id = ? ORDER BY s.orden, r.numero`,
          ).all(id) as Fila[];
          const ints = q('SELECT telefono, nombre, resultado FROM intentos WHERE dispositivo_id = ?').all(id) as Fila[];
          const personas = new Map<string, string>();
          for (const r of [...res, ...ints]) if (r.telefono) personas.set(String(r.telefono), String(r.nombre));
          const porSorteo = new Map<string, DispositivoResumen['sorteos'][number]>();
          for (const r of res) {
            const k = String(r.sorteo_id);
            const g = porSorteo.get(k) ?? { sorteo_id: k, nombre: String(r.sorteo), numeros: [], pagados: 0 };
            g.numeros.push(Number(r.numero));
            if (Number(r.pagado) === 1) g.pagados++;
            porSorteo.set(k, g);
          }
          lista.push({
            id,
            descripcion: describirAgente(String(d.agente)),
            agente: String(d.agente),
            ip: String(d.ip),
            creado: String(d.creado),
            visto: String(d.visto),
            bloqueado: Number(d.bloqueado) === 1,
            bloqueado_en: (d.bloqueado_en as string | null) ?? null,
            motivo: String(d.motivo),
            apartados: res.length,
            rechazados: ints.filter((i) => i.resultado === 'limite' || i.resultado === 'bloqueado').length,
            personas: [...personas].map(([telefono, nombre]) => ({ telefono, nombre })),
            sorteos: [...porSorteo.values()],
          });
        }
        const t = (busqueda ?? '').trim().toLowerCase();
        const digitos = t.replace(/\D/g, '');
        return lista
          .filter(
            (d) =>
              !t ||
              d.id.toLowerCase().startsWith(t) ||
              d.ip.includes(t) ||
              d.descripcion.toLowerCase().includes(t) ||
              d.personas.some((p) => p.nombre.toLowerCase().includes(t) || (digitos.length >= 3 && p.telefono.includes(digitos))),
          )
          .sort(
            (a, b) =>
              Number(b.bloqueado) - Number(a.bloqueado) || b.apartados - a.apartados || b.rechazados - a.rechazados || b.visto.localeCompare(a.visto),
          )
          .slice(0, 300);
      },
      async intentos(dispositivo, limite = 50) {
        return (
          q(
            `SELECT i.*, coalesce(s.nombre, '') AS sorteo FROM intentos i LEFT JOIN sorteos s ON s.id = i.sorteo_id
             WHERE i.dispositivo_id = ? ORDER BY i.creado DESC LIMIT ?`,
          ).all(dispositivo, limite) as Fila[]
        ).map(
          (f): IntentoReserva => ({
            id: String(f.id),
            dispositivo_id: String(f.dispositivo_id),
            ip: String(f.ip),
            sorteo_id: String(f.sorteo_id),
            sorteo: String(f.sorteo),
            telefono: String(f.telefono),
            nombre: String(f.nombre),
            numeros: JSON.parse(String(f.numeros)),
            resultado: String(f.resultado),
            creado: String(f.creado),
          }),
        );
      },
      async bloquear(id, bloqueado, motivo = '') {
        const r = q('UPDATE dispositivos SET bloqueado = ?, bloqueado_en = ?, motivo = ? WHERE id = ?').run(
          bloqueado ? 1 : 0,
          bloqueado ? ahoraIso() : null,
          bloqueado ? motivo.slice(0, 200) : '',
          id,
        );
        return Number(r.changes) > 0;
      },
      async liberarDeDispositivo(id) {
        let liberados = 0;
        let sorteos: string[] = [];
        transaccion(db, () => {
          sorteos = (q('SELECT DISTINCT sorteo_id FROM reservas WHERE dispositivo_id = ? AND pagado = 0').all(id) as Fila[]).map((f) =>
            String(f.sorteo_id),
          );
          q(
            `INSERT INTO liberados (id, sorteo_id, numero, telefono, nombre, tipo, pagado, liberado)
             SELECT lower(hex(randomblob(16))), sorteo_id, numero, telefono, nombre, tipo, pagado, ? FROM reservas
             WHERE dispositivo_id = ? AND pagado = 0`,
          ).run(ahoraIso(), id);
          liberados = Number(q('DELETE FROM reservas WHERE dispositivo_id = ? AND pagado = 0').run(id).changes);
        });
        return { liberados, sorteos };
      },
    },

    auditoria: {
      async anotar(a) {
        q('INSERT INTO auditoria (id, admin_id, accion, entidad, entidad_id, detalle, ip, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          randomUUID(), a.admin_id ?? null, a.accion, a.entidad ?? '', a.entidad_id ?? '', a.detalle ?? '', a.ip ?? '', ahoraIso(),
        );
      },
    },
  };
}
