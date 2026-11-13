/**
 * Semilla de DESARROLLO: sorteos de muestra del prototipo, reservas y contactos ficticios,
 * y el administrador de pruebas definido en .env (SEMILLA_ADMIN_USUARIO / SEMILLA_ADMIN_CLAVE).
 * No se usa en producción.
 */
import { diaSemana, hoyBogota, PLANTILLA_BASE, sumarDias, type SorteoEntrada } from '@pato/shared';
import { cifrarClave, LARGO_MINIMO_CLAVE } from './auth/claves.ts';
import { cargarConfig } from './config.ts';
import { abrirDb } from './db/conexion.ts';
import { reposSqlite } from './repositorios/sqlite.ts';
import { DIR_RECURSOS, instalarRecursos } from './recursos.ts';
import { existsSync } from 'node:fs';

const config = cargarConfig();
if (config.produccion) {
  console.error('La semilla solo se usa en desarrollo.');
  process.exit(1);
}
const db = abrirDb(config.rutaDb);
const repos = reposSqlite(db);

const hoy = hoyBogota(new Date(), config.TZ_NEGOCIO);
const proximo = (wd: number) => sumarDias(hoy, (wd - diaSemana(hoy) + 7) % 7);

const S = (
  nombre: string,
  jornada: 'dia' | 'noche',
  hora: string,
  valor: number,
  color: string,
  orden: number,
  extra: Partial<SorteoEntrada> = {},
): SorteoEntrada => ({
  nombre,
  loteria: nombre,
  jornada,
  fecha: hoy,
  hora,
  orden,
  color,
  etiqueta: '',
  activo: true,
  valor_boleta: valor,
  premio_total: valor * 70,
  premio_ultimas: valor * 50,
  premio_primeras: valor * 10,
  premio_medio: valor * 10,
  nequi: '3001234567',
  nequi_titular: 'Nombre de ejemplo',
  imagen: '',
  logo_loteria: '',
  logo_ocupado: '',
  fondo_imagen: '',
  gratis: false,
  max_por_celular: 0,
  abre: null,
  imagen_agotado: '',
  lista_encabezado: '',
  lista_pie: '',
  ...extra,
});

const yaHay = (await repos.sorteos.listarTodos()).length > 0;
if (yaHay) {
  console.log('Ya hay sorteos en la base; no se cargan datos de ejemplo.');
} else {
  const caribena = await repos.sorteos.guardar(S('Caribeña Día', 'dia', '2:30 p. m.', 5000, 'turquesa', 1));
  await repos.sorteos.guardar(S('Chontico Día', 'dia', '1:00 p. m.', 5000, 'morado', 2));
  const paisita = await repos.sorteos.guardar(S('Paisita Día', 'dia', '2:30 p. m.', 10000, 'naranja', 3));
  await repos.sorteos.guardar(S('Caribeña Noche', 'noche', '10:30 p. m.', 20000, 'turquesa', 4));
  await repos.sorteos.guardar(S('Chontico Noche', 'noche', '7:00 p. m.', 5000, 'morado', 5));
  await repos.sorteos.guardar(S('Sinuano Noche', 'noche', '10:30 p. m.', 10000, 'verde', 6));
  await repos.sorteos.guardar(
    S('VIP Valle', 'noche', '10:30 p. m.', 30000, 'rojo', 7, {
      etiqueta: 'Miércoles',
      fecha: proximo(3),
      loteria: 'Lotería del Valle',
    }),
  );
  await repos.sorteos.guardar(
    S('VIP Boyacá', 'noche', '10:30 p. m.', 30000, 'rojo', 8, {
      etiqueta: 'Sábados',
      fecha: proximo(6),
      loteria: 'Lotería de Boyacá',
    }),
  );

  const ana = { telefono: '3000000001', nombre: 'Ana (ejemplo)' };
  const carlos = { telefono: '3000000002', nombre: 'Carlos (ejemplo)' };
  const luisa = { telefono: '3000000003', nombre: 'Luisa (ejemplo)' };
  await repos.contactos.guardar([ana, carlos, luisa]);
  await repos.reservas.apartar(paisita.id, [1, 2, 3], ana, 'fijo');
  await repos.reservas.marcarPago(paisita.id, ana.telefono, true);
  await repos.reservas.apartar(paisita.id, [5, 7, 99], carlos, 'fijo');
  await repos.reservas.apartar(paisita.id, [23, 48], luisa, 'cliente');
  await repos.reservas.apartar(caribena.id, [10], ana, 'fijo');
  await repos.reservas.marcarPago(caribena.id, ana.telefono, true);
  await repos.reservas.apartar(caribena.id, [77], luisa, 'cliente');
  await repos.ajustes.guardar({ negocio: 'El Pato de la Suerte', whatsapp: '', plantilla: PLANTILLA_BASE });
  console.log('Sorteos, contactos y reservas de ejemplo cargados.');
}

if (!(await repos.ajustes.obtener()).diseno.ruleta.maquina && existsSync(DIR_RECURSOS)) {
  await instalarRecursos(repos, config);
  console.log('Recursos gráficos de la marca instalados en el diseño.');
}

const usuario = (process.env.SEMILLA_ADMIN_USUARIO ?? '').toLowerCase();
const clave = process.env.SEMILLA_ADMIN_CLAVE ?? '';
if (usuario && clave.length >= LARGO_MINIMO_CLAVE) {
  if (await repos.admins.porUsuario(usuario)) console.log(`El administrador "${usuario}" ya existe.`);
  else {
    await repos.admins.crear(usuario, await cifrarClave(clave));
    console.log(`Administrador de desarrollo "${usuario}" creado (contraseña en .env).`);
  }
} else {
  console.log(
    'Sin administrador de desarrollo: define SEMILLA_ADMIN_USUARIO y SEMILLA_ADMIN_CLAVE en .env, o usa "npm run admin -- crear <usuario>".',
  );
}
db.close();
