import { useId, useState } from 'react';
import { avisar } from '@pato/ui';
import { api } from '../api/cliente.ts';

/** Espacio de imagen: miniatura o "Sin imagen", botón de archivo, "Subiendo…" y "Quitar". */
export function SelectorImagen({
  etiqueta,
  valor,
  uso,
  nota,
  alCambiar,
}: {
  etiqueta: string;
  valor: string | null;
  uso: string;
  nota?: string;
  alCambiar: (url: string | null) => void;
}) {
  const id = useId();
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="img-pick">
        <div className="img-prev">{subiendo ? 'Subiendo…' : valor ? <img src={valor} alt="" /> : 'Sin imagen'}</div>
        <div className="stack" style={{ gap: 6 }}>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setSubiendo(true);
              try {
                const { url } = await api.subirImagen(f, uso);
                alCambiar(url);
              } catch (er) {
                // Un error de subida deja el valor anterior intacto.
                avisar('No se pudo subir la imagen: ' + (er instanceof Error ? er.message : ''));
              } finally {
                setSubiendo(false);
              }
            }}
          />
          {valor && (
            <button
              type="button"
              className="link-btn small"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => alCambiar(null)}
            >
              Quitar
            </button>
          )}
          {nota && (
            <span className="hint" style={{ margin: 0 }}>
              {nota}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
