import { useState } from 'react';
import {
  dinero,
  dosDigitos,
  enlaceWhatsApp,
  estadoPago,
  formatearTelefono,
  mensajeCobro,
  type Persona,
  type Sorteo,
} from '@pato/shared';
import { BotonCopiar, BotonDobleToque } from '@pato/ui';

export interface AccionesFila {
  pagar: (telefono: string, pagado: boolean, numeros?: number[]) => Promise<unknown>;
  liberar: (telefono: string, numeros: number[]) => Promise<unknown>;
  agregar: (p: { telefono: string; nombre: string }, fijo: boolean) => void;
}

/**
 * Una persona del sorteo: cobrar, copiar mensaje, marcar pagos (todo o por número) y liberar números
 * puntuales. El cobro solo incluye los números que faltan por pagar.
 */
export function FilaParticipante({
  g,
  s,
  plantilla,
  ocupado,
  acciones,
}: {
  g: Persona;
  s: Sorteo;
  plantilla: string;
  ocupado: boolean;
  acciones: AccionesFila;
}) {
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const estado = estadoPago(g.numeros, g.pagados);
  const pendientes = g.numeros.filter((n) => !g.pagados.includes(n));
  const msg = mensajeCobro(plantilla, s, { nombre: g.nombre, numeros: pendientes.length ? pendientes : g.numeros });
  const elegidos = sel.filter((n) => g.numeros.includes(n));
  const hecho = (p: Promise<unknown>) => p.then(() => setSel([]));

  return (
    <div className="row fila-persona">
      <div className="row-main">
        <b>
          {g.nombre}{' '}
          {g.fijo && (
            <span className="pill" style={{ marginLeft: 4 }}>
              Fijo
            </span>
          )}
        </b>
        <span className="small muted num">
          {formatearTelefono(g.telefono)} · {dinero(g.numeros.length * s.valor_boleta)}
          {estado === 'parcial' && ` · debe ${dinero(pendientes.length * s.valor_boleta)}`}
        </span>
        <div className="nums-pago" aria-label="Números">
          {g.numeros.map((n) => {
            const pag = g.pagados.includes(n);
            return abierto ? (
              <button
                type="button"
                key={n}
                className={pag ? 'pag' : ''}
                aria-pressed={elegidos.includes(n)}
                aria-label={`${dosDigitos(n)} ${pag ? 'pagado' : 'por pagar'}`}
                onClick={() => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))}
              >
                {dosDigitos(n)}
              </button>
            ) : (
              <span key={n} className={pag ? 'pag' : ''} title={pag ? 'Pagado' : 'Por pagar'}>
                {dosDigitos(n)}
              </span>
            );
          })}
        </div>
      </div>
      <span className={`state ${estado === 'pagado' ? 'pag' : estado === 'parcial' ? 'parcial' : ''}`}>
        {estado === 'pagado'
          ? 'Pagado'
          : estado === 'parcial'
            ? `Parcial · ${g.pagados.length} de ${g.numeros.length}`
            : 'Por pagar'}
      </span>
      <div className="row-actions">
        {estado !== 'pagado' && (
          <a className="btn btn-sm" target="_blank" rel="noopener" href={enlaceWhatsApp(g.telefono, msg)}>
            Cobrar
          </a>
        )}
        <BotonCopiar className="btn btn-sm" texto={msg}>
          Copiar mensaje
        </BotonCopiar>
        <button
          className="btn btn-sm"
          disabled={ocupado}
          onClick={() => acciones.pagar(g.telefono, estado !== 'pagado')}
        >
          {estado === 'pagado' ? 'Marcar por pagar' : 'Pagó todo'}
        </button>
        <button className="btn btn-sm" aria-expanded={abierto} onClick={() => (setAbierto(!abierto), setSel([]))}>
          {abierto ? 'Cerrar' : 'Pago parcial o liberar'}
        </button>
      </div>
      {abierto && (
        <div className="fila-extra stack">
          <p className="small muted">
            Toca los números y elige qué hacer con ellos. Verde = pagado.{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => setSel(elegidos.length === g.numeros.length ? [] : g.numeros)}
            >
              {elegidos.length === g.numeros.length ? 'Quitar selección' : 'Elegir todos'}
            </button>
          </p>
          <div className="row-actions">
            <button
              className="btn btn-sm btn-primary"
              disabled={ocupado || !elegidos.length}
              onClick={() => hecho(acciones.pagar(g.telefono, true, elegidos))}
            >
              Marcar pagados{elegidos.length ? ` (${elegidos.length})` : ''}
            </button>
            <button
              className="btn btn-sm"
              disabled={ocupado || !elegidos.length}
              onClick={() => hecho(acciones.pagar(g.telefono, false, elegidos))}
            >
              Marcar por pagar
            </button>
            <BotonDobleToque
              className="btn btn-sm btn-danger"
              disabled={ocupado || !elegidos.length}
              confirmar={`¿Liberar ${elegidos.map(dosDigitos).join(', ')}? Toca otra vez`}
              accion={() => hecho(acciones.liberar(g.telefono, elegidos))}
            >
              Liberar{elegidos.length ? ` (${elegidos.length})` : ''}
            </BotonDobleToque>
            <button
              className="btn btn-sm"
              onClick={() => acciones.agregar({ telefono: g.telefono, nombre: g.nombre }, g.fijo)}
            >
              Agregar números
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
