import { describe, expect, it } from 'vitest';
import { variablesDisposicion } from '../src/index.ts';
import { disenoBase, esquemaDiseno } from '../src/esquemas/index.ts';

describe('tamaño y posición de la pantalla de la ruleta', () => {
  it('por defecto todo queda como viene y no se ponen variables', () => {
    const d = disenoBase();
    expect(d.ruleta.disposicion.maquina).toEqual({ escala: 100, x: 0, y: 0 });
    expect(variablesDisposicion(d.ruleta.disposicion)).toEqual({});
    expect(variablesDisposicion(undefined)).toEqual({});
  });

  it('un diseño guardado antes de esta opción se lee con los valores normales', () => {
    const viejo = esquemaDiseno.parse({ ruleta: { colorBoton: '#E2402F' } });
    expect(viejo.ruleta.disposicion.boton).toEqual({ escala: 100, x: 0, y: 0 });
  });

  it('convierte tamaño y posición en variables CSS solo cuando cambian', () => {
    const d = esquemaDiseno.parse({
      ruleta: { disposicion: { maquina: { escala: 145, y: -6 }, boton: { escala: 80, x: 4 } } },
    });
    expect(variablesDisposicion(d.ruleta.disposicion)).toEqual({
      '--maquina-s': '1.45',
      '--maquina-y': '-6',
      '--boton-s': '0.8',
      '--boton-x': '4',
    });
  });

  it('rechaza valores fuera de rango', () => {
    expect(esquemaDiseno.safeParse({ ruleta: { disposicion: { maquina: { escala: 301 } } } }).success).toBe(false);
    expect(esquemaDiseno.safeParse({ ruleta: { disposicion: { boton: { escala: 29 } } } }).success).toBe(false);
    expect(esquemaDiseno.safeParse({ ruleta: { disposicion: { titulo: { x: 51 } } } }).success).toBe(false);
    expect(esquemaDiseno.safeParse({ ruleta: { disposicion: { celular: { y: -51 } } } }).success).toBe(false);
  });
});
