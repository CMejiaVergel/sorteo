import { z } from 'zod';
import { normalizarTelefono } from '../telefono.ts';
import { COLORES } from '../temas.ts';
import { SIMBOLOS } from '../simbolos.ts';

const texto = (max: number) => z.string().trim().max(max);
const entero = z.coerce.number().int().min(0).max(1_000_000_000);
const telefono = z.preprocess((v) => normalizarTelefono(v), z.string().regex(/^3\d{9}$/, 'telefono_invalido'));
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Ruta de una imagen del almacén propio, o vacío. */
export const rutaMedio = z
  .string()
  .regex(/^(\/medios\/[a-z0-9]+\.webp)?$/, 'ruta_invalida')
  .default('');

// ---------- Público ----------
export const esquemaReserva = z.object({
  numeros: z.array(z.number().int()),
  nombre: z.string(),
  telefono: z.string(),
});

export const esquemaGiro = z.object({ telefono: z.string() });

// ---------- Administración ----------
export const esquemaLogin = z.object({
  usuario: z.string().trim().max(64),
  clave: z.string().max(256),
});

export const esquemaSorteo = z
  .object({
    nombre: texto(80).min(1, 'Ponle un nombre al sorteo.'),
    loteria: texto(80).default(''),
    jornada: z.enum(['dia', 'noche']).default('dia'),
    fecha: fecha.nullable().default(null),
    hora: texto(30).default(''),
    orden: z.coerce.number().int().min(-9999).max(9999).default(0),
    // Uno de los colores predefinidos, un color propio (#RRGGBB) o vacío (automático según el nombre).
    color: z
      .union([z.enum(COLORES as [string, ...string[]]), z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal('')])
      .default(''),
    etiqueta: texto(40).default(''),
    activo: z.boolean().default(true),
    valor_boleta: z.coerce.number().int().min(0).max(1_000_000_000),
    gratis: z.boolean().default(false),
    max_por_celular: z.coerce
      .number({ invalid_type_error: 'Escribe un número.' })
      .int('Escribe un número entero.')
      .min(0, 'Mínimo 0.')
      .max(100, 'Máximo 100.')
      .default(0),
    abre: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Escribe la fecha y la hora de apertura.')
      .nullable()
      .default(null),
    imagen_agotado: rutaMedio,
    lista_encabezado: texto(600).default(''),
    lista_pie: texto(600).default(''),
    premio_total: entero.default(0),
    premio_ultimas: entero.default(0),
    premio_primeras: entero.default(0),
    premio_medio: entero.default(0),
    // Número de cobro del sorteo: recibe el pago por Nequi y el ticket por WhatsApp. Obligatorio.
    nequi: z.preprocess(
      (v) => normalizarTelefono(v),
      z.string().regex(/^3\d{9}$/, 'Escribe el número de cobro (Nequi y WhatsApp): 10 dígitos que empiecen por 3.'),
    ),
    nequi_titular: texto(80).min(2, 'Escribe a nombre de quién está el Nequi.'),
    imagen: rutaMedio,
    logo_loteria: rutaMedio,
    logo_ocupado: rutaMedio,
    fondo_imagen: rutaMedio,
  })
  // Un sorteo gratis vale 0; uno pagado necesita valor.
  .refine((s) => s.gratis || s.valor_boleta > 0, { message: 'Escribe el valor de la boleta.', path: ['valor_boleta'] })
  .transform((s) => (s.gratis ? { ...s, valor_boleta: 0 } : s));
export type SorteoEntrada = z.infer<typeof esquemaSorteo>;

/** Reiniciar el sorteo para un nuevo día: tablero limpio, misma configuración. */
export const esquemaReinicio = z.object({
  fecha: fecha,
  abre: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  conservar_fijos: z.boolean().default(true),
});

export const esquemaTexto = z.object({ texto: z.string().max(20_000) });
export const esquemaCopiarFijos = z.object({ origen_id: z.string().min(1) });
const listaNumeros = z.array(z.number().int().min(0).max(99)).max(100);
/** Sin `numeros` aplica a todos los números de la persona en el sorteo. */
export const esquemaPago = z.object({ telefono, pagado: z.boolean(), numeros: listaNumeros.optional() });
export const esquemaLiberar = z.object({ telefono, numeros: listaNumeros.optional() });
const nombrePersona = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ' '))
  .pipe(z.string().min(2, 'Escribe el nombre (mínimo 2 letras).').max(60, 'El nombre es muy largo.'));
const celularPersona = z.preprocess(
  (v) => normalizarTelefono(v),
  z.string().regex(/^3\d{9}$/, 'Escribe un celular de 10 dígitos que empiece por 3.'),
);
/** Apartar desde el panel a nombre de alguien (por ejemplo, pedidos por WhatsApp). */
export const esquemaApartarAdmin = z.object({
  telefono: celularPersona,
  nombre: nombrePersona,
  numeros: listaNumeros.min(1),
  fijo: z.boolean().default(false),
});
export const esquemaContacto = z.object({ telefono: celularPersona, nombre: nombrePersona });

