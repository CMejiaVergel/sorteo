import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  agruparPorPersona,
  dinero,
  dosDigitos,
  formatearFecha,
  formatearTelefono,
  formatearApertura,
  sorteoAbierto,
  nombresRepetidos,
  PLANTILLA_BASE,
  type Sorteo,
} from '@pato/shared';
import { avisar, BotonCopiar, BotonDobleToque } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { Cargando, ErrorPanel, useAjustes, usePublico } from '../componentes/Marco.tsx';
import { VentanaImagen } from '../componentes/VentanaImagen.tsx';
import { ApartarNumeros, type Prellenado } from '../componentes/ApartarNumeros.tsx';
import { ListaGrupo } from '../componentes/ListaGrupo.tsx';
import { ReiniciarSorteo } from '../componentes/ReiniciarSorteo.tsx';
import { FilaParticipante, type AccionesFila } from '../componentes/FilaParticipante.tsx';

// Avisos de fijos que no se agregaron, para mostrarlos al llegar a la gestión.
let avisosPendientes: string[] = [];
export const guardarAvisos = (a: string[]) => void (avisosPendientes = a);

export function PaginaGestion() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const publico = usePublico();
  const aj = useAjustes();
  const diseno = useQuery({ queryKey: ['diseno'], queryFn: api.diseno });
  const sq = useQuery({ queryKey: ['sorteo', id], queryFn: () => api.sorteo(id) });
  const rq = useQuery({ queryKey: ['reservas', id], queryFn: () => api.reservas(id) });
  const lq = useQuery({ queryKey: ['liberados', id], queryFn: () => api.liberados(id) });
  const refApartar = useRef<HTMLDivElement>(null);
  const [prellenado, setPrellenado] = useState<Prellenado | null>(null);
  const todos = useQuery({ queryKey: ['sorteos'], queryFn: api.sorteos });
  const [avisos, setAvisos] = useState<string[]>(() => avisosPendientes);
  useEffect(() => {
    avisosPendientes = [];
  }, []);
  const [fijos, setFijos] = useState('');
  const [origen, setOrigen] = useState('');
  const [ventana, setVentana] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const reservas = rq.data ?? [];
  const grupos = useMemo(() => agruparPorPersona(reservas), [reservas]);
  const ocupadosLista = useMemo(() => reservas.map((r) => r.numero), [reservas]);
  const ocupadosSet = useMemo(() => new Set(ocupadosLista), [ocupadosLista]);

  if (sq.isLoading || rq.isLoading) return <Cargando />;
  if (sq.isError || !sq.data) return <ErrorPanel mensaje="No encontré ese sorteo." />;
  const s = sq.data;
  const porNum = new Map(reservas.map((r) => [r.numero, r]));
  const pagados = reservas.filter((r) => r.pagado).length;
  const repetidos = nombresRepetidos(grupos);
  const plantilla = aj.data?.plantilla || PLANTILLA_BASE;
  const link = publico(`/sorteo/${s.id}`);
  const otros = (todos.data ?? []).filter((x) => x.id !== s.id);
  const actualizarSorteo = (nuevo: Sorteo) => {
    qc.setQueryData(['sorteo', id], nuevo);
    void qc.invalidateQueries({ queryKey: ['sorteos'] });
  };
  const recargar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['reservas', id] }),
      qc.invalidateQueries({ queryKey: ['liberados', id] }),
      qc.invalidateQueries({ queryKey: ['sorteos'] }),
      qc.invalidateQueries({ queryKey: ['contactos'] }),
    ]);
  // Liberados que siguen libres (los que alguien volvió a apartar ya no se ofrecen).
  const liberadosLibres = (lq.data ?? []).filter(
    (l, i, a) => !ocupadosSet.has(l.numero) && a.findIndex((x) => x.numero === l.numero) === i,
  );
  const textoLiberados = `${s.nombre} · ${formatearFecha(s.fecha)}${s.hora ? ' · ' + s.hora : ''}\nNúmeros disponibles otra vez: ${[
    ...liberadosLibres,
  ]
    .sort((a, b) => a.numero - b.numero)
    .map((l) => dosDigitos(l.numero))
    .join('-')}`;

  const acciones: AccionesFila = {
    pagar: (tel, pagado, numeros) =>
      conCarga(async () => {
        await api.marcarPago(id, tel, pagado, numeros);
        avisar(
          pagado
            ? numeros
              ? `${numeros.length} número(s) marcados pagados`
              : 'Marcado como pagado'
            : 'Marcado por pagar',
        );
        await recargar();
      }),
    liberar: (tel, numeros) =>
      conCarga(async () => {
        const r = await api.liberar(id, tel, numeros);
        avisar(`${r.liberadas} número(s) liberados. Quedan en “Números liberados”.`);
        await recargar();
      }),
    agregar: (persona, fijo) => {
      setPrellenado({ persona, fijo, clave: Date.now() });
      refApartar.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };

  async function conCarga(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
    } catch (er) {
      avisar(er instanceof Error ? er.message : 'Algo salió mal');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Link className="link-btn" to="/sorteos" style={{ alignSelf: 'flex-start' }}>
        ← Volver a sorteos
      </Link>
      <div className="adm-head">
        <div>
          <h2>{s.nombre}</h2>
          <p className="muted small">
            {formatearFecha(s.fecha)}
            {s.hora ? ' · ' + s.hora : ''} · {s.gratis ? <b>gratis</b> : `${dinero(s.valor_boleta)} la boleta`}
            {s.max_por_celular > 0 && ` · máx. ${s.max_por_celular} por persona`} {!s.activo && <b>· oculto</b>}
          </p>
          {s.activo && !sorteoAbierto(s, new Date()) && (
            <p className="small">
              <span className="pill">Programado</span> Se abre a los clientes el <b>{formatearApertura(s.abre)}</b>
            </p>
          )}
        </div>
        <div className="row-actions">
          <button className="btn btn-sm btn-sun" onClick={() => setVentana(true)}>
            Imagen del tablero
          </button>
          <BotonCopiar className="btn btn-sm btn-primary" texto={link}>
            Copiar link del sorteo
          </BotonCopiar>
          <Link className="btn btn-sm" to={`/sorteos/${s.id}/editar`}>
            Editar
          </Link>
          <a className="btn btn-sm" href={link} target="_blank" rel="noopener">
            Ver como cliente
          </a>
        </div>
      </div>
      {avisos.length > 0 && (
        <div className="warn">
          <b>Avisos:</b>
          {avisos.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      )}
      <div className="stats">
        <div className="stat">
          <small>Ocupados</small>
          <b>{reservas.length}/100</b>
        </div>
        {s.gratis ? (
          <div className="stat">
            <small>Libres</small>
            <b>{100 - reservas.length}</b>
          </div>
        ) : (
          <>
            <div className="stat">
              <small>Pagado</small>
              <b>{dinero(pagados * s.valor_boleta)}</b>
            </div>
            <div className="stat">
              <small>Por cobrar</small>
              <b>{dinero((reservas.length - pagados) * s.valor_boleta)}</b>
            </div>
          </>
        )}
        <div className="stat">
          <small>Personas</small>
          <b>{grupos.length}</b>
        </div>
      </div>
      <div className="panel stack">
        <div className="adm-head">
          <h3>Tablero</h3>
          <div className="legend">
            <span>
              <i />
              Libre
            </span>
            <span>
              <i className="l-sel" />
              Por pagar
            </span>
            <span>
              <i style={{ background: 'var(--green)', borderColor: 'var(--green)' }} />
              Pagado
            </span>
            <span>
              <i style={{ background: 'var(--cab)', borderColor: 'var(--cab)' }} />
              Fijo
            </span>
          </div>
        </div>
        <div className="mini">
          {Array.from({ length: 100 }, (_, n) => {
            const r = porNum.get(n);
            const c = !r ? '' : r.pagado ? 'pag' : r.tipo === 'fijo' ? 'fijo' : 'pend';
            return (
              <span key={n} className={c} title={r ? r.nombre : 'Libre'}>
                {dosDigitos(n)}
              </span>
            );
          })}
        </div>
      </div>
      <ApartarNumeros
        ref={refApartar}
        sorteoId={s.id}
        valorBoleta={s.valor_boleta}
        ocupados={ocupadosSet}
        prellenado={prellenado}
        alTerminar={recargar}
      />
      <div className="panel stack">
        <h3>Más opciones de fijos</h3>
        <details className="stack">
          <summary className="small">Pegar varios fijos a la vez (texto)</summary>
          <p className="muted small">
            Una persona por línea: <b>01-02-03 Miguel 3001234567</b>.
          </p>
          <label htmlFor="g-fijos" className="oculto">
            Números fijos
          </label>
          <textarea
            id="g-fijos"
            placeholder="01-02-03 Miguel 3001234567"
            value={fijos}
            onChange={(e) => setFijos(e.target.value)}
          />
          <div className="row-actions">
            <button
              className="btn btn-primary"
              disabled={ocupado || !fijos.trim()}
              onClick={() =>
                conCarga(async () => {
                  const r = await api.fijos(id, fijos);
                  setAvisos(r.errores);
                  setFijos(r.errores.length ? fijos : '');
                  avisar(`${r.agregadas} persona(s) agregada(s)`);
                  await recargar();
                })
              }
            >
              Agregar fijos
            </button>
          </div>
        </details>
        {otros.length > 0 && (
          <div className="grid2" style={{ alignItems: 'end' }}>
            <div className="field">
              <label htmlFor="g-src">Copiar los fijos de otro sorteo</label>
              <select id="g-src" value={origen || otros[0].id} onChange={(e) => setOrigen(e.target.value)}>
                {otros.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre} · {formatearFecha(x.fecha)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn"
              disabled={ocupado}
              onClick={() =>
                conCarga(async () => {
                  const r = await api.copiarFijos(id, origen || otros[0].id);
                  setAvisos(r.saltados);
                  avisar(r.personas ? `${r.copiadas} fijo(s) copiado(s)` : 'Ese sorteo no tiene fijos');
                  await recargar();
                })
              }
            >
              Copiar fijos
            </button>
          </div>
        )}
      </div>
      <div className="stack">
        <div className="adm-head">
          <h3>Participantes</h3>
          <Link className="link-btn small" to="/ajustes">
            Editar mensaje de cobro
          </Link>
        </div>
        {repetidos.length > 0 && (
          <div className="warn">
            Hay nombres iguales con celulares distintos: <b>{repetidos.join(', ')}</b>. Revisa si es la misma persona o
            agrega el apellido.
          </div>
        )}
        {grupos.length ? (
          <div className="rows">
            {grupos.map((g) => (
              <FilaParticipante
                key={g.telefono}
                g={g}
                s={s}
                plantilla={plantilla}
                ocupado={ocupado}
                acciones={acciones}
              />
            ))}
          </div>
        ) : (
          <div className="panel">
            <p className="muted">Aún nadie ha apartado números. Comparte el link del sorteo en tus grupos.</p>
          </div>
        )}
      </div>
      <div className="panel stack">
        <div className="adm-head">
          <h3>Números liberados</h3>
          {liberadosLibres.length > 0 && (
            <BotonCopiar className="btn btn-sm btn-primary" texto={textoLiberados}>
              Copiar para ofrecerlos
            </BotonCopiar>
          )}
        </div>
        {liberadosLibres.length ? (
          <>
            <div className="rows">
              {liberadosLibres.map((l) => (
                <div className="row" key={l.id}>
                  <span className="chip">{dosDigitos(l.numero)}</span>
                  <div className="row-main">
                    <b>Era de {l.nombre}</b>
                    <span className="small muted num" style={{ display: 'block' }}>
                      {formatearTelefono(l.telefono)} · liberado{' '}
                      {new Date(l.liberado).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {l.pagado ? ' · estaba pagado' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="row-actions">
              <BotonDobleToque
                className="btn btn-sm"
                accion={() =>
                  conCarga(async () => {
                    await api.limpiarLiberados(id);
                    await recargar();
                  })
                }
              >
                Limpiar historial
              </BotonDobleToque>
            </div>
          </>
        ) : (
          <p className="muted small">
            Cuando liberes números aparecerán aquí para que los vuelvas a ofrecer. Si alguien los aparta, salen solos de
            la lista.
          </p>
        )}
      </div>
      <ListaGrupo key={s.id} s={s} reservas={reservas} alGuardar={actualizarSorteo} />
      <ReiniciarSorteo
        key={`r-${s.id}-${s.fecha}`}
        s={s}
        reservas={reservas}
        alTerminar={async (nuevo) => {
          actualizarSorteo(nuevo);
          await recargar();
        }}
      />
      {ventana && (
        <VentanaImagen
          sorteo={s}
          ocupados={ocupadosLista}
          negocio={aj.data?.negocio ?? ''}
          whatsapp={aj.data?.whatsapp ?? ''}
          tapaGeneral={diseno.data?.tablero.logoOcupado ?? null}
          link={link}
          alCerrar={() => setVentana(false)}
          alCambiarSorteo={(nuevo: Sorteo) => qc.setQueryData(['sorteo', id], nuevo)}
        />
      )}
    </>
  );
}
