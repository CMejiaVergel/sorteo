import { dinero, dosDigitos, formatearFecha, formatearTelefono, temaDe, type Sorteo } from '@pato/shared';
import { FONDO_TABLERO, portadaDe } from '@pato/ui';

/** Imagen PNG vertical de 1080 px con el estado del tablero (docs/02 §7). Se genera en el navegador. */

const cargarImg = (src: string | null | undefined) =>
  new Promise<HTMLImageElement | null>((ok) => {
    if (!src) return ok(null);
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function moneda(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFF6BF');
  g.addColorStop(0.45, '#F7C63C');
  g.addColorStop(1, '#B06F08');
  ctx.fillStyle = '#8A5200';
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.08, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#B87C12';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#E7A71E';
  ctx.strokeStyle = '#9A6408';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.24 : r * 0.55;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Escribe el texto reduciendo la letra hasta que quepa en maxW. */
function ajustado(
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  font: string,
  peso = '',
) {
  let s = size;
  do {
    ctx.font = `${peso}${s}px ${font}`;
    s -= 2;
  } while (ctx.measureText(txt).width > maxW && s > 14);
  ctx.fillText(txt, x, y);
}

export async function imagenTablero(
  s: Sorteo,
  ocupados: number[],
  op: { negocio: string; whatsapp: string; tapaGeneral: string | null },
): Promise<Blob> {
  try {
    await Promise.all(
      ['64px "Anton"', '700 30px "Figtree"', '800 30px "Figtree"', '600 30px "Figtree"', '500 30px "Figtree"'].map(
        (f) => document.fonts.load(f),
      ),
    );
  } catch {
    /* se dibuja con las de respaldo */
  }
  const W = 1080;
  const M = 54;
  const t = temaDe(s);
  const premios = (
    [
      ['Premio mayor', s.premio_ultimas],
      ['Cifras del medio', s.premio_medio],
      ['Dos primeras', s.premio_primeras],
      ['Unido', s.premio_unido],
    ] as [string, number][]
  ).filter((p) => p[1] > 0);
  const celda = (W - M * 2 - 9 * 10) / 10;
  const tabTop = 316 + 132 + 26 + (premios.length ? 108 + 18 : 0);
  const tabBot = tabTop + celda * 10 + 90;
  const H = tabBot + 64 + 200 + 54;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const [portada, tapa, fondo] = await Promise.all([
    cargarImg(portadaDe(s)),
    cargarImg(s.logo_ocupado || op.tapaGeneral),
    cargarImg(s.fondo_imagen || FONDO_TABLERO),
  ]);
  const ANTON = '"Anton", Impact, "Arial Narrow", sans-serif';
  const BODY = '"Figtree", system-ui, sans-serif';

  // Fondo
  let g: CanvasGradient = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#5E1013');
  g.addColorStop(0.55, '#320B0E');
  g.addColorStop(1, '#170708');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.15, 0, 10, W * 0.15, 0, W * 0.8);
  g.addColorStop(0, 'rgba(156,28,28,.75)');
  g.addColorStop(1, 'rgba(156,28,28,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (fondo) {
    const k = Math.max(W / fondo.width, H / fondo.height);
    ctx.drawImage(fondo, (W - fondo.width * k) / 2, (H - fondo.height * k) / 2, fondo.width * k, fondo.height * k);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, W, H);
    rrect(ctx, M - 18, 32, W - (M - 18) * 2, 266, 30);
    ctx.fillStyle = 'rgba(12,8,10,.62)';
    ctx.fill();
  }

  // Cabecera: portada y nombre
  const pS = 230;
  rrect(ctx, M, 50, pS, pS, 34);
  ctx.save();
  ctx.clip();
  if (portada) {
    const k = Math.max(pS / portada.width, pS / portada.height);
    ctx.drawImage(
      portada,
      M + (pS - portada.width * k) / 2,
      50 + (pS - portada.height * k) / 2,
      portada.width * k,
      portada.height * k,
    );
  } else {
    const gg = ctx.createLinearGradient(M, 50, M + pS, 50 + pS);
    gg.addColorStop(0, t.c1);
    gg.addColorStop(1, t.c2);
    ctx.fillStyle = gg;
    ctx.fillRect(M, 50, pS, pS);
    moneda(ctx, M + pS / 2, 50 + pS / 2, pS * 0.3);
  }
  ctx.restore();
  const tx = M + pS + 36;
  const tw = W - tx - M;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F3D9A4';
  ajustado(ctx, op.negocio.toUpperCase(), tx, 96, tw, 30, BODY, '700 ');
  ctx.fillStyle = '#FFFFFF';
  ajustado(ctx, s.nombre.toUpperCase(), tx, 186, tw, 92, ANTON);
  ctx.fillStyle = t.neon;
  ajustado(ctx, `${formatearFecha(s.fecha)}${s.hora ? ' · ' + s.hora : ''}`, tx, 236, tw, 34, BODY, '700 ');
  if (s.loteria && s.loteria.trim().toLowerCase() !== s.nombre.trim().toLowerCase()) {
    ctx.fillStyle = '#E8C9A0';
    ajustado(ctx, 'Juega con ' + s.loteria, tx, 276, tw, 28, BODY, '500 ');
  }

  // Premio total y boleta
  let y = 316;
  const hT = 132;
  const divX = M + (W - M * 2) * 0.62;
  rrect(ctx, M, y, W - M * 2, hT, 28);
  g = ctx.createLinearGradient(0, y, 0, y + hT);
  g.addColorStop(0, '#FFE98A');
  g.addColorStop(1, '#E3A11B');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#7A4C00';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(122,76,0,.35)';
  ctx.fillRect(divX - 1.5, y + 22, 3, hT - 44);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2A1500';
  const cTot = (M + divX) / 2;
  const cBol = (divX + W - M) / 2;
  ctx.font = `800 26px ${BODY}`;
  ctx.fillText('PREMIO TOTAL', cTot, y + 36);
  ctx.fillText('BOLETA', cBol, y + 36);
  ajustado(ctx, dinero(s.premio_total), cTot, y + 88, divX - M - 40, 66, ANTON);
  ajustado(ctx, dinero(s.valor_boleta), cBol, y + 88, W - M - divX - 40, 56, ANTON);

  // Premios por cifras
  if (premios.length) {
    y = 316 + hT + 18;
    const gap = 16;
    const hP = 108;
    const pw = (W - M * 2 - gap * (premios.length - 1)) / premios.length;
    premios.forEach(([nom, v], i) => {
      const x = M + i * (pw + gap);
      rrect(ctx, x, y, pw, hP, 22);
      ctx.fillStyle = 'rgba(12,8,10,.72)';
      ctx.fill();
      ctx.strokeStyle = '#E8BE72';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#F3D9A4';
      ajustado(ctx, nom.toUpperCase(), x + pw / 2, y + 34, pw - 24, 23, BODY, '800 ');
      ctx.fillStyle = '#FFFFFF';
      ajustado(ctx, dinero(v), x + pw / 2, y + 74, pw - 28, 48, ANTON);
    });
  }

  // Tablero
  const ocup = new Set(ocupados);
  for (let n = 0; n < 100; n++) {
    const cx = M + (n % 10) * (celda + 10);
    const cy = tabTop + Math.floor(n / 10) * (celda + 10);
    rrect(ctx, cx, cy, celda, celda, 16);
    if (ocup.has(n)) {
      ctx.fillStyle = '#0C3A30';
      ctx.fill();
      if (tapa) {
        const k = Math.min((celda * 0.8) / tapa.width, (celda * 0.8) / tapa.height);
        ctx.drawImage(
          tapa,
          cx + (celda - tapa.width * k) / 2,
          cy + (celda - tapa.height * k) / 2,
          tapa.width * k,
          tapa.height * k,
        );
      } else moneda(ctx, cx + celda / 2, cy + celda / 2, celda * 0.32);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.fillStyle = '#141418';
      ctx.font = `${Math.round(celda * 0.46)}px ${ANTON}`;
      ctx.fillText(dosDigitos(n), cx + celda / 2, cy + celda / 2 + 2);
    }
  }

  // Contador
  y = tabBot + 30;
  const libres = 100 - ocup.size;
  if (fondo) {
    rrect(ctx, W / 2 - 330, y - 16, 660, 52, 26);
    ctx.fillStyle = 'rgba(12,8,10,.7)';
    ctx.fill();
  }
  ctx.font = `700 30px ${BODY}`;
  ctx.fillStyle = '#F3D9A4';
  ctx.fillText(
    `${libres} ${libres === 1 ? 'número disponible' : 'números disponibles'}  ·  tapados = ocupados`,
    W / 2,
    y + 10,
  );

  // Pago por Nequi
  y = tabBot + 64;
  rrect(ctx, M, y, W - M * 2, 200, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E8BE72';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#0E6A4E';
  ajustado(ctx, 'APARTA TU NÚMERO Y PAGA POR NEQUI', W / 2, y + 50, W - M * 2 - 40, 26, BODY, '800 ');
  ctx.fillStyle = '#11231E';
  ajustado(
    ctx,
    s.nequi ? formatearTelefono(s.nequi) : 'Escríbenos por WhatsApp',
    W / 2,
    y + 120,
    W - M * 2 - 40,
    68,
    ANTON,
  );
  ctx.fillStyle = '#56675F';
  ajustado(
    ctx,
    s.nequi_titular
      ? 'A nombre de ' + s.nequi_titular
      : op.whatsapp
        ? 'WhatsApp ' + formatearTelefono(op.whatsapp)
        : '',
    W / 2,
    y + 170,
    W - M * 2 - 40,
    28,
    BODY,
    '600 ',
  );
  return new Promise((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error('No se pudo crear la imagen'))), 'image/png'),
  );
}
