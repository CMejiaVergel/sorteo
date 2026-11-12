import {
  decidirGiro,
  dosDigitos,
  hoyBogota,
  leerTexto,
  normalizarTelefono,
  sumarDias,
  telefonoValido,
  type Azar,
  type MisNumeros,
} from '@pato/shared';
import { ErrorApi, noDisponible } from '../errores.ts';
import { LimiteDispositivo, NumerosOcupados, YaGiro, type Repos } from '../repositorios/tipos.ts';

export interface Contexto {
  repos: Repos;
  /** Reloj inyectable para probar el cambio de día. */
  ahora: () => Date;
  azar: Azar;
  zona: string;
}

const telInvalido = () => new ErrorApi(422, 'telefono_invalido', 'Escribe tu celular de 10 dígitos. Debe empezar por 3.');

/** Desde dónde se aparta: cookie del navegador, red y navegador. */
export interface OrigenReserva {
  dispositivo: string;
  ip: string;
  agente: string;
}

/** Celulares distintos desde un mismo dispositivo en un sorteo a partir de los cuales se avisa al panel. */
export const ALERTA_CELULARES = 4;

const lista = (n: number[]) => n.map(dosDigitos).join(', ');

/**
 * Aparta números para un cliente. Todo o nada. Con `origen`, además aplica la seguridad:
 * dispositivo bloqueado → no aparta; más números que el límite por dispositivo → no aparta y avisa al panel.
 * En los dos casos la persona recibe un mensaje claro para pedir sus números por WhatsApp.
 */
