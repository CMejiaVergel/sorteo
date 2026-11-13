import { useState } from 'react';
import { formatearApertura, formatearFecha, hoyBogota, sumarDias, type Reserva, type Sorteo } from '@pato/shared';
import { avisar, BotonDobleToque } from '@pato/ui';
import { api } from '../api/cliente.ts';

/** Fecha propuesta para el nuevo sorteo: el día siguiente al actual, y nunca antes de hoy. */
function fechaSiguiente(s: Sorteo): string {
  const hoy = hoyBogota(new Date());
  const siguiente = s.fecha ? sumarDias(s.fecha, 1) : hoy;
  return siguiente < hoy ? hoy : siguiente;
}

/**
 * Al terminar el sorteo del día: deja el mismo sorteo listo para el siguiente (tablero y participantes en
 * limpio, misma configuración), con la fecha nueva y, si se quiere, la hora en que se abre solo.
 */
export function ReiniciarSorteo({
  s,
  reservas,
  alTerminar,
}: {
  s: Sorteo;
  reservas: Reserva[];
  alTerminar: (s: Sorteo) => Promise<unknown>;
}) {
  const [fecha, setFecha] = useState(() => fechaSiguiente(s));
  // La hora de apertura del día anterior se repite: normalmente se abre siempre a la misma hora.
  const [hora, setHora] = useState(() => s.abre?.slice(11) ?? '07:00');
  const [programar, setProgramar] = useState(!!s.abre);
  const [conservar, setConservar] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const fijos = reservas.filter((r) => r.tipo === 'fijo').length;
  const clientes = reservas.length - fijos;
  const abre = programar && fecha && hora ? `${fecha}T${hora}` : null;
  const borra = conservar ? clientes : reservas.length;

  return (
    <div className="panel stack reiniciar">
      <h3>Nuevo día del sorteo</h3>
      <p className="muted small">
        Cuando termine este sorteo, reinícialo para el siguiente día en vez de crear uno nuevo: queda la misma
        configuración, el tablero vuelve a quedar libre y la lista empieza vacía. Lo de hoy se guarda en el historial.
      </p>
      <div className="grid2">
        <div className="field">
          <label htmlFor="r-fecha">Día del nuevo sorteo</label>
          <input id="r-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="field">
          <label className="check" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={programar} onChange={(e) => setProgramar(e.target.checked)} /> Programar la
            hora en que se abre
          </label>
          <input
            id="r-hora"
            type="time"
            aria-label="Hora en que se abre a los clientes"
            value={hora}
            disabled={!programar}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>
      </div>
      {fijos > 0 && (
        <label className="check">
          <input type="checkbox" checked={conservar} onChange={(e) => setConservar(e.target.checked)} /> Conservar los{' '}
          {fijos} números fijos (quedan por pagar)
        </label>
      )}
      <p className="small">
        {borra ? (
          <>
            Se liberan <b>{borra}</b> {borra === 1 ? 'número' : 'números'}
            {conservar && fijos ? ` y se quedan ${fijos} fijos` : ''}.{' '}
          </>
        ) : (
          'No hay números de clientes para liberar. '
        )}
        El sorteo queda para el <b>{formatearFecha(fecha) || '—'}</b>
        {abre ? (
          <>
            {' '}
            y se abre solo el <b>{formatearApertura(abre)}</b>
          </>
        ) : (
          ' y queda abierto de una vez.'
        )}
      </p>
      <div className="row-actions">
        <BotonDobleToque
          className="btn btn-danger"
          confirmar="¿Reiniciar el tablero? Toca otra vez"
          disabled={ocupado || !fecha}
          accion={async () => {
            setOcupado(true);
            try {
              const r = await api.reiniciarSorteo(s.id, { fecha, abre, conservar_fijos: conservar });
              await alTerminar(r.sorteo);
              setFecha(fechaSiguiente(r.sorteo));
              avisar(`Listo: tablero en limpio para el ${formatearFecha(r.sorteo.fecha)}.`);
            } catch (er) {
              avisar(er instanceof Error ? er.message : 'No se pudo reiniciar');
            } finally {
              setOcupado(false);
            }
          }}
        >
          Reiniciar tablero para el nuevo día
        </BotonDobleToque>
      </div>
    </div>
  );
}
