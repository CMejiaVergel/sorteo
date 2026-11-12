import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatearTelefono, hoyBogota, mensajeCobro, mensajeTicket, normalizarTelefono, PLANTILLA_BASE, PLANTILLA_TICKET, VARIABLES_TICKET } from '@pato/shared';
import { avisar } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { Cargando, ErrorPanel, useAjustes } from '../componentes/Marco.tsx';

const EJEMPLO_SORTEO = { jornada: 'dia', valor_boleta: 5000, nombre: 'Paisita Día', fecha: hoyBogota(new Date()), nequi: '3001234567', nequi_titular: 'Miguel' };
const EJEMPLO_PERSONA = { nombre: 'Carlos', numeros: [5, 7, 99] };

export function PaginaAjustes() {
  const qc = useQueryClient();
  const q = useAjustes();
  const [negocio, setNegocio] = useState('');
  const [wa, setWa] = useState('');
  const [plantilla, setPlantilla] = useState(PLANTILLA_BASE);
  const [ticket, setTicket] = useState(PLANTILLA_TICKET);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!q.data) return;
    setNegocio(q.data.negocio);
    setWa(formatearTelefono(q.data.whatsapp));
    setPlantilla(q.data.plantilla || PLANTILLA_BASE);
    setTicket(q.data.plantilla_ticket || PLANTILLA_TICKET);
  }, [q.data]);
  if (q.isError) return <ErrorPanel />;
  if (!q.data) return <Cargando />;

  const ejemploTicket = mensajeTicket(
    {
      negocio: negocio || 'El Pato de la Suerte',
      nombre: 'Carlos Díaz',
      telefono: '3109876543',
      sorteo: EJEMPLO_SORTEO.nombre,
      fecha: EJEMPLO_SORTEO.fecha,
      hora: '2:30 p. m.',
      numeros: EJEMPLO_PERSONA.numeros,
      valor_boleta: EJEMPLO_SORTEO.valor_boleta,
      nequi: EJEMPLO_SORTEO.nequi,
      nequi_titular: EJEMPLO_SORTEO.nequi_titular,
    },
    ticket,
  );

  return (
    <>
      <h2>Ajustes</h2>
      <form
        className="panel stack"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            const r = await api.guardarAjustes({
              negocio: negocio.trim() || 'El Pato de la Suerte',
              whatsapp: normalizarTelefono(wa),
              plantilla,
              // Si queda igual al predeterminado se guarda vacío: así mejoras futuras del predeterminado le llegan.
              plantilla_ticket: ticket.trim() === PLANTILLA_TICKET ? '' : ticket,
            });
            qc.setQueryData(['ajustes'], r);
            avisar('Ajustes guardados');
          } catch (er) {
            setError(er instanceof Error ? er.message : 'No se pudo guardar');
          }
        }}
      >
        <div className="grid2">
          <div className="field">
            <label htmlFor="a-neg">Nombre de tu negocio</label>
            <input id="a-neg" type="text" value={negocio} onChange={(e) => setNegocio(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-wa">WhatsApp de respaldo para tickets</label>
            <input id="a-wa" type="tel" inputMode="numeric" placeholder="300 123 4567" value={wa} onChange={(e) => setWa(e.target.value)} />
            <p className="hint">Cada sorteo envía el ticket a su propio número de cobro. Este solo se usa si un sorteo no tiene número.</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="a-tk">Mensaje del ticket (lo que el cliente envía al finalizar)</label>
          <textarea id="a-tk" style={{ minHeight: 300 }} value={ticket} onChange={(e) => setTicket(e.target.value)} />
          <p className="hint">
            Palabras que se reemplazan solas: {VARIABLES_TICKET.map((v) => `{${v}}`).join(', ')}. Las que están en MAYÚSCULAS ponen el dato en mayúsculas. Para negrita en WhatsApp
            usa *asteriscos*. Si en una línea no hay dato (por ejemplo, sin titular), esa línea no se envía.
          </p>
          <div className="row-actions">
            <button type="button" className="btn btn-sm" onClick={() => setTicket(PLANTILLA_TICKET)}>
              Volver al mensaje original
            </button>
          </div>
        </div>
        <div className="field">
          <span className="eyebrow">Así llega el ticket por WhatsApp</span>
          <pre className="code">{ejemploTicket}</pre>
        </div>

        <div className="field">
          <label htmlFor="a-pl">Mensaje de cobro (el que tú envías desde Gestionar → Cobrar)</label>
          <textarea id="a-pl" value={plantilla} onChange={(e) => setPlantilla(e.target.value)} />
          <p className="hint">
            Palabras que se reemplazan solas: {'{saludo}'} (buenos días o buenas noches según la jornada), {'{nombre}'}, {'{numeros}'}, {'{cantidad}'},{' '}
            {'{valor}'}, {'{total}'}, {'{sorteo}'}, {'{fecha}'}, {'{hora}'}, {'{nequi}'}, {'{titular}'}.
          </p>
        </div>
        <div className="field">
          <span className="eyebrow">Así se verá</span>
          <pre className="code">{mensajeCobro(plantilla, EJEMPLO_SORTEO, EJEMPLO_PERSONA)}</pre>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" type="submit">
            Guardar ajustes
          </button>
        </div>
      </form>
    </>
  );
}
