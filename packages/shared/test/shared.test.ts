import { describe, expect, it } from 'vitest';
import {
  agruparPorPersona,
  columnasMenu,
  decidirGiro,
  dinero,
  estadoPago,
  formatearFecha,
  formatearTelefono,
  ganoDe,
  horaCorta,
  hoyBogota,
  leerLinea,
  leerTexto,
  listaFinal,
  mensajeCobro,
  nombresRepetidos,
  normalizarTelefono,
  PLANTILLA_BASE,
  saludo,
  sumarDias,
  telefonoValido,
  temaDe,
  TEMAS,
  enlaceWhatsApp,
  mensajeTicket,
  mensajePedido,
  type ReservaBasica,
} from '../src/index.ts';
import { esquemaDiseno, esquemaRuleta } from '../src/esquemas/index.ts';

describe('teléfono', () => {
  it.each([
    ['300 123 4567', '3001234567', true],
    ['+57 300-123-4567', '3001234567', true],
    ['573001234567', '3001234567', true],
    ['+573001234567', '3001234567', true],
    ['+57 (300) 123-4567', '3001234567', true],
    ['0057 300 123 4567', '3001234567', true],
    ['057 3001234567', '3001234567', true],
    ['300123456', '300123456', false],
    ['6001234567', '6001234567', false],
  ])('%s', (entrada, normal, valido) => {
    expect(normalizarTelefono(entrada)).toBe(normal);
    expect(telefonoValido(normalizarTelefono(entrada))).toBe(valido);
  });
  it('formatea', () => {
    expect(formatearTelefono('3001234567')).toBe('300 123 4567');
    expect(formatearTelefono('')).toBe('');
  });
});

describe('dinero', () => {
  it.each([
    [0, '$0'],
    [5000, '$5.000'],
    [1000000, '$1.000.000'],
  ])('%i', (v, t) => expect(dinero(v)).toBe(t));
});

describe('fechas', () => {
  it('formatea en español', () => expect(formatearFecha('2026-11-08')).toBe('domingo 8 nov'));
  it('hora corta', () => expect(horaCorta('2:30 p. m.')).toBe('2:30PM'));
  it('hoy en Bogotá a las 23:59 y 00:01', () => {
    // 23:59 en Bogotá = 04:59 UTC del día siguiente
    expect(hoyBogota(new Date('2026-11-09T04:59:00Z'))).toBe('2026-11-08');
    expect(hoyBogota(new Date('2026-11-09T05:01:00Z'))).toBe('2026-11-09');
  });
  it('suma días', () => expect(sumarDias('2026-11-01', -7)).toBe('2026-10-25'));
});

describe('lector de líneas', () => {
  it('números, nombre y celular', () => {
    expect(leerLinea('01-02-03 Miguel 3001234567')).toMatchObject({ numeros: [1, 2, 3], nombre: 'Miguel', telefono: '3001234567' });
  });
  it('sin celular', () => {
    expect(leerLinea('05-07-99 Carlos')).toMatchObject({ numeros: [5, 7, 99], nombre: 'Carlos', telefono: '' });
  });
  it('celular primero y sin números', () => {
    expect(leerLinea('3109876543 Carlos Díaz')).toMatchObject({ numeros: [], nombre: 'Carlos Díaz', telefono: '3109876543' });
  });
  it('orden libre con espacios en el celular', () => {
    expect(leerLinea('Ana Pérez 300 123 4567 - 4 8 15')).toMatchObject({
      numeros: [4, 8, 15],
      nombre: 'Ana Pérez',
      telefono: '3001234567',
    });
  });
  it('línea vacía se ignora y números repetidos se unen', () => {
    const r = leerTexto('\n 01-01-02 Ana 3001234567 \n\n');
    expect(r).toHaveLength(1);
    expect(r[0].numeros).toEqual([1, 2]);
  });
});

const R = (numero: number, telefono: string, nombre: string, pagado = false, tipo: 'cliente' | 'fijo' = 'cliente'): ReservaBasica => ({
  numero,
  telefono,
  nombre,
  pagado,
  tipo,
});

