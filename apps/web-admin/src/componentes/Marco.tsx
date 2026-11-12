import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { iniciales } from '@pato/shared';
import { useTemaNavegador } from '@pato/ui';
import { alPerderSesion, api } from '../api/cliente.ts';

export const useYo = () => useQuery({ queryKey: ['yo'], queryFn: api.yo, staleTime: 0 });
export const useAjustes = () => useQuery({ queryKey: ['ajustes'], queryFn: api.ajustes });

/** Enlace al sitio público (para "Ver como cliente" y "Copiar link"). */
export function usePublico() {
  const { data } = useYo();
  return (ruta: string) => (data?.public_origin ?? '') + ruta;
}

const PESTANAS: [string, string][] = [
  ['/sorteos', 'Sorteos'],
  ['/contactos', 'Contactos'],
  ['/ruleta', 'Tragamonedas'],
  ['/diseno', 'Diseño'],
  ['/seguridad', 'Seguridad'],
  ['/ajustes', 'Ajustes'],
];

/** Exige sesión válida; si no hay, lleva al login. */
export function Protegido({ sinMarco = false, children }: { sinMarco?: boolean; children?: ReactNode }) {
  const yo = useYo();
  const navegar = useNavigate();
  const lugar = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    const fuera = () => {
      qc.clear();
      navegar('/login', { replace: true });
    };
    alPerderSesion.addEventListener('401', fuera);
    return () => alPerderSesion.removeEventListener('401', fuera);
  }, [navegar, qc]);
  if (yo.isLoading) return <p className="wrap muted cargando">Cargando…</p>;
  if (yo.isError) return <Navigate to="/login" replace state={{ desde: lugar.pathname }} />;
  if (sinMarco) return <>{children}</>;
  return (
    <MarcoPanel>
      <Outlet />
    </MarcoPanel>
  );
}

function MarcoPanel({ children }: { children: ReactNode }) {
  useTemaNavegador('#F1F4EF');
  const { data: aj } = useAjustes();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const publico = usePublico();
  const lugar = useLocation();
  const [saliendo, setSaliendo] = useState(false);
  const negocio = aj?.negocio ?? 'El Pato de la Suerte';
  // Alertas de seguridad sin ver: se revisa cada 30 s para mostrar el número en la pestaña.
  const alertas = useQuery({ queryKey: ['pendientes'], queryFn: api.alertasPendientes, refetchInterval: 30_000 });
  const pendientes = alertas.data?.pendientes ?? 0;
  return (
    <>
      <header className="wrap top">
        <NavLink className="brand" to="/sorteos">
          <span className="brand-mark">{iniciales(negocio)}</span>
          {negocio}
        </NavLink>
      </header>
      <main className="wrap stack">
        <div className="adm-head">
          <h1>Administrar</h1>
          <button
            className="btn btn-sm"
            disabled={saliendo}
            onClick={async () => {
              setSaliendo(true);
              try {
                await api.logout();
              } finally {
                qc.clear();
                navegar('/login', { replace: true });
              }
            }}
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="tabs" aria-label="Secciones">
          {PESTANAS.map(([to, t]) => (
            <NavLink key={to} to={to} className="tab">
              {t}
              {to === '/seguridad' && pendientes > 0 && (
                <span className="tab-badge" aria-label={`${pendientes} alertas sin ver`}>
                  {pendientes}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {pendientes > 0 && !lugar.pathname.startsWith('/seguridad') && (
          <NavLink to="/seguridad" className="aviso-seguridad">
            ⚠️ {pendientes === 1 ? 'Hay 1 alerta de seguridad' : `Hay ${pendientes} alertas de seguridad`}: alguien podría estar acaparando números. Toca para revisar.
          </NavLink>
        )}
        <section className="stack">{children}</section>
      </main>
      <footer className="wrap">
        <a href={publico('/sorteos')} target="_blank" rel="noopener">
          Ver página de clientes
        </a>
      </footer>
    </>
  );
}

export function Cargando() {
  return <p className="muted">Cargando…</p>;
}

export function ErrorPanel({
  mensaje = 'No se pudo cargar. Revisa tu conexión e intenta de nuevo.',
}: {
  mensaje?: string;
}) {
  return <p className="err">{mensaje}</p>;
}
