import { useRef, useState } from 'react';
import {
  ENCABEZADO_LISTA,
  listaWhatsApp,
  NO_PAGADO,
  PAGADO,
  VARIABLES_LISTA,
  type Reserva,
  type Sorteo,
} from '@pato/shared';
import { avisar, BotonCopiar } from '@pato/ui';
import { api } from '../api/cliente.ts';

/**
 * Lista final para pegar en el grupo de WhatsApp. ✅ sale sola en lo pagado; ❌ en lo pendiente solo si el
 * administrador la pide (a algunos les molesta). Encabezado y final propios de cada sorteo, con variables.
 */
export function ListaGrupo({
  s,
  reservas,
  alGuardar,
}: {
  s: Sorteo;
  reservas: Reserva[];
  alGuardar: (s: Sorteo) => void;
}) {
  const [marcar, setMarcar] = useState(false);
  const [libres, setLibres] = useState(false);
  const [encabezado, setEncabezado] = useState(s.lista_encabezado);
  const [pie, setPie] = useState(s.lista_pie);
  const [guardando, setGuardando] = useState(false);
  const enfocado = useRef<HTMLTextAreaElement | null>(null);
  const refEnc = useRef<HTMLTextAreaElement>(null);
  const refPie = useRef<HTMLTextAreaElement>(null);

  const texto = listaWhatsApp({ ...s, lista_encabezado: encabezado, lista_pie: pie }, reservas, {
    marcarNoPagados: marcar,
    incluirLibres: libres,
  });
  const pendientes = !s.gratis && reservas.some((r) => !r.pagado);
  const cambiado = encabezado !== s.lista_encabezado || pie !== s.lista_pie;

  /** Pone la variable donde está el cursor del campo que se estaba editando (el encabezado si ninguno). */
  const insertar = (v: string) => {
    const el = enfocado.current ?? refEnc.current;
    if (!el) return;
    const [a, b] = [el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length];
    const nuevo = el.value.slice(0, a) + v + el.value.slice(b);
    (el === refPie.current ? setPie : setEncabezado)(nuevo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + v.length, a + v.length);
    });
  };

  async function guardar() {
    setGuardando(true);
    try {
      const r = await api.editarSorteo(s.id, { lista_encabezado: encabezado.trim(), lista_pie: pie.trim() });
      alGuardar(r.sorteo);
      setEncabezado(r.sorteo.lista_encabezado);
      setPie(r.sorteo.lista_pie);
      avisar('Encabezado y final guardados');
    } catch (er) {
      avisar(er instanceof Error ? er.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel stack">
      <div className="adm-head">
        <h3>Lista para el grupo</h3>
        <div className="row-actions">
          {pendientes && (
            <button
              type="button"
              className={`btn btn-sm${marcar ? ' btn-quitar-x' : ''}`}
              aria-pressed={marcar}
              onClick={() => setMarcar((x) => !x)}
            >
              {marcar ? `Quitar ${NO_PAGADO} de no pagados` : `${NO_PAGADO} Marcar no pagados`}
            </button>
          )}
          <BotonCopiar className="btn btn-sm btn-primary" texto={texto}>
            Copiar lista
          </BotonCopiar>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={libres} onChange={(e) => setLibres(e.target.checked)} /> Incluir los números
        libres al final
      </label>
      <label htmlFor="g-lista" className="oculto">
        Lista para el grupo
      </label>
      <textarea id="g-lista" readOnly className="lista-grupo" value={texto} />
      <p className="hint">
        {s.gratis
          ? 'Sorteo gratis: la lista no lleva marcas de pago.'
          : `${PAGADO} sale sola al marcar el pago. Si alguien pagó una parte, la primera línea es lo pagado y la de abajo lo que falta. ${NO_PAGADO} solo aparece si tocas “Marcar no pagados”.`}
      </p>
      <details className="stack" open={!!(s.lista_encabezado || s.lista_pie) || undefined}>
        <summary className="small">Personalizar el encabezado y el final de este sorteo</summary>
        <div className="field">
          <label htmlFor="g-enc">Encabezado</label>
          <textarea
            id="g-enc"
            ref={refEnc}
            rows={2}
            style={{ minHeight: 64 }}
            placeholder={ENCABEZADO_LISTA}
            value={encabezado}
            onFocus={(e) => (enfocado.current = e.currentTarget)}
            onChange={(e) => setEncabezado(e.target.value)}
          />
          <p className="hint">Vacío = {ENCABEZADO_LISTA}</p>
        </div>
        <div className="field">
          <label htmlFor="g-pie">Final de la lista (opcional)</label>
          <textarea
            id="g-pie"
            ref={refPie}
            rows={3}
            style={{ minHeight: 80 }}
            placeholder="Ej.: Juega hoy {dia} {fecha} con la {loteria} a las {hora}. ¡Mucha suerte! 🍀"
            value={pie}
            onFocus={(e) => (enfocado.current = e.currentTarget)}
            onChange={(e) => setPie(e.target.value)}
          />
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">
            Toca una variable para ponerla donde está el cursor. En MAYÚSCULAS sale el dato en mayúsculas.
          </span>
          <div className="chips-variables">
            {VARIABLES_LISTA.map((v) => (
              <button
                key={v}
                type="button"
                className="chip-var"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertar(`{${v}}`)}
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || !cambiado}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Guardar encabezado y final'}
          </button>
          {cambiado && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEncabezado(s.lista_encabezado);
                setPie(s.lista_pie);
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