describe('lista final', () => {
  const reservas = [R(48, '3000000003', 'Luisa'), R(3, '3000000001', 'Ana'), R(1, '3000000001', 'Ana'), R(23, '3000000003', 'Luisa'), R(5, '3000000002', 'Carlos')];
  const s = { nombre: 'Paisita Día', fecha: '2026-11-08', hora: '2:30 p. m.' };
  it('agrupa por persona y ordena', () => {
    expect(listaFinal(s, reservas)).toBe('Paisita Día · domingo 8 nov · 2:30 p. m.\n\n01-03 Ana\n05 Carlos\n23-48 Luisa');
  });
  it('libres opcionales y sin duplicados', () => {
    const t = listaFinal(s, [...reservas, R(1, '3000000001', 'Ana')], true);
    expect(t.match(/01-03 Ana/g)).toHaveLength(1);
    expect(t).toContain('Libres: 00-02-04-06');
    expect(t).not.toMatch(/Libres:.*\b48\b/);
  });
  it('nombres repetidos', () => {
    const p = agruparPorPersona([R(1, '3000000001', 'Ana'), R(2, '3000000009', 'ana ')]);
    expect(nombresRepetidos(p)).toEqual(['ana']);
  });
});

describe('mensaje de cobro', () => {
  const s = { nombre: 'Paisita Día', jornada: 'noche', fecha: '2026-11-08', hora: '2:30 p. m.', valor_boleta: 5000, nequi: '3001234567', nequi_titular: 'Miguel' };
  it('todas las variables', () => {
    const t = mensajeCobro('{saludo}|{nombre}|{numeros}|{cantidad}|{valor}|{total}|{sorteo}|{fecha}|{hora}|{nequi}|{titular}', s, {
      nombre: 'Carlos',
      numeros: [5, 7, 99],
    });
    expect(t).toBe('buenas noches|Carlos|05, 07, 99|3|$5.000|$15.000|Paisita Día|domingo 8 nov|2:30 p. m.|300 123 4567|Miguel');
  });
  it('variable desconocida intacta', () => expect(mensajeCobro('Hola {apodo}', s, { nombre: 'x', numeros: [] })).toBe('Hola {apodo}'));
  it('saludo por jornada', () => {
    expect(saludo('dia')).toBe('buenos días');
    expect(mensajeCobro(PLANTILLA_BASE, { ...s, jornada: 'dia' }, { nombre: 'A', numeros: [1] })).toContain('buenos días');
  });
  it('ticket para el recaudador', () => {
    const t = mensajeTicket({
      negocio: 'El Pato de la Suerte',
      nombre: 'Carlos',
      telefono: '3109876543',
      sorteo: 'Paisita Día',
      fecha: '2026-11-08',
      hora: '2:30 p. m.',
      numeros: [99, 5, 7],
      valor_boleta: 10000,
      nequi: '3001234567',
      nequi_titular: 'Miguel',
    });
    expect(t).toBe(
      [
        '🦆🍀 *EL PATO DE LA SUERTE* 🍀🦆',
        '',
        'Soy, Carlos 👉🏻310 987 6543',
        '',
        '*TENGO LOS NUMEROS: 05-07-99*✅',
        '*PAISITA DÍA*',
        '',
        '💰 *TOTAL A PAGAR: $30.000*',
        '',
        '*NEQUI* 👉🏻 300 123 4567',
        '*MIGUEL*',
      ].join('\n'),
    );
    expect(mensajeTicket({ negocio: 'x', nombre: 'a', telefono: '3000000000', sorteo: 's', fecha: null, numeros: [1], valor_boleta: 1 })).not.toContain('NEQUI');
  });
  it('ticket con plantilla propia: quita líneas vacías y separadores sueltos', () => {
    const datos = { negocio: 'Pato', nombre: 'Ana', telefono: '3000000001', sorteo: 'VIP', fecha: '2026-11-08', numeros: [3], valor_boleta: 5000 };
    expect(mensajeTicket(datos, 'Hola {nombre}\nJuega: {fecha} · {hora}\nNequi {nequi}\nFin {desconocida}')).toBe(
      'Hola Ana\nJuega: domingo 8 nov\nFin {desconocida}',
    );
    expect(mensajeTicket(datos, '   ')).toContain('*PATO*');
  });
  it('pedido por WhatsApp con los números que quería', () => {
    expect(
      mensajePedido({ negocio: 'El Pato de la Suerte', nombre: 'Carlos Mejia', telefono: '3137297257', sorteo: 'Caribeña Día', numeros: [76, 56], valor_boleta: 5000 }),
    ).toBe(
      ['🦆🍀 *EL PATO DE LA SUERTE* 🍀🦆', '', 'Hola, soy Carlos Mejia 👉🏻313 729 7257', 'Quiero apartar estos números por aquí:', '', '*56-76*', '*CARIBEÑA DÍA*', '', '💰 *TOTAL: $10.000*'].join('\n'),
    );
    expect(mensajePedido({ negocio: 'x', nombre: '', telefono: '12', sorteo: 's', numeros: [1], valor_boleta: 1 })).toContain('Hola\nQuiero');
  });
  it('enlace de WhatsApp', () => expect(enlaceWhatsApp('300 123 4567', 'hola mundo')).toBe('https://wa.me/573001234567?text=hola%20mundo'));
});

