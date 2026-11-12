import { useState } from 'react';
import { dinero, enlaceWhatsApp, formatearTelefono, mensajeTicket, type DatosTicket } from '@pato/shared';
import { BotonCopiar } from '@pato/ui';

// Abre la app de Nequi en Android (por su paquete). Si no está instalada, va a la tienda.
// Nequi no publica un enlace oficial para abrir la app con el valor ya escrito, por eso el cliente pega número y valor.
const ENLACE_NEQUI_ANDROID =
  'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.nequi.MobileApp;S.browser_fallback_url=' +
  encodeURIComponent('https://play.google.com/store/apps/details?id=com.nequi.MobileApp') +
  ';end';

const agente = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
const esAndroid = () => /Android/i.test(agente());
// iPadOS se presenta como Mac con pantalla táctil.
const esIOS = () => /iPhone|iPad|iPod/i.test(agente()) || (/Macintosh/.test(agente()) && navigator.maxTouchPoints > 1);

// En iPhone Nequi no publica un enlace para abrir la app: la ficha de App Store muestra "Abrir" si ya está instalada.
const ENLACE_NEQUI_IOS = 'https://apps.apple.com/co/app/nequi-colombia/id1075378688';
/** Enlace para abrir Nequi según el celular; vacío en computador. */
const enlaceNequi = () => (esAndroid() ? ENLACE_NEQUI_ANDROID : esIOS() ? ENLACE_NEQUI_IOS : '');



function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z" />
    </svg>
  );
}

/** Botón principal: abre el chat del recaudador con el ticket ya escrito. */
export function BotonFinalizar({
  whatsapp,
  ticket,
  plantilla = '',
  texto = 'Finalizar y enviar mi ticket',
}: {
  whatsapp: string;
  ticket: DatosTicket;
  /** Mensaje del ticket configurado en el panel; vacío = el predeterminado. */
  plantilla?: string;
  texto?: string;
}) {
  return (
    <a className="btn btn-primary btn-block btn-wa" href={enlaceWhatsApp(whatsapp, mensajeTicket(ticket, plantilla))} target="_blank" rel="noopener">
      <IconoWhatsApp />
      {texto}
    </a>
  );
}

/** Datos para pagar por Nequi: copiar número y valor, abrir la app y los pasos. */
export function PagoNequi({ nequi, titular, total }: { nequi: string; titular: string; total: number }) {
  const [intento, setIntento] = useState(false);
  return (
    <div className="pago-nequi stack">
      <div className="pn-fila">
        <div>
          <small>Número Nequi</small>
          <b className="nequi-num">{formatearTelefono(nequi)}</b>
          {titular && <span className="small muted">A nombre de {titular}</span>}
        </div>
        <BotonCopiar className="btn btn-sm btn-primary" texto={nequi}>
          Copiar
        </BotonCopiar>
      </div>
      <div className="pn-fila">
        <div>
          <small>Valor exacto a enviar</small>
          <b className="pn-valor num">{dinero(total)}</b>
        </div>
        <BotonCopiar className="btn btn-sm" texto={String(total)}>
          Copiar
        </BotonCopiar>
      </div>
      {enlaceNequi() && (
        <a className="btn btn-block btn-nequi" href={enlaceNequi()} onClick={() => setTimeout(() => setIntento(true), 1500)}>
          Abrir Nequi
        </a>
      )}
      {intento && <p className="hint" style={{ margin: 0 }}>Si no se abrió, busca la app Nequi en tu celular.</p>}
      <ol className="pn-pasos">
        <li>Copia el número y abre tu app <b>Nequi</b>.</li>
        <li>
          Toca <b>Envía</b>, elige enviar a un <b>Nequi</b> y pega el número.
        </li>
        <li>
          Escribe exactamente <b>{dinero(total)}</b> y confirma.
        </li>
        <li>Toma pantallazo del comprobante y mándalo en el chat de WhatsApp de tu ticket.</li>
      </ol>
    </div>
  );
}
