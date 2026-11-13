import { describe, expect, it } from 'vitest';
import {
  ahoraLocal,
  decidirGiro,
  ENCABEZADO_LISTA,
  fechaLarga,
  formatearApertura,
  listaWhatsApp,
  premioTrio,
  sorteoAbierto,
  type ReservaBasica,
} from '../src/index.ts';
import { esquemaSorteo } from '../src/esquemas/index.ts';

const R = (
  numero: number,
  telefono: string,
  nombre: string,
  pagado = false,
  tipo: 'cliente' | 'fijo' = 'cliente',
): ReservaBasica => ({
  numero,
  telefono,
  nombre,
  pagado,
  tipo,
});

const S = {
  nombre: 'Chontico Día',
  loteria: 'Chontico',
  jornada: 'dia',
  fecha: '2026-09-09',
  hora: '1:00 p. m.',
  valor_boleta: 5000,
  premio_total: 350000,
};

describe('lista para el grupo de WhatsApp', () => {
  const reservas = [
    R(96, '3000000001', 'Simy', true, 'fijo'),
    R(3, '3000000001', 'Simy', true, 'fijo'),
    R(12, '3000000002', 'Norvei', false, 'fijo'),
    R(14, '3000000002', 'Norvei', false, 'fijo'),
    // Pago parcial: 20 y 21 pagados, 22 no.
    R(20, '3000000003', 'Nely', true),
    R(21, '3000000003', 'Nely', true),
    R(22, '3000000003', 'Nely'),
    R(50, '3000000004', 'Jossimar'),
  ];

  it('encabezado predeterminado, fijos aparte, ✅ en lo pagado y parciales en dos líneas', () => {
    expect(listaWhatsApp(S, reservas)).toBe(
      [
        'LISTADO DE PARTICIPANTES PARA CHONTICO DÍA (9 DE SEPTIEMBRE)',
        '',
        'FIJOS',
        '',
        '03-96- Simy ✅',
        '12-14- Norvei',
        '',
        'PARTICIPANTES',
        '',
        '20-21- Nely ✅',
        '22- Nely',
        '50- Jossimar',
      ].join('\n'),
    );
  });

  it('❌ en lo pendiente solo cuando el administrador lo pide', () => {
    const t = listaWhatsApp(S, reservas, { marcarNoPagados: true });
    expect(t).toContain('12-14- Norvei ❌');
    expect(t).toContain('20-21- Nely ✅\n22- Nely ❌');
    expect(t).toContain('50- Jossimar ❌');
    expect(t).not.toContain('Simy ❌');
  });

  it('encabezado y final propios con variables en minúscula y MAYÚSCULA; libres al final', () => {
    const t = listaWhatsApp(
      {
        ...S,
        lista_encabezado: '🦆 {SORTEO} · {dia} {fecha} · {hora} · {desconocida}',
        lista_pie: 'Quedan {libres} libres de 100. Boleta {valor}. ¡Suerte!',
      },
      [R(1, '3000000001', 'Ana', true)],
      { incluirLibres: true },
    );
    const lineas = t.split('\n');
    expect(lineas[0]).toBe('🦆 CHONTICO DÍA · miércoles 9 de septiembre · 1:00 p. m. · {desconocida}');
    expect(lineas[2]).toBe('01- Ana ✅');
    expect(t).toMatch(/LIBRES: 00-02-03-.*-99\n\nQuedan 99 libres de 100\. Boleta \$5\.000\. ¡Suerte!$/);
  });

  it('sin fijos no hay títulos de sección; sorteo gratis sin marcas; vacío lo dice', () => {
    expect(listaWhatsApp(S, [R(5, '3000000001', 'Ana')])).toBe(
      `${'LISTADO DE PARTICIPANTES PARA CHONTICO DÍA (9 DE SEPTIEMBRE)'}\n\n05- Ana`,
    );
    expect(listaWhatsApp({ ...S, gratis: true }, [R(5, '3000000001', 'Ana', true)], { marcarNoPagados: true })).toMatch(
      /05- Ana$/,
    );
    expect(listaWhatsApp(S, [])).toMatch(/Aún no hay números apartados\.$/);
    expect(ENCABEZADO_LISTA).toContain('{SORTEO}');
  });
});

describe('apertura programada', () => {
  it('compara con la hora de Bogotá, no la del equipo', () => {
    const ahora = new Date('2026-11-14T00:30:00Z'); // 19:30 del 13 en Bogotá
    expect(ahoraLocal(ahora)).toBe('2026-11-13T19:30');
    expect(sorteoAbierto({ activo: true, abre: '2026-11-13T19:30' }, ahora)).toBe(true);
    expect(sorteoAbierto({ activo: true, abre: '2026-11-13T19:31' }, ahora)).toBe(false);
    expect(sorteoAbierto({ activo: true, abre: null }, ahora)).toBe(true);
    expect(sorteoAbierto({ activo: false, abre: null }, ahora)).toBe(false);
    expect(ahoraLocal(new Date('2026-11-13T05:05:00Z'))).toBe('2026-11-13T00:05'); // medianoche en formato 24 h
  });

  it('textos de fecha', () => {
    expect(fechaLarga('2026-09-09')).toBe('9 de septiembre');
    expect(formatearApertura('2026-11-13T07:05')).toBe('viernes 13 nov · 7:05 a. m.');
    expect(formatearApertura('2026-11-13T12:00')).toBe('viernes 13 nov · 12:00 p. m.');
    expect(formatearApertura('2026-11-13T00:15')).toBe('viernes 13 nov · 12:15 a. m.');
  });
});

describe('premios por símbolo', () => {
  const c = {
    prob_tres: 100,
    premio_tres: 'General',
    prob_dos: 0,
    premio_dos: 'Par',
    premios_tres: { trebol: 'Trébol $20.000', moneda: '  ' },
  };
  it('usa el premio del símbolo y, si está vacío, el general', () => {
    expect(premioTrio(c, 'trebol')).toBe('Trébol $20.000');
    expect(premioTrio(c, 'moneda')).toBe('General');
    expect(premioTrio({ premio_tres: 'General' }, 'siete')).toBe('General');
    for (let i = 0; i < 20; i++) {
      const g = decidirGiro(c);
      expect(g.gano).toBe(3);
      expect(g.premio).toBe(premioTrio(c, g.resultado[0]));
    }
  });
});

describe('validación del sorteo', () => {
  const base = { nombre: 'X', valor_boleta: 0, nequi: '3001234567', nequi_titular: 'Ana' };
  it('gratis deja el valor en 0; pagado lo exige', () => {
    expect(esquemaSorteo.safeParse(base).success).toBe(false);
    expect(esquemaSorteo.parse({ ...base, gratis: true, valor_boleta: 9000 }).valor_boleta).toBe(0);
    expect(esquemaSorteo.parse({ ...base, valor_boleta: 5000 })).toMatchObject({
      gratis: false,
      max_por_celular: 0,
      abre: null,
    });
    expect(esquemaSorteo.safeParse({ ...base, valor_boleta: 5000, abre: '2026-11-13 19:00' }).success).toBe(false);
    expect(esquemaSorteo.safeParse({ ...base, valor_boleta: 5000, max_por_celular: 101 }).success).toBe(false);
  });
});
