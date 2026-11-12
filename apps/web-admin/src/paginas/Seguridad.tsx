import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { dosDigitos, formatearTelefono, type AlertaSeguridad, type DispositivoResumen } from '@pato/shared';
import { avisar, BotonDobleToque } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { ErrorPanel } from '../componentes/Marco.tsx';

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });

const TIPOS: Record<string, string> = {
  limite: 'Quiso pasar el límite',
  bloqueado: 'Un bloqueado intentó apartar',
  varios_celulares: 'Muchos celulares en un dispositivo',
  misma_red: 'Muchos números desde una misma red',
};

const RESULTADOS: Record<string, string> = {
  ok: 'Apartó',
  ocupados: 'Ya estaban ocupados',
  limite: 'Frenado por el límite',
  bloqueado: 'Frenado por bloqueo',
};

/** Código corto para reconocer un dispositivo de un vistazo. */
const corto = (id: string) => '#' + id.slice(0, 6);

export function PaginaSeguridad() {
  const qc = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [q, setQ] = useState('');
  const [foco, setFoco] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(buscar.trim()), 250);
    return () => clearTimeout(t);
  }, [buscar]);
  const datos = useQuery({ queryKey: ['seguridad', q], queryFn: () => api.seguridad(q), refetchInterval: 15_000, placeholderData: (p) => p });
  const recargar = () => Promise.all([qc.invalidateQueries({ queryKey: ['seguridad'] }), qc.invalidateQueries({ queryKey: ['pendientes'] })]);
  const d = datos.data;

  const verDispositivo = (id: string) => {
    setFoco(id);
    setBuscar('');
    setTimeout(() => document.getElementById('disp-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  return (
    <>
      <div className="adm-head">
        <h2>Seguridad</h2>
        {d && d.pendientes > 0 && <span className="pill alerta-pill">{d.pendientes} sin ver</span>}
      </div>
      <p className="muted small">
        Cada celular que aparta desde la página queda identificado (sin pedirle nada a la persona). Aquí ves desde qué dispositivo y red se apartó
        cada número, y puedes bloquear a quien intente acaparar el tablero.
      </p>
      {datos.isError && <ErrorPanel />}
      {d && <Limite actual={d.limite} alGuardar={recargar} />}

      <section className="stack">
        <div className="adm-head">
          <h3>Alertas</h3>
          {d && d.pendientes > 0 && (
            <button
              className="btn btn-sm"
              onClick={async () => {
                await api.marcarAlertasVistas();
                await recargar();
              }}
            >
              Marcar todas como vistas
            </button>
          )}
        </div>
        <div className="rows">
          {d?.alertas.length ? (
            d.alertas.map((a) => <FilaAlerta key={a.id} a={a} alVer={verDispositivo} />)
          ) : (
            <div className="row">
              <span className="muted">{datos.isLoading ? 'Cargando…' : 'Sin alertas. Todo tranquilo.'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="stack">
        <h3>Dispositivos</h3>
        <div className="field">
          <label htmlFor="s-q">Buscar</label>
          <input
            id="s-q"
            type="text"
            enterKeyHint="search"
            placeholder="Nombre, celular, IP o código (#abc123)"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value.replace(/^#/, ''))}
          />
        </div>
        <div className="rows">
          {d?.dispositivos.length ? (
            d.dispositivos.map((x) => <TarjetaDispositivo key={x.id} d={x} resaltado={foco === x.id} alCambiar={recargar} />)
          ) : (
            <div className="row">
              <span className="muted">{datos.isLoading ? 'Cargando…' : q ? 'Ningún dispositivo coincide.' : 'Todavía nadie ha apartado desde la página.'}</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Limite({ actual, alGuardar }: { actual: number; alGuardar: () => Promise<unknown> }) {
  const [v, setV] = useState(String(actual));
  const [error, setError] = useState('');
  useEffect(() => setV(String(actual)), [actual]);
  return (
    <form
      className="panel stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 100) return setError('Escribe un número de 0 a 100.');
        setError('');
        try {
          await api.guardarLimite(n);
          avisar(n ? `Límite: ${n} números por celular en cada sorteo` : 'Sin límite por celular');
          await alGuardar();
        } catch (er) {
          setError(er instanceof Error ? er.message : 'No se pudo guardar');
        }
      }}
    >
      <h3>Límite por celular</h3>
      <div className="row-limite">
        <div className="field">
          <label htmlFor="s-lim">Números por sorteo desde un mismo celular</label>
          <input id="s-lim" type="text" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={v === String(actual)}>
          Guardar
        </button>
      </div>
      <p className="hint">
        Si alguien intenta pasar de este número, la página no lo deja, le explica por qué y le ofrece un botón para pedirlos por WhatsApp con los
        números ya escritos. A ti te llega una alerta aquí. 0 = sin límite. Lo que apartas tú desde el panel no cuenta.
      </p>
      {error && <p className="err">{error}</p>}
    </form>
  );
}

function FilaAlerta({ a, alVer }: { a: AlertaSeguridad; alVer: (id: string) => void }) {
  return (
    <div className={`row alerta${a.vista ? '' : ' nueva'}`}>
      <div className="row-main">
        <b>
          {TIPOS[a.tipo] ?? a.tipo}
          {a.veces > 1 && <span className="muted"> · {a.veces} veces</span>}
        </b>
        <span className="small">{a.detalle}</span>
        <span className="small muted">
          {a.sorteo && `${a.sorteo} · `}
          {fechaHora(a.creado)}
          {a.dispositivo_id && ` · ${corto(a.dispositivo_id)}`}
        </span>
      </div>
      {a.dispositivo_id && (
        <div className="row-actions">
          <button className="btn btn-sm" onClick={() => alVer(a.dispositivo_id)}>
            Ver dispositivo
          </button>
        </div>
      )}
    </div>
  );
}

function TarjetaDispositivo({ d, resaltado, alCambiar }: { d: DispositivoResumen; resaltado: boolean; alCambiar: () => Promise<unknown> }) {
  const [bloqueando, setBloqueando] = useState(false);
  const [verIntentos, setVerIntentos] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [liberar, setLiberar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const sinPagar = d.sorteos.reduce((t, s) => t + s.numeros.length - s.pagados, 0);
  const intentos = useQuery({ queryKey: ['intentos', d.id], queryFn: () => api.intentos(d.id), enabled: verIntentos });

  async function cambiar(bloqueado: boolean) {
    setOcupado(true);
    try {
      const r = await api.bloquear(d.id, { bloqueado, motivo: motivo.trim(), liberar: bloqueado && liberar });
      avisar(bloqueado ? `Dispositivo bloqueado${r.liberados ? ` · ${r.liberados} números liberados` : ''}` : 'Dispositivo desbloqueado');
      setBloqueando(false);
      await alCambiar();
    } catch (er) {
      avisar(er instanceof Error ? er.message : 'No se pudo cambiar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div id={'disp-' + d.id} className={`row disp${d.bloqueado ? ' bloq' : ''}${resaltado ? ' foco' : ''}`}>
      <div className="row-main">
        <b>
          {d.descripcion} <span className="muted num">{corto(d.id)}</span>{' '}
          <span className={`state ${d.bloqueado ? 'bloq' : 'neutro'}`}>
            {d.bloqueado ? 'Bloqueado' : `${d.apartados} ${d.apartados === 1 ? 'número' : 'números'}`}
          </span>
        </b>
        <span className="small muted num">
          Red {d.ip || '—'} · visto {fechaHora(d.visto)}
        </span>
        {d.bloqueado && (
          <span className="small err">
            Bloqueado {d.bloqueado_en ? fechaHora(d.bloqueado_en) : ''}
            {d.motivo && ` · ${d.motivo}`}
          </span>
        )}
        {d.personas.length > 0 && (
          <span className="small">
            A nombre de: {d.personas.map((p) => `${p.nombre} (${formatearTelefono(p.telefono)})`).join(', ')}
          </span>
        )}
        {d.sorteos.map((s) => (
          <span key={s.sorteo_id} className="small">
            <b>{s.nombre}:</b> <span className="num">{s.numeros.map(dosDigitos).join(', ')}</span>
            {s.pagados > 0 && <span className="muted"> · {s.pagados} pagados</span>}
          </span>
        ))}
        {d.rechazados > 0 && <span className="small muted">{d.rechazados} {d.rechazados === 1 ? 'intento frenado' : 'intentos frenados'}</span>}
      </div>
      <div className="row-actions">
        {d.bloqueado ? (
          <BotonDobleToque className="btn btn-sm" disabled={ocupado} confirmar="¿Desbloquear? Toca otra vez" accion={() => cambiar(false)}>
            Desbloquear
          </BotonDobleToque>
        ) : (
          <button className="btn btn-sm btn-danger" aria-expanded={bloqueando} onClick={() => setBloqueando(!bloqueando)}>
            {bloqueando ? 'Cancelar' : 'Bloquear'}
          </button>
        )}
        <button className="btn btn-sm" aria-expanded={verIntentos} onClick={() => setVerIntentos(!verIntentos)}>
          {verIntentos ? 'Ocultar intentos' : 'Ver intentos'}
        </button>
      </div>
      {bloqueando && !d.bloqueado && (
        <div className="fila-extra stack">
          <p className="small">Desde este dispositivo ya no se podrá apartar en la página. La persona verá un mensaje para escribir por WhatsApp.</p>
          <div className="field">
            <label htmlFor={'m-' + d.id}>Motivo (solo lo ves tú)</label>
            <input id={'m-' + d.id} type="text" maxLength={200} placeholder="Apartó 40 números sin pagar" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {sinPagar > 0 && (
            <label className="check">
              <input type="checkbox" checked={liberar} onChange={(e) => setLiberar(e.target.checked)} />
              Liberar también {sinPagar === 1 ? 'su número' : `sus ${sinPagar} números`} sin pagar (quedan en “Números liberados”)
            </label>
          )}
          <div className="row-actions">
            <button className="btn btn-sm btn-danger" disabled={ocupado} onClick={() => cambiar(true)}>
              Confirmar bloqueo
            </button>
          </div>
        </div>
      )}
      {verIntentos && (
        <div className="fila-extra stack">
          {intentos.isLoading && <p className="small muted">Cargando…</p>}
          {intentos.data?.length === 0 && <p className="small muted">Sin intentos registrados.</p>}
          {intentos.data?.map((i) => (
            <p key={i.id} className="small">
              <span className="muted">{fechaHora(i.creado)}</span> · {RESULTADOS[i.resultado] ?? i.resultado} · {i.sorteo || 'sorteo borrado'} ·{' '}
              <span className="num">{i.numeros.map(dosDigitos).join(', ')}</span> · {i.nombre} ({formatearTelefono(i.telefono)})
            </p>
          ))}
          <p className="small muted" style={{ wordBreak: 'break-word' }}>
            Navegador: {d.agente || '—'}
          </p>
        </div>
      )}
    </div>
  );
}