export async function reservar(
  ctx: Contexto,
  sorteoId: string,
  entrada: { numeros: number[]; nombre: string; telefono: string },
  origen?: OrigenReserva,
) {
  const s = await ctx.repos.sorteos.obtener(sorteoId);
  if (!s || !s.activo) throw noDisponible();
  const telefono = normalizarTelefono(entrada.telefono);
  if (!telefonoValido(telefono)) throw telInvalido();
  const nombre = String(entrada.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (nombre.length < 2) throw new ErrorApi(422, 'nombre_invalido', 'Escribe tu nombre para saber de quién son los números.');
  const numeros = [...new Set(entrada.numeros)];
  if (numeros.length < 1 || numeros.length > 30) throw new ErrorApi(422, 'cantidad_invalida', 'Elige entre 1 y 30 números.');
  if (numeros.some((n) => !Number.isInteger(n) || n < 0 || n > 99))
    throw new ErrorApi(422, 'numero_fuera_de_rango', 'Los números van del 00 al 99.');
  numeros.sort((a, b) => a - b);

  const seg = ctx.repos.seguridad;
  const quien = `${nombre} (${telefono})`;
  const intento = (resultado: string) =>
    origen ? seg.registrarIntento({ dispositivo_id: origen.dispositivo, ip: origen.ip, sorteo_id: s.id, telefono, nombre, numeros, resultado }) : null;

  let max = 0;
  if (origen) {
    const { bloqueado } = await seg.tocar({ id: origen.dispositivo, ip: origen.ip, agente: origen.agente });
    if (bloqueado) {
      await intento('bloqueado');
      await seg.alertar({
        tipo: 'bloqueado',
        dispositivo_id: origen.dispositivo,
        ip: origen.ip,
        sorteo_id: s.id,
        detalle: `Un dispositivo bloqueado intentó apartar ${lista(numeros)} como ${quien}.`,
      });
      throw new ErrorApi(
        403,
        'dispositivo_bloqueado',
        'No pudimos apartar desde este celular. Escríbenos por WhatsApp y te ayudamos a apartar tus números.',
        { numeros },
      );
    }
    max = await seg.limite();
  }

  // El contacto se guarda solo si la reserva sale (así un intento rechazado no llena la lista).
  const guardado = await ctx.repos.contactos.buscar(telefono);
  const nombreFinal = guardado?.nombre ?? nombre;
  try {
    await ctx.repos.reservas.apartar(
      s.id,
      numeros,
      { telefono, nombre: nombreFinal },
      'cliente',
      origen ? { dispositivo: origen.dispositivo, ip: origen.ip, max } : undefined,
    );
  } catch (e) {
    if (e instanceof NumerosOcupados) {
      await intento('ocupados');
      const o = e.ocupados;
      throw new ErrorApi(
        409,
        'numeros_ocupados',
        `Otra persona apartó ${o.length === 1 ? 'el' : 'los'} ${lista(o)} unos segundos antes que tú. Elige ${o.length === 1 ? 'otro número' : 'otros números'}.`,
        { ocupados: o },
      );
    }
    if (e instanceof LimiteDispositivo && origen) {
      await intento('limite');
      await seg.alertar({
        tipo: 'limite',
        dispositivo_id: origen.dispositivo,
        ip: origen.ip,
        sorteo_id: s.id,
        detalle: `Quiso apartar ${numeros.length} más (${lista(numeros)}) como ${quien} y ya tenía ${e.tiene}. Límite: ${max}.`,
      });
      const quedan = Math.max(0, max - e.tiene);
      throw new ErrorApi(
        409,
        'limite_dispositivo',
        `Por seguridad, desde un mismo celular se pueden apartar hasta ${max} números por sorteo` +
          (e.tiene ? ` y ya tienes ${e.tiene}.` : '.') +
          (quedan && e.tiene ? ` Aquí puedes apartar ${quedan} más; los demás pídelos por WhatsApp y te los separamos.` : ' Pídelos por WhatsApp y te los separamos.'),
        { limite: max, tiene: e.tiene, quedan, numeros },
      );
    }
    throw e;
  }
  await ctx.repos.contactos.crearSiNoExiste({ telefono, nombre: nombreFinal });

  if (origen) {
    await intento('ok');
    const uso = await seg.usoDispositivo(s.id, origen.dispositivo);
    if (uso.celulares >= ALERTA_CELULARES)
      await seg.alertar({
        tipo: 'varios_celulares',
        dispositivo_id: origen.dispositivo,
        ip: origen.ip,
        sorteo_id: s.id,
        detalle: `Un mismo dispositivo ya apartó a nombre de ${uso.celulares} celulares distintos (${uso.numeros} números). El último: ${quien}.`,
      });
    if (max > 0) {
      const red = await seg.usoRed(s.id, origen.ip);
      if (red.dispositivos >= 2 && red.numeros > max * 2)
        await seg.alertar({
          tipo: 'misma_red',
          dispositivo_id: '',
          ip: origen.ip,
          sorteo_id: s.id,
          detalle: `Desde la misma red (${origen.ip}) se apartaron ${red.numeros} números con ${red.dispositivos} dispositivos. Puede ser una casa o un plan de datos compartido; revísalo antes de bloquear.`,
        });
    }
  }
  return { nombre: nombreFinal, numeros, total: numeros.length * s.valor_boleta };
}

/** Consulta de "Mis números": activos o de los últimos 7 días. */
export async function misNumeros(ctx: Contexto, tel: string): Promise<MisNumeros> {
  const telefono = normalizarTelefono(tel);
  if (!telefonoValido(telefono)) throw telInvalido();
  const desde = sumarDias(hoyBogota(ctx.ahora(), ctx.zona), -7);
  const sorteos = await ctx.repos.reservas.porTelefono(telefono, desde);
  const c = await ctx.repos.contactos.buscar(telefono);
  return { nombre: c?.nombre ?? '', sorteos };
}

/** Un giro por celular por día (día de Bogotá). El servidor decide el resultado. */
export async function girar(ctx: Contexto, tel: string) {
  const telefono = normalizarTelefono(tel);
  if (!telefonoValido(telefono)) throw telInvalido();
  const cfg = await ctx.repos.ruleta.config();
  if (!cfg.activo) throw new ErrorApi(409, 'ruleta_inactiva', 'Ruleta apagada');
  const fecha = hoyBogota(ctx.ahora(), ctx.zona);
  const yaGiro = async () => {
    const g = await ctx.repos.ruleta.giroDe(telefono, fecha);
    return new ErrorApi(409, 'ya_giro', 'Ya habías jugado hoy con este celular.', {
      resultado: g?.resultado ?? [],
      gano: g?.gano ?? 0,
      premio: g?.premio ?? '',
    });
  };
  if (await ctx.repos.ruleta.giroDe(telefono, fecha)) throw await yaGiro();
  const r = decidirGiro(cfg, ctx.azar);
  try {
    await ctx.repos.ruleta.registrar({ telefono, fecha, resultado: r.resultado, gano: r.gano, premio: r.premio });
  } catch (e) {
    if (e instanceof YaGiro) throw await yaGiro();
    throw e;
  }
  return r;
}

/** Aplica líneas de números fijos. Las líneas con error se devuelven una a una. */
export async function agregarFijos(ctx: Contexto, sorteoId: string, texto: string) {
  const s = await ctx.repos.sorteos.obtener(sorteoId);
  if (!s) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
  const errores: string[] = [];
  let agregadas = 0;
  for (const l of leerTexto(texto)) {
    if (!l.numeros.length) {
      errores.push(`“${l.linea}”: no encontré números.`);
      continue;
    }
    let { telefono, nombre } = l;
    if (!telefono && nombre) telefono = (await ctx.repos.contactos.buscarPorNombre(nombre))?.telefono ?? '';
    if (!telefono) {
      errores.push(nombre ? `“${l.linea}”: falta el celular de ${nombre}.` : `“${l.linea}”: falta el celular.`);
      continue;
    }
    if (!nombre) nombre = (await ctx.repos.contactos.buscar(telefono))?.nombre ?? '';
    if (nombre.length < 2) {
      errores.push(`“${l.linea}”: falta el nombre.`);
      continue;
    }
    try {
      await ctx.repos.reservas.apartar(s.id, l.numeros, { telefono, nombre }, 'fijo');
      await ctx.repos.contactos.guardar([{ telefono, nombre }]);
      agregadas++;
    } catch (e) {
      if (e instanceof NumerosOcupados)
        errores.push(`“${l.linea}”: ${e.ocupados.map(dosDigitos).join(', ')} ya ${e.ocupados.length === 1 ? 'está ocupado' : 'están ocupados'}.`);
      else throw e;
    }
  }
  return { agregadas, errores };
}

/** Copia los fijos de otro sorteo; salta e informa los números ya ocupados. */
export async function copiarFijos(ctx: Contexto, destinoId: string, origenId: string) {
  const [d, o] = await Promise.all([ctx.repos.sorteos.obtener(destinoId), ctx.repos.sorteos.obtener(origenId)]);
  if (!d || !o) throw new ErrorApi(404, 'no_encontrado', 'No encontré ese sorteo.');
  const ocupados = new Set(await ctx.repos.reservas.ocupados(destinoId));
  const fijos = (await ctx.repos.reservas.porSorteo(origenId)).filter((r) => r.tipo === 'fijo');
  const porPersona = new Map<string, { nombre: string; numeros: number[] }>();
  for (const r of fijos) {
    const g = porPersona.get(r.telefono) ?? { nombre: r.nombre, numeros: [] };
    g.numeros.push(r.numero);
    porPersona.set(r.telefono, g);
  }
  const saltados: string[] = [];
  let copiadas = 0;
  for (const [telefono, g] of porPersona) {
    const libres = g.numeros.filter((n) => !ocupados.has(n));
    const tomados = g.numeros.filter((n) => ocupados.has(n));
    if (tomados.length) saltados.push(`${g.nombre}: ${tomados.map(dosDigitos).join(', ')} ya estaban ocupados.`);
    if (!libres.length) continue;
    try {
      await ctx.repos.reservas.apartar(destinoId, libres, { telefono, nombre: g.nombre }, 'fijo');
      libres.forEach((n) => ocupados.add(n));
      copiadas++;
    } catch (e) {
      if (e instanceof NumerosOcupados) saltados.push(`${g.nombre}: ${e.ocupados.map(dosDigitos).join(', ')} ya estaban ocupados.`);
      else throw e;
    }
  }
  return { copiadas, personas: porPersona.size, saltados };
}
