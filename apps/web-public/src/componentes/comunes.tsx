import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { iniciales } from '@pato/shared';
import { api } from '../api/cliente.ts';

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: 60_000 });

/** Encabezado con la marca y columna central de la aplicación. Sin enlaces de administración. */
export function Marco({ children, sinEncabezado = false }: { children: ReactNode; sinEncabezado?: boolean }) {
  const { data } = useConfig();
  const negocio = data?.negocio ?? 'El Pato de la Suerte';
  return (
    <>
      {!sinEncabezado && (
      <header className="wrap top">
        <Link className="brand" to="/sorteos">
          {data?.diseno.ruleta.logo ? (
            <span className="brand-mark con-logo">
              <img src={data.diseno.ruleta.logo} alt="" />
            </span>
          ) : (
            <span className="brand-mark">{iniciales(negocio)}</span>
          )}
          {negocio}
        </Link>
      </header>
      )}
      <main className={sinEncabezado ? 'wrap stack sin-encabezado' : 'wrap stack'}>{children}</main>
      <footer className="wrap" />
    </>
  );
}

export function ErrorCarga() {
  return (
    <div className="panel">
      <p className="err">No se pudo cargar.</p>
      <p className="hint">Revisa tu conexión y vuelve a abrir el link.</p>
    </div>
  );
}
