/** Describe el navegador en palabras sencillas para el panel: "Android (SM-A515F) · Chrome". */
export function describirAgente(ua: string): string {
  if (!ua) return 'Desconocido';
  let so = 'Otro';
  if (/iPhone/.test(ua)) so = 'iPhone';
  else if (/iPad/.test(ua)) so = 'iPad';
  else if (/Android/.test(ua)) {
    const modelo = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/.exec(ua)?.[1]?.trim();
    so = modelo && modelo !== 'K' && !/^wv$/i.test(modelo) ? `Android (${modelo})` : 'Android';
  } else if (/Windows/.test(ua)) so = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) so = 'Mac';
  else if (/Linux/.test(ua)) so = 'Linux';

  const nav: [RegExp, string][] = [
    [/FBAN|FBAV|FB_IAB/, 'Facebook'],
    [/Instagram/, 'Instagram'],
    [/SamsungBrowser/, 'Samsung Internet'],
    [/EdgA?\/|Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/CriOS|Chrome\//, 'Chrome'],
    [/FxiOS|Firefox\//, 'Firefox'],
    [/Safari\//, 'Safari'],
    [/curl|python|node|axios|Go-http|java|wget|okhttp|lightMyRequest/i, 'Programa automático'],
  ];
  const n = nav.find(([r]) => r.test(ua))?.[1] ?? 'Navegador desconocido';
  return so === 'Otro' && n === 'Programa automático' ? n : `${so} · ${n}`;
}