/** Seguridad: bloquear o desbloquear un dispositivo; opcionalmente liberar sus números sin pagar. */
export const esquemaBloqueo = z.object({
  bloqueado: z.boolean(),
  motivo: z.string().trim().max(200).default(''),
  liberar: z.boolean().default(false),
});
/** Números por dispositivo y sorteo antes de pedir que aparte por WhatsApp. 0 = sin límite. */
export const esquemaLimite = z.object({
  limite: z.coerce
    .number({ invalid_type_error: 'Escribe un número.' })
    .int('Escribe un número entero.')
    .min(0, 'Mínimo 0.')
    .max(100, 'Máximo 100.'),
});

export const esquemaRuleta = z
  .object({
    activo: z.boolean(),
    prob_tres: z.coerce.number().min(0).max(100),
    premio_tres: texto(80),
    prob_dos: z.coerce.number().min(0).max(100),
    premio_dos: texto(80),
    // Premio por trío de cada símbolo; vacío = el premio general de 3 iguales.
    premios_tres: z
      .object(
        Object.fromEntries(SIMBOLOS.map((k) => [k, texto(80).optional()])) as Record<
          (typeof SIMBOLOS)[number],
          z.ZodOptional<z.ZodString>
        >,
      )
      .default({}),
  })
  .refine((c) => c.prob_tres + c.prob_dos <= 100, { message: 'La suma de las probabilidades no puede pasar de 100.' });
export type ConfigRuleta = z.infer<typeof esquemaRuleta>;

export const esquemaReclamado = z.object({ reclamado: z.boolean() });

export const esquemaAjustes = z.object({
  negocio: texto(60).min(1).default('El Pato de la Suerte'),
  whatsapp: z.preprocess(
    (v) => normalizarTelefono(v),
    z.string().regex(/^(3\d{9})?$/, 'Escribe un WhatsApp de 10 dígitos que empiece por 3.'),
  ),
  plantilla: z.string().max(1000),
  plantilla_ticket: z.string().max(2000).default(''),
});

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pct = z.coerce.number().min(0).max(100);

/**
 * Tamaño y posición de un elemento de la pantalla de la ruleta.
 * escala en % del tamaño normal; x en % del ancho de la pantalla; y en % del alto. 100/0/0 = como viene.
 */
const elementoPantalla = z
  .object({
    escala: z.coerce.number().min(30).max(300).default(100),
    x: z.coerce.number().min(-50).max(50).default(0),
    y: z.coerce.number().min(-50).max(50).default(0),
  })
  .default({});
export const ELEMENTOS_PANTALLA = ['titulo', 'maquina', 'celular', 'boton'] as const;
export type ElementoPantalla = (typeof ELEMENTOS_PANTALLA)[number];

/** Documento de personalización (docs/03 §5). null = usar la proforma base. */
export const esquemaDiseno = z.object({
  ruleta: z
    .object({
      fondo: rutaMedio.nullable().default(null),
      logo: rutaMedio.nullable().default(null),
      ocultarLogo: z.boolean().default(false),
      mascota: rutaMedio.nullable().default(null),
      maquina: rutaMedio.nullable().default(null),
      ventana: z.object({ x: pct, y: pct, w: pct, h: pct }).default({ x: 16, y: 30, w: 68, h: 36 }),
      rodillosBlancos: z.boolean().default(false),
      escalaSimbolos: z.coerce.number().min(35).max(100).default(62),
      botonImagen: rutaMedio.nullable().default(null),
      colorCastillo: color.default('#4B57A0'),
      colorBoton: color.default('#E2402F'),
      // Tamaño y posición de cada bloque: así una máquina nueva no queda pequeña y todo se acomoda a gusto.
      disposicion: z
        .object({
          titulo: elementoPantalla,
          maquina: elementoPantalla,
          celular: elementoPantalla,
          boton: elementoPantalla,
        })
        .default({}),
      simbolos: z
        .object(
          Object.fromEntries(SIMBOLOS.map((k) => [k, rutaMedio.nullable().default(null)])) as Record<
            (typeof SIMBOLOS)[number],
            z.ZodDefault<z.ZodNullable<typeof rutaMedio>>
          >,
        )
        .default({}),
    })
    .default({}),
  tablero: z
    .object({
      logoOcupado: rutaMedio.nullable().default(null),
      /** Imagen general de "todos los números vendidos". */
      agotado: rutaMedio.nullable().default(null),
    })
    .default({}),
});
export type Diseno = z.infer<typeof esquemaDiseno>;

/** Convierte "" en null dentro del documento de diseño para que siempre signifique "proforma base". */
export function limpiarDiseno(d: Diseno): Diseno {
  const n = <T>(v: T) => (v === '' ? null : v);
  const r = d.ruleta;
  return {
    ruleta: {
      ...r,
      fondo: n(r.fondo),
      logo: n(r.logo),
      mascota: n(r.mascota),
      maquina: n(r.maquina),
      botonImagen: n(r.botonImagen),
      simbolos: Object.fromEntries(
        Object.entries(r.simbolos).map(([k, v]) => [k, n(v)]),
      ) as Diseno['ruleta']['simbolos'],
    },
    tablero: { logoOcupado: n(d.tablero.logoOcupado), agotado: n(d.tablero.agotado) },
  };
}

export const disenoBase = (): Diseno => esquemaDiseno.parse({});

export const USOS_MEDIO = [
  'fondo',
  'maquina',
  'portada',
  'logo',
  'simbolo',
  'mascota',
  'boton',
  'ocupado',
  'agotado',
] as const;
export type UsoMedio = (typeof USOS_MEDIO)[number];
