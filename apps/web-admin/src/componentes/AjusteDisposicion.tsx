import { useEffect, useRef, useState } from 'react';
import type { Diseno, ElementoPantalla } from '@pato/shared';

type Disposicion = Diseno['ruleta']['disposicion'];

const ELEMENTOS: { k: ElementoPantalla; t: string }[] = [
  { k: 'maquina', t: 'Ruleta' },
  { k: 'boton', t: 'Botón LANZA' },
  { k: 'celular', t: 'Campo del celular' },
  { k: 'titulo', t: 'Título' },
];

const NORMAL = { escala: 100, x: 0, y: 0 };

/** Ancho y alto del celular de la vista previa (un iPhone común). */
const ANCHO = 390;
const ALTO = 844;

/**
 * Tamaño y posición de cada bloque de la pantalla de la ruleta, con un celular de vista previa
 * que muestra los cambios al instante, antes de guardar.
 */
export function AjusteDisposicion({ diseno, alCambiar }: { diseno: Diseno; alCambiar: (p: Disposicion) => void }) {
  const [el, setEl] = useState<ElementoPantalla>('maquina');
  const marco = useRef<HTMLIFrameElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [escalaVista, setEscalaVista] = useState(0.7);
  const p = diseno.ruleta.disposicion;
  const actual = p[el];

  // El celular de la vista previa se ajusta al ancho disponible.
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const o = new ResizeObserver(() => setEscalaVista(Math.min(0.78, c.clientWidth / ANCHO)));
    o.observe(c);
    return () => o.disconnect();
  }, []);

  // Cada cambio se envía a la vista previa; y otra vez cuando avisa que ya cargó.
  useEffect(() => {
    const enviar = () => marco.current?.contentWindow?.postMessage({ tipo: 'pato-diseno', diseno }, location.origin);
    enviar();
    const lista = (e: MessageEvent) => {
      if (e.origin === location.origin && (e.data as { tipo?: string })?.tipo === 'pato-vista-lista') enviar();
    };
    window.addEventListener('message', lista);
    return () => window.removeEventListener('message', lista);
  }, [diseno]);

  const poner = (campo: 'escala' | 'x' | 'y', v: number) => alCambiar({ ...p, [el]: { ...actual, [campo]: v } });
  const cambiado = (k: ElementoPantalla) => p[k].escala !== 100 || p[k].x !== 0 || p[k].y !== 0;

  const deslizador = (
    campo: 'escala' | 'x' | 'y',
    titulo: string,
    min: number,
    max: number,
    texto: (v: number) => string,
  ) => (
    <div className="field">
      <label htmlFor={`dp-${campo}`}>
        {titulo} <span className="num">{texto(actual[campo])}</span>
      </label>
      <div className="dp-fila">
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`Menos ${titulo.toLowerCase()}`}
          onClick={() => poner(campo, Math.max(min, actual[campo] - 1))}
        >
          −
        </button>
        <input
          id={`dp-${campo}`}
          type="range"
          min={min}
          max={max}
          step="1"
          value={actual[campo]}
          onChange={(e) => poner(campo, Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`Más ${titulo.toLowerCase()}`}
          onClick={() => poner(campo, Math.min(max, actual[campo] + 1))}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="panel stack">
      <h3>Tamaño y posición en la pantalla</h3>
      <p className="muted small">
        Agranda, achica o mueve cada parte de la ruleta. Si cambias la imagen de la máquina y queda pequeña, súbele el
        tamaño aquí. Mira el celular de la derecha: cambia al instante. Guarda al terminar.
      </p>
      <div className="dp">
        <div className="stack">
          <div className="dp-tabs" role="tablist" aria-label="Parte de la pantalla">
            {ELEMENTOS.map(({ k, t }) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={el === k}
                className={`dp-tab${el === k ? ' on' : ''}`}
                onClick={() => setEl(k)}
              >
                {t}
                {cambiado(k) && <i aria-label="(ajustado)" />}
              </button>
            ))}
          </div>
          {deslizador('escala', 'Tamaño', 30, 300, (v) => `${v}%`)}
          {deslizador('x', 'Izquierda ↔ derecha', -50, 50, (v) =>
            v === 0 ? 'centro' : v < 0 ? `${-v}% a la izquierda` : `${v}% a la derecha`,
          )}
          {deslizador('y', 'Arriba ↕ abajo', -50, 50, (v) =>
            v === 0 ? 'normal' : v < 0 ? `${-v}% más arriba` : `${v}% más abajo`,
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!cambiado(el)}
              onClick={() => alCambiar({ ...p, [el]: NORMAL })}
            >
              Dejar {ELEMENTOS.find((x) => x.k === el)!.t.toLowerCase()} como venía
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!ELEMENTOS.some((x) => cambiado(x.k))}
              onClick={() => alCambiar({ titulo: NORMAL, maquina: NORMAL, celular: NORMAL, boton: NORMAL })}
            >
              Todo como venía
            </button>
          </div>
          <p className="hint">
            Tamaño en % del normal. Mover va en % del ancho o del alto de la pantalla, así se ve igual en cualquier
            celular.
          </p>
        </div>
        <div className="dp-vista" ref={caja}>
          <div className="dp-cel" style={{ width: ANCHO * escalaVista, height: ALTO * escalaVista }}>
            <iframe
              ref={marco}
              title="Vista previa de la ruleta en un celular"
              src="/ruleta/vista"
              width={ANCHO}
              height={ALTO}
              style={{ transform: `scale(${escalaVista})` }}
            />
          </div>
          <span className="small muted">
            Vista previa · celular de {ANCHO}×{ALTO}
          </span>
        </div>
      </div>
    </div>
  );
}
