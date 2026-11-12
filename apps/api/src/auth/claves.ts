import { hash, verify } from '@node-rs/argon2';

// argon2id (Algorithm.Argon2id = 2) con los parámetros mínimos de docs/06 §3.
const OPCIONES = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const LARGO_MINIMO_CLAVE = 12;

export const cifrarClave = (clave: string): Promise<string> => hash(clave, OPCIONES);

export async function verificarClave(hashGuardado: string, clave: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, clave);
  } catch {
    return false;
  }
}

/** Hash de relleno para que el tiempo de respuesta sea igual si el usuario no existe. */
let relleno: Promise<string> | null = null;
export const hashRelleno = (): Promise<string> => (relleno ??= cifrarClave('relleno-para-tiempo-uniforme'));

export const usuarioValido = (u: string): boolean => /^[a-z0-9.-]{3,32}$/.test(u);
