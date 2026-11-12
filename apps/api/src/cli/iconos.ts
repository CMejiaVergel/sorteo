/**
 * Genera los íconos de la app instalable (180, 192 y 512 px) para el sitio público.
 *   npm run iconos -w @pato/api               → ícono base (moneda sobre vino)
 *   npm run iconos -w @pato/api -- logo.png   → a partir del logo del negocio
 */
import { resolve } from 'node:path';
import sharp from 'sharp';
import { RAIZ } from '../config.ts';

const BASE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="o" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF6BF"/><stop offset=".45" stop-color="#F7C63C"/><stop offset="1" stop-color="#B06F08"/></radialGradient>
<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E1013"/><stop offset="1" stop-color="#170708"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#f)"/>
<circle cx="50" cy="53" r="30" fill="#8A5200"/><circle cx="50" cy="50" r="30" fill="url(#o)"/>
<circle cx="50" cy="50" r="23.5" fill="none" stroke="#B87C12" stroke-width="2.4"/>
<path transform="translate(50 50) scale(.78) translate(-50 -50)" d="M50 29l6.2 12.6 13.9 2-10 9.8 2.4 13.8L50 60.7l-12.5 6.5 2.4-13.8-10-9.8 13.9-2z" fill="#E7A71E" stroke="#9A6408" stroke-width="2.2" stroke-linejoin="round"/>
</svg>`;

const destino = resolve(RAIZ, 'apps/web-public/public');
const logo = process.argv[2];

for (const n of [180, 192, 512]) {
  const img = logo
    ? sharp(resolve(process.cwd(), logo)).resize(Math.round(n * 0.8), Math.round(n * 0.8), { fit: 'contain', background: '#00000000' })
    : sharp(Buffer.from(BASE)).resize(n, n);
  const capa = logo
    ? sharp({ create: { width: n, height: n, channels: 4, background: '#5E1013' } }).composite([{ input: await img.png().toBuffer(), gravity: 'center' }])
    : img;
  await capa.png().toFile(resolve(destino, `icono-${n}.png`));
}
console.log('Íconos generados en apps/web-public/public');
