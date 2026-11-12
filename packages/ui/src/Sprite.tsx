/**
 * Ilustraciones originales de la proforma base (moneda, trébol, herradura, siete y diamante),
 * extraídas tal cual del prototipo como símbolos SVG. Se montan una vez por aplicación.
 */
const SPRITE = `
<defs>
  <radialGradient id="g-oro" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF6BF"/><stop offset=".45" stop-color="#F7C63C"/><stop offset="1" stop-color="#B06F08"/></radialGradient>
  <linearGradient id="g-oro-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE98A"/><stop offset=".55" stop-color="#E9A817"/><stop offset="1" stop-color="#9A5E05"/></linearGradient>
  <radialGradient id="g-verde" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#B5F58A"/><stop offset=".5" stop-color="#3EC24D"/><stop offset="1" stop-color="#11652A"/></radialGradient>
  <linearGradient id="g-rojo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A86"/><stop offset=".5" stop-color="#EA3629"/><stop offset="1" stop-color="#9B1212"/></linearGradient>
  <linearGradient id="g-plata" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9D3DA"/><stop offset="1" stop-color="#6E7D88"/></linearGradient>
  <radialGradient id="g-sombra"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<symbol id="s-moneda" viewBox="0 0 100 100">
  <ellipse cx="50" cy="92" rx="30" ry="5" fill="url(#g-sombra)"/>
  <circle cx="50" cy="54" r="38" fill="#8A5200"/>
  <circle cx="50" cy="50" r="38" fill="url(#g-oro)"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#B87C12" stroke-width="3"/>
  <path d="M50 29l6.2 12.6 13.9 2-10 9.8 2.4 13.8L50 60.7l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z" fill="#E7A71E" stroke="#9A6408" stroke-width="2.2" stroke-linejoin="round"/>
  <ellipse cx="36" cy="30" rx="13" ry="6" fill="#FFFFFF" opacity=".6" transform="rotate(-30 36 30)"/>
</symbol>
<symbol id="s-trebol" viewBox="0 0 100 100">
  <ellipse cx="54" cy="92" rx="28" ry="5" fill="url(#g-sombra)"/>
  <path d="M52 56c4 12 9 21 18 29" stroke="#156B2B" stroke-width="8" fill="none" stroke-linecap="round"/>
  <g fill="url(#g-verde)" stroke="#0E5522" stroke-width="2.5" stroke-linejoin="round">
    <path id="hoja" d="M50 50C32 42 24 20 37 13c6-3 11 1 13 7 2-6 7-10 13-7 13 7 5 29-13 37z"/>
    <use href="#hoja" transform="rotate(90 50 50)"/>
    <use href="#hoja" transform="rotate(180 50 50)"/>
    <use href="#hoja" transform="rotate(270 50 50)"/>
  </g>
  <circle cx="50" cy="50" r="4" fill="#0E5522"/>
  <ellipse cx="40" cy="22" rx="6" ry="3" fill="#FFFFFF" opacity=".55" transform="rotate(-30 40 22)"/>
  <ellipse cx="22" cy="42" rx="5" ry="2.6" fill="#FFFFFF" opacity=".45" transform="rotate(-60 22 42)"/>
</symbol>
<symbol id="s-herradura" viewBox="0 0 100 100">
  <ellipse cx="50" cy="92" rx="28" ry="5" fill="url(#g-sombra)"/>
  <path d="M28 18C16 38 16 66 33 80c10 8 24 8 34 0 17-14 17-42 5-62" fill="none" stroke="#6B4A10" stroke-width="20" stroke-linecap="round" transform="translate(0 3)"/>
  <path d="M28 18C16 38 16 66 33 80c10 8 24 8 34 0 17-14 17-42 5-62" fill="none" stroke="url(#g-oro-v)" stroke-width="18" stroke-linecap="round"/>
  <path d="M24 34C20 50 22 66 33 75" fill="none" stroke="#FFF6C8" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <g fill="#7A4A05"><circle cx="24" cy="44" r="2.6"/><circle cx="25" cy="58" r="2.6"/><circle cx="31" cy="70" r="2.6"/><circle cx="76" cy="44" r="2.6"/><circle cx="75" cy="58" r="2.6"/><circle cx="69" cy="70" r="2.6"/></g>
</symbol>
<symbol id="s-siete" viewBox="0 0 100 100">
  <ellipse cx="50" cy="92" rx="26" ry="5" fill="url(#g-sombra)"/>
  <path d="M24 16h54v12L50 86H33l27-55H24z" fill="#6E0B0B" transform="translate(3 4)"/>
  <path d="M24 16h54v12L50 86H33l27-55H24z" fill="url(#g-rojo)" stroke="#FFD24A" stroke-width="4" stroke-linejoin="round"/>
  <path d="M29 21h42" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".55"/>
</symbol>
<symbol id="s-diamante" viewBox="0 0 100 100">
  <ellipse cx="50" cy="92" rx="26" ry="5" fill="url(#g-sombra)"/>
  <polygon points="22,38 36,20 64,20 78,38 50,84" fill="#1F8FC4"/>
  <polygon points="36,20 50,38 22,38" fill="#9BE7FF"/>
  <polygon points="36,20 64,20 50,38" fill="#E2F9FF"/>
  <polygon points="64,20 78,38 50,38" fill="#74D2F3"/>
  <polygon points="22,38 50,38 50,84" fill="#3DB6E6"/>
  <polygon points="50,38 78,38 50,84" fill="#167BB2"/>
  <polygon points="22,38 36,20 64,20 78,38 50,84" fill="none" stroke="#0B4E78" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M70 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFFFFF"/>
</symbol>`;

export function Sprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}

/** Dibujo base de un símbolo, por su clave. */
export function SvgSimbolo({ k, className }: { k: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <use href={`#s-${k}`} />
    </svg>
  );
}
