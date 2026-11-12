import { useEffect, useState } from 'react';
import { formatearFecha, hoyBogota, type Sorteo } from '@pato/shared';
import { avisar, BotonCopiar } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { imagenTablero } from './imagenTablero.ts';

/** Ventana "Imagen del tablero": compartir, guardar, copiar mensaje y fondo propio del sorteo. */
export function VentanaImagen({
  sorteo,
  ocupados,
  negocio,
  whatsapp,
  tapaGeneral,
  link,
  alCerrar,
  alCambiarSorteo,
}: {
  sorteo: Sorteo;
  ocupados: number[];
  negocio: string;
  whatsapp: string;
  tapaGeneral: string | null;
  link: string;
  alCerrar: () => void;
  alCambiarSorteo: (s: Sorteo) => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    let u = '';
    setBlob(null);
    imagenTablero(sorteo, ocupados, { negocio, whatsapp, tapaGeneral })
      .then((b) => {
        if (!vivo) return;
        u = URL.createObjectURL(b);
        setBlob(b);
        setUrl(u);
      })
      .catch((e) => setError('No se pudo crear la imagen: ' + e.message));
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [sorteo, ocupados, negocio, whatsapp, tapaGeneral]);

  const nombre = `tablero-${sorteo.nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')}-${sorteo.fecha || hoyBogota(new Date())}.png`;
  const archivo = blob ? new File([blob], nombre, { type: 'image/png' }) : null;
  const puedeCompartir = !!(archivo && navigator.canShare?.({ files: [archivo] }));
  const texto = `${sorteo.nombre} · ${formatearFecha(sorteo.fecha)}${sorteo.hora ? ' ' + sorteo.hora : ''}\nAparta tus números aquí: ${link}`;

  async function cambiarFondo(u: string) {
    try {
      const r = await api.editarSorteo(sorteo.id, { fondo_imagen: u });
      alCambiarSorteo(r.sorteo);
      avisar(u ? 'Fondo guardado para este sorteo' : 'Fondo quitado');
    } catch (er) {
      avisar('No se pudo guardar el fondo: ' + (er instanceof Error ? er.message : ''));
    }
  }

  return (
    <div className="exp-capa" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="exp-caja" role="dialog" aria-label="Imagen del tablero">
        <div className="adm-head">
          <h3>Imagen del tablero</h3>
          <button className="btn btn-sm" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
        {error && <p className="err">{error}</p>}
        {!error && !url && <p className="muted">Creando imagen…</p>}
        {url && (
          <>
            <img className="exp-img" src={url} alt={`Tablero de ${sorteo.nombre}`} />
            <div className="stack" style={{ gap: 8 }}>
              {puedeCompartir && (
                <button
                  className="btn btn-primary btn-block"
                  onClick={async () => {
                    try {
                      await navigator.share({ files: [archivo!], text: texto });
                    } catch {
                      /* cancelado */
                    }
                  }}
                >
                  Compartir por WhatsApp
                </button>
              )}
              <a className={`btn btn-block ${puedeCompartir ? '' : 'btn-primary'}`} href={url} download={nombre}>
                Guardar imagen
              </a>
              <BotonCopiar className="btn btn-block" texto={texto}>
                Copiar mensaje con el link
              </BotonCopiar>
              <label className="btn btn-block" htmlFor="exp-fondo">
                {sorteo.fondo_imagen ? 'Cambiar fondo de esta imagen' : 'Ponerle un fondo a esta imagen'}
              </label>
              <input
                id="exp-fondo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  avisar('Subiendo fondo…');
                  try {
                    await cambiarFondo((await api.subirImagen(f, 'fondo')).url);
                  } catch (er) {
                    avisar('No se pudo subir: ' + (er instanceof Error ? er.message : ''));
                  }
                }}
              />
              {sorteo.fondo_imagen && (
                <button className="link-btn small" style={{ alignSelf: 'center' }} onClick={() => cambiarFondo('')}>
                  Quitar fondo
                </button>
              )}
              <p className="hint" style={{ margin: 0 }}>
                También puedes mantener presionada la imagen para guardarla. Se actualiza con los números ocupados en
                este momento.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
