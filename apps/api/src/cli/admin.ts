/**
 * Administradores por terminal (docs/06 §4). No expone rutas de red: escribe directo en la base.
 *
 *   npm run admin -- crear miguel
 *   npm run admin -- clave miguel
 *   npm run admin -- desactivar miguel | activar miguel
 *   npm run admin -- listar
 *   npm run admin -- cerrar-sesiones miguel
 *
 * La contraseña se pide de forma interactiva y nunca se acepta como argumento.
 */
import { createInterface } from 'node:readline';
import { cargarConfig } from '../config.ts';
import { abrirDb } from '../db/conexion.ts';
import { reposSqlite } from '../repositorios/sqlite.ts';
import { UsuarioRepetido } from '../repositorios/tipos.ts';
import { cifrarClave, LARGO_MINIMO_CLAVE, usuarioValido } from '../auth/claves.ts';

function fallar(msg: string): never {
  console.error('Error: ' + msg);
  process.exit(1);
}

/** Pide un texto sin mostrarlo en pantalla. Si la entrada no es una terminal, lee una línea de stdin. */
function pedirOculto(pregunta: string): Promise<string> {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    let preguntando = true;
    const rlx = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    rlx._writeToOutput = (s: string) => {
      if (preguntando) rlx.output.write(s);
      else if (s.includes('\n') || s.includes('\r')) rlx.output.write('\n');
    };
    rl.question(pregunta, (r) => {
      rl.close();
      ok(r);
    });
    preguntando = false;
  });
}

async function pedirClaveNueva(): Promise<string> {
  const a = await pedirOculto('Contraseña nueva: ');
  if (a.length < LARGO_MINIMO_CLAVE) fallar(`la contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
  if (process.stdin.isTTY) {
    const b = await pedirOculto('Repítela: ');
    if (a !== b) fallar('las contraseñas no coinciden.');
  }
  return a;
}

const [cmd, usuarioArg] = process.argv.slice(2);
const usuario = (usuarioArg ?? '').toLowerCase();
const necesitaUsuario = ['crear', 'clave', 'activar', 'desactivar', 'cerrar-sesiones'];
if (!cmd || ![...necesitaUsuario, 'listar'].includes(cmd))
  fallar('usa: crear <usuario> | clave <usuario> | activar <usuario> | desactivar <usuario> | listar | cerrar-sesiones <usuario>');
if (necesitaUsuario.includes(cmd) && !usuarioValido(usuario))
  fallar('el usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto o guion.');
if (process.argv.length > 4) fallar('la contraseña no se acepta como argumento; se pide de forma interactiva.');

const config = cargarConfig();
const db = abrirDb(config.rutaDb);
const repos = reposSqlite(db);

try {
  if (cmd === 'crear') {
    if (await repos.admins.porUsuario(usuario)) fallar(`el usuario "${usuario}" ya existe.`);
    const clave = await pedirClaveNueva();
    try {
      await repos.admins.crear(usuario, await cifrarClave(clave));
    } catch (e) {
      if (e instanceof UsuarioRepetido) fallar(`el usuario "${usuario}" ya existe.`);
      throw e;
    }
    console.log(`Administrador "${usuario}" creado.`);
  } else if (cmd === 'clave') {
    const a = (await repos.admins.porUsuario(usuario)) ?? fallar(`no existe el usuario "${usuario}".`);
    const clave = await pedirClaveNueva();
    await repos.admins.cambiarClave(usuario, await cifrarClave(clave));
    const n = await repos.sesiones.eliminarDeAdmin(a.id);
    console.log(`Contraseña cambiada. Se cerraron ${n} sesiones abiertas.`);
  } else if (cmd === 'activar' || cmd === 'desactivar') {
    const a = (await repos.admins.porUsuario(usuario)) ?? fallar(`no existe el usuario "${usuario}".`);
    await repos.admins.activar(usuario, cmd === 'activar');
    if (cmd === 'desactivar') await repos.sesiones.eliminarDeAdmin(a.id);
    console.log(`Usuario "${usuario}" ${cmd === 'activar' ? 'activado' : 'desactivado'}.`);
  } else if (cmd === 'cerrar-sesiones') {
    const a = (await repos.admins.porUsuario(usuario)) ?? fallar(`no existe el usuario "${usuario}".`);
    const n = await repos.sesiones.eliminarDeAdmin(a.id);
    console.log(`Se cerraron ${n} sesiones de "${usuario}".`);
  } else {
    const lista = await repos.admins.listar();
    if (!lista.length) console.log('No hay administradores. Crea uno con: npm run admin -- crear <usuario>');
    for (const a of lista)
      console.log(`${a.usuario.padEnd(20)} ${a.activo ? 'activo    ' : 'desactivado'} último ingreso: ${a.ultimo_ingreso ?? 'nunca'}`);
  }
} finally {
  db.close();
}
