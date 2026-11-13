// Lógica pura y tipos. Los esquemas Zod (validación del servidor) viven en '@pato/shared/esquemas'
// para que no terminen dentro del paquete del sitio público.
export * from './telefono.ts';
export * from './dinero.ts';
export * from './fechas.ts';
export * from './lineas.ts';
export * from './lista.ts';
export * from './cobro.ts';
export * from './temas.ts';
export * from './simbolos.ts';
export * from './tipos.ts';
export type { ConfigRuleta, Diseno, ElementoPantalla, SorteoEntrada, UsoMedio } from './esquemas/index.ts';
export * from './disposicion.ts';