describe('temas y menú', () => {
  it('color automático', () => {
    expect(temaDe({ nombre: 'VIP Valle' })).toBe(TEMAS.rojo);
    expect(temaDe({ nombre: 'Caribeña Día' })).toBe(TEMAS.turquesa);
    expect(temaDe({ nombre: 'Otro' })).toBe(TEMAS.azul);
    expect(temaDe({ nombre: 'Paisita Día' })).toBe(TEMAS.naranja);
    expect(temaDe({ nombre: 'Otro', color: 'dorado' })).toBe(TEMAS.dorado);
  });
  it.each([
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 3],
    [6, 3],
  ])('%i sorteos → %i columnas', (n, c) => expect(columnasMenu(n)).toBe(c));
});

describe('estado de pago', () => {
  it('todos, ninguno, algunos', () => {
    expect(estadoPago([1, 2], [1, 2])).toBe('pagado');
    expect(estadoPago([1, 2], [])).toBe('pendiente');
    expect(estadoPago([1, 2], [2])).toBe('parcial');
  });
});

/** Azar que devuelve una secuencia fija. */
const secuencia = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('giro', () => {
  const c = { prob_tres: 1, premio_tres: 'Gratis', prob_dos: 10, premio_dos: 'Descuento' };
  // El barajado consume 4 valores; luego r, luego la posición.
  it('fuerza 3 iguales', () => {
    const g = decidirGiro(c, secuencia(0, 0, 0, 0, 0.005));
    expect(g.gano).toBe(3);
    expect(ganoDe(g.resultado)).toBe(3);
    expect(g.premio).toBe('Gratis');
  });
  it.each([0, 0.4, 0.9])('2 iguales en cada posición (%f)', (pos) => {
    const g = decidirGiro(c, secuencia(0, 0, 0, 0, 0.05, pos));
    expect(g.gano).toBe(2);
    expect(ganoDe(g.resultado)).toBe(2);
  });
  it('las tres posiciones de 2 iguales son distintas', () => {
    const filas = [0, 0.4, 0.9].map((p) => decidirGiro(c, secuencia(0, 0, 0, 0, 0.05, p)).resultado.join());
    expect(new Set(filas).size).toBe(3);
  });
  it('ninguno', () => {
    const g = decidirGiro(c, secuencia(0, 0, 0, 0, 0.5));
    expect(g.gano).toBe(0);
    expect(ganoDe(g.resultado)).toBe(0);
  });
  it('frecuencias cercanas a las probabilidades con 100 000 tiros', () => {
    let tres = 0;
    let dos = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const g = decidirGiro(c);
      if (g.gano === 3) tres++;
      if (g.gano === 2) dos++;
    }
    expect(tres / N).toBeGreaterThan(0.007);
    expect(tres / N).toBeLessThan(0.013);
    expect(dos / N).toBeGreaterThan(0.09);
    expect(dos / N).toBeLessThan(0.11);
  });
});

describe('esquemas', () => {
  it('probabilidades que suman más de 100 se rechazan', () => {
    expect(esquemaRuleta.safeParse({ activo: true, prob_tres: 60, premio_tres: 'a', prob_dos: 50, premio_dos: 'b' }).success).toBe(false);
  });
  it('diseño vacío trae la proforma base', () => {
    const d = esquemaDiseno.parse({});
    expect(d.ruleta.escalaSimbolos).toBe(62);
    expect(d.ruleta.ventana).toEqual({ x: 16, y: 30, w: 68, h: 36 });
    expect(d.tablero.logoOcupado).toBeNull();
  });
  it('rechaza rutas de imagen ajenas y colores mal formados', () => {
    expect(esquemaDiseno.safeParse({ ruleta: { fondo: 'https://otro.com/a.png' } }).success).toBe(false);
    expect(esquemaDiseno.safeParse({ ruleta: { colorBoton: 'red' } }).success).toBe(false);
  });
});
