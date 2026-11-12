import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { palabraArte, temaDe } from '@pato/shared';
import { SvgSimbolo } from './Sprite.tsx';
import { portadaDe } from './recursos.ts';

// ---------- Aviso flotante ----------
type Oyente = (m: string) => void;
const oyentes = new Set<Oyente>();

/** Muestra un aviso abajo al centro durante 2,6 s. */
export const avisar = (mensaje: string) => oyentes.forEach((o) => o(mensaje));

export function Aviso() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const o: Oyente = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(''), 2600);
    };
    oyentes.add(o);
    return () => {
      oyentes.delete(o);
      clearTimeout(t);
    };
  }, []);
  return (
    <div className="toast" role="status" aria-live="polite" hidden={!msg}>
      {msg}
    </div>
  );
}

// ---------- Copiar ----------
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    avisar('Copiado');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    avisar(ok ? 'Copiado' : 'Mantén presionado el texto para copiarlo');
    return ok;
  }
}

/** Botón que copia y muestra "Copiado" durante 1,8 s. */
export function BotonCopiar({ texto, children, ...p }: { texto: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      {...p}
      onClick={async () => {
        if (await copiar(texto)) {
          setHecho(true);
          setTimeout(() => setHecho(false), 1800);
        }
      }}
    >
      {hecho ? 'Copiado' : children}
    </button>
  );
}

/** Acción destructiva: pide un segundo toque durante 3 s. Sin diálogos del navegador. */
export function BotonDobleToque({
  accion,
  confirmar = '¿Seguro? Toca otra vez',
  children,
  ...p
}: { accion: () => unknown; confirmar?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const [armado, setArmado] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      type="button"
      {...p}
      onClick={() => {
        if (armado) {
          clearTimeout(t.current);
          setArmado(false);
          accion();
          return;
        }
        setArmado(true);
        t.current = setTimeout(() => setArmado(false), 3000);
      }}
    >
      {armado ? confirmar : children}
    </button>
  );
}

export const vibrar = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* sin vibración */
  }
};

// ---------- Arte de sorteo ----------
interface SorteoArte {
  nombre: string;
  color?: string | null;
  imagen?: string | null;
}

/** Arte automático: degradado del color del sorteo, rayos, emblema con moneda, tréboles y primera palabra. */
export function ArteSorteo({ s }: { s: SorteoArte }) {
  return (
    <div className="arte">
      <i className="arte-rayos" />
      <div className="emblema">
        <SvgSimbolo k="moneda" />
      </div>
      <SvgSimbolo k="trebol" className="arte-tre t1" />
      <SvgSimbolo k="trebol" className="arte-tre t2" />
      <span className="arte-txt">{palabraArte(s.nombre)}</span>
    </div>
  );
}

/** Portada del sorteo (propia o de la marca) dentro de un contenedor .pc-arte. */
export function Portada({ s, className = '' }: { s: SorteoArte; className?: string }) {
  const t = temaDe(s);
  return (
    <div className={`pc-arte ${className}`} style={{ '--c1': t.c1, '--c2': t.c2 } as CSSProperties}>
      <img src={portadaDe(s)} alt="" />
    </div>
  );
}

/** Tapa de número ocupado: logo del sorteo → logo general → moneda. */
export function Tapa({ url }: { url?: string | null }) {
  return url ? <img src={url} alt="" /> : <SvgSimbolo k="moneda" />;
}
