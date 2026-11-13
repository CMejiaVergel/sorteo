import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dinero, dosDigitos, enlaceWhatsApp, estadoPago, formatearFecha, formatearTelefono } from '@pato/shared';
import { BotonCopiar, Portada } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { useConfig } from './comunes.tsx';
import { BotonFinalizar } from './Pago.tsx';

const ESTADO = {
  pagado: ['pag', 'Pagado'],
  pendiente: ['pend', 'Pendiente'],
  parcial: ['parcial', 'Pago parcial'],
} as const;

/** Resultados de "Mis números" para un celular válido (también se usa dentro del menú). */
export function ResultadosMisNumeros({ tel }: { tel: string }) {
  const { data: cfg } = useConfig();
  const q = useQuery({ queryKey: ['mis-numeros', tel], queryFn: () => api.misNumeros(tel), staleTime: 0 });
  if (q.isLoading) return <p className="muted">Buscando…</p>;
  if (q.isError || !q.data) return <p className="err">No se pudo buscar. Revisa tu internet e intenta de nuevo.</p>;
  const data = q.data;
  if (!data.sorteos.length)
    return (
      <div className="panel stack">
        <b>No tienes números apartados con el celular {formatearTelefono(tel)}.</b>
        <p className="muted">Revisa que sea el mismo celular con el que apartaste, o elige tus números ahora.</p>
        <Link className="btn btn-primary btn-block" to="/sorteos">
          Elegir un sorteo
        </Link>
      </div>
    );
  const deuda = data.sorteos.reduce((m, s) => m + (s.numeros.length - s.pagados.length) * s.valor_boleta, 0);
  const wa = cfg?.whatsapp ?? '';
  return (
    <>
      <div className={`mn-resumen ${deuda ? 'debe' : 'al-dia'}`}>
        <div>
          <small>Hola, {data.nombre}</small>
          <b>{deuda ? `Debes ${dinero(deuda)}` : 'Estás al día'}</b>
        </div>
        <span>
          {data.sorteos.length} {data.sorteos.length === 1 ? 'sorteo' : 'sorteos'}
        </span>
      </div>
      {data.sorteos.map((s) => {
        // Un sorteo gratis no tiene nada por pagar.
        const pend = s.gratis ? [] : s.numeros.filter((n) => !s.pagados.includes(n));
        const [cls, txt] = s.gratis ? ['pag', 'Gratis'] : ESTADO[estadoPago(s.numeros, s.pagados)];
        return (
          <article className="mn-card" key={s.id}>
            <div className="mn-head">
              <Portada s={s} className="mn-thumb" />
              <div className="mn-info">
                <h3>{s.nombre}</h3>
                <span className="small muted">
                  {formatearFecha(s.fecha)}
                  {s.hora ? ' · ' + s.hora : ''}
                </span>
              </div>
              <span className={`mn-estado ${cls}`}>{txt}</span>
            </div>
            <div className="chips">
              {s.numeros.map((n) => (
                <span key={n} className={`chip ${s.pagados.includes(n) ? 'chip-pag' : ''}`}>
                  {dosDigitos(n)}
                </span>
              ))}
            </div>
            <dl className="t-rows">
              <dt>Total</dt>
              <dd>{s.gratis ? 'Gratis' : dinero(s.numeros.length * s.valor_boleta)}</dd>
              {pend.length > 0 && (
                <>
                  <dt>Por pagar</dt>
                  <dd className="mn-debe">{dinero(pend.length * s.valor_boleta)}</dd>
                </>
              )}
            </dl>
            {pend.length > 0 && s.nequi && (
              <div className="mn-pago">
                <div>
                  <small>Nequi{s.nequi_titular ? ' · ' + s.nequi_titular : ''}</small>
                  <b className="num">{formatearTelefono(s.nequi)}</b>
                </div>
                <BotonCopiar className="btn btn-sm btn-primary" texto={s.nequi}>
                  Copiar
                </BotonCopiar>
              </div>
            )}
            {pend.length > 0 && (s.nequi || wa) && (
              <BotonFinalizar
                plantilla={cfg?.plantilla_ticket}
                whatsapp={s.nequi || wa}
                texto="Enviar ticket y comprobante"
                ticket={{
                  negocio: cfg?.negocio ?? 'El Pato de la Suerte',
                  nombre: data.nombre,
                  telefono: tel,
                  sorteo: s.nombre,
                  fecha: s.fecha,
                  hora: s.hora,
                  numeros: pend,
                  valor_boleta: s.valor_boleta,
                  nequi: s.nequi,
                  nequi_titular: s.nequi_titular,
                }}
              />
            )}
          </article>
        );
      })}
      <p className="hint">
        Los números en verde ya están pagados. Si pagaste hace poco y aún sale pendiente, espera a que confirmemos tu
        pago.
      </p>
    </>
  );
}
