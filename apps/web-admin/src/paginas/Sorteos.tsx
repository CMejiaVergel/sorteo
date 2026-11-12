import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dinero, formatearFecha } from '@pato/shared';
import { portadaDe } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { Cargando, ErrorPanel } from '../componentes/Marco.tsx';

export function PaginaSorteos() {
  const q = useQuery({ queryKey: ['sorteos'], queryFn: api.sorteos });
  return (
    <>
      <div className="adm-head">
        <h2>Sorteos</h2>
        <Link className="btn btn-primary" to="/sorteos/nuevo">
          Nuevo sorteo
        </Link>
      </div>
      {q.isLoading && <Cargando />}
      {q.isError && <ErrorPanel />}
      {q.data && !q.data.length && (
        <div className="panel">
          <p>
            <b>Aún no tienes sorteos.</b>
          </p>
          <p className="muted">Crea el primero con el botón “Nuevo sorteo”.</p>
        </div>
      )}
      {q.data && q.data.length > 0 && (
        <div className="rows">
          {q.data.map((s) => (
            <div className="row" key={s.id}>
              <div className="thumb"><img src={portadaDe(s)} alt="" /></div>
              <div className="row-main">
                <b>{s.nombre}</b>
                <span className="small muted">
                  {formatearFecha(s.fecha)} · {dinero(s.valor_boleta)} · {s.ocupados}/100 ocupados
                </span>
              </div>
              {s.activo ? (
                <span className={`pill ${s.jornada}`}>{s.jornada === 'noche' ? 'Noche' : 'Día'}</span>
              ) : (
                <span className="pill off">Oculto</span>
              )}
              <div className="row-actions">
                <Link className="btn btn-sm btn-primary" to={`/sorteos/${s.id}`}>
                  Gestionar
                </Link>
                <Link className="btn btn-sm" to={`/sorteos/${s.id}/editar`}>
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
