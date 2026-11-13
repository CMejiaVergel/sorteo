import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NOMBRE_SIMBOLO, SIMBOLOS, type Diseno } from '@pato/shared';
import { avisar, BotonDobleToque } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { Cargando, ErrorPanel } from '../componentes/Marco.tsx';
import { SelectorImagen } from '../componentes/SelectorImagen.tsx';
import { AjusteDisposicion } from '../componentes/AjusteDisposicion.tsx';

type Ruleta = Diseno['ruleta'];

export function PaginaDiseno() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['diseno'], queryFn: api.diseno });
  const [d, setD] = useState<Diseno | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (q.data) setD(q.data);
  }, [q.data]);
  if (q.isError) return <ErrorPanel />;
  if (!d) return <Cargando />;

  const r = d.ruleta;
  const setR = <K extends keyof Ruleta>(k: K, v: Ruleta[K]) => setD({ ...d, ruleta: { ...r, [k]: v } });
  const v = r.ventana;

  async function guardar() {
    setGuardando(true);
    try {
      const nuevo = await api.guardarDiseno(d!);
      qc.setQueryData(['diseno'], nuevo);
      avisar('Diseño guardado');
    } catch (er) {
      avisar('No se pudo guardar: ' + (er instanceof Error ? er.message : ''));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="adm-head">
        <h2>Diseño</h2>
        <Link className="btn btn-sm btn-primary" to="/ruleta/probar">
          Probar la ruleta
        </Link>
      </div>
      <p className="muted">
        Cambia el look de la ruleta y del tablero. Lo que dejes vacío usa el diseño por defecto. Guarda antes de probar.
      </p>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="panel stack">
          <h3>Pantalla</h3>
          <div className="grid2">
            <SelectorImagen
              etiqueta="Imagen de fondo"
              uso="fondo"
              valor={r.fondo}
              nota="Mejor vertical, tipo pantalla de celular."
              alCambiar={(u) => setR('fondo', u)}
            />
            <SelectorImagen
              etiqueta="Logo del título"
              uso="logo"
              valor={r.logo}
              nota="PNG sin fondo."
              alCambiar={(u) => setR('logo', u)}
            />
            <SelectorImagen
              etiqueta="Mascota a los lados del logo"
              uso="mascota"
              valor={r.mascota}
              nota="Opcional. PNG sin fondo. Sale a ambos lados."
              alCambiar={(u) => setR('mascota', u)}
            />
          </div>
        </div>
        <div className="panel stack">
          <h3>Máquina de la ruleta</h3>
          <p className="muted small">
            Sube la imagen de la máquina que quieras (PNG, mejor vertical). Luego mueve las barras para que los rodillos
            queden justo en el hueco de tu imagen. Si la dejas vacía se usa el castillo.
          </p>
          <div className="grid2">
            <SelectorImagen
              etiqueta="Imagen de la máquina"
              uso="maquina"
              valor={r.maquina}
              alCambiar={(u) => setR('maquina', u)}
            />
          </div>
          {r.maquina && (
            <div className="maq-ajuste">
              <div className="maq-prev">
                <img src={r.maquina} alt="" />
                <div
                  className="maq-rect"
                  style={{ left: `${v.x}%`, top: `${v.y}%`, width: `${v.w}%`, height: `${v.h}%` }}
                >
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="maq-sliders">
                {(
                  [
                    ['x', 'Izquierda'],
                    ['y', 'Arriba'],
                    ['w', 'Ancho'],
                    ['h', 'Alto'],
                  ] as const
                ).map(([k, t]) => (
                  <div className="field" key={k}>
                    <label htmlFor={`v-${k}`}>
                      {t} <span className="num">{v[k]}%</span>
                    </label>
                    <input
                      id={`v-${k}`}
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={v[k]}
                      onChange={(e) => setR('ventana', { ...v, [k]: Number(e.target.value) })}
                    />
                  </div>
                ))}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={r.rodillosBlancos}
                    onChange={(e) => setR('rodillosBlancos', e.target.checked)}
                  />{' '}
                  Poner fondo blanco a los rodillos
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={r.ocultarLogo}
                    onChange={(e) => setR('ocultarLogo', e.target.checked)}
                  />{' '}
                  Ocultar el logo de arriba (si tu imagen ya trae logo)
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="panel stack">
          <h3>Íconos de los rodillos</h3>
          <div className="field">
            <label htmlFor="v-sim">
              Tamaño de los íconos <span className="num">{r.escalaSimbolos}%</span>
            </label>
            <input
              id="v-sim"
              type="range"
              min="35"
              max="100"
              step="1"
              value={r.escalaSimbolos}
              onChange={(e) => setR('escalaSimbolos', Number(e.target.value))}
            />
          </div>
          <p className="muted small">
            Sube una imagen para reemplazar cada símbolo. Usa imágenes cuadradas y sin fondo (PNG).
          </p>
          <div className="grid2">
            {SIMBOLOS.map((k, i) => (
              <SelectorImagen
                key={k}
                etiqueta={`Símbolo ${i + 1}: ${NOMBRE_SIMBOLO[k]}`}
                uso="simbolo"
                valor={r.simbolos[k]}
                alCambiar={(u) => setR('simbolos', { ...r.simbolos, [k]: u })}
              />
            ))}
          </div>
        </div>
        <div className="panel stack">
          <h3>Botón LANZA</h3>
          <p className="muted small">
            Si quieres otro botón, sube su imagen (PNG sin fondo). Si la dejas vacía se usa el botón rojo LANZA.
          </p>
          <div className="grid2">
            <SelectorImagen
              etiqueta="Imagen del botón"
              uso="boton"
              valor={r.botonImagen}
              alCambiar={(u) => setR('botonImagen', u)}
            />
          </div>
        </div>
        <AjusteDisposicion diseno={d} alCambiar={(p) => setR('disposicion', p)} />
        <div className="panel stack">
          <h3>Números ocupados</h3>
          <p className="muted small">
            Este logo tapa los números que ya están apartados en el tablero de todos los sorteos. Usa una imagen
            cuadrada en PNG sin fondo. Si un sorteo tiene su propio logo, se usa ese.
          </p>
          <div className="grid2">
            <SelectorImagen
              etiqueta="Logo para números ocupados"
              uso="ocupado"
              valor={d.tablero.logoOcupado}
              nota="Si lo dejas vacío se usa la moneda de oro."
              alCambiar={(u) => setD({ ...d, tablero: { ...d.tablero, logoOcupado: u } })}
            />
          </div>
        </div>
        <div className="panel stack">
          <h3>Todos los números vendidos</h3>
          <p className="muted small">
            Cuando se apartan los 100 números de un sorteo, el tablero muestra esta imagen. Úsala para anunciar que se
            agotó (por ejemplo, “¡Todos vendidos! Gracias por participar”). Si un sorteo tiene su propia imagen, se usa
            esa.
          </p>
          <div className="grid2">
            <SelectorImagen
              etiqueta="Imagen de “todos vendidos”"
              uso="agotado"
              valor={d.tablero.agotado}
              nota="Si la dejas vacía se muestra un aviso con el pato."
              alCambiar={(u) => setD({ ...d, tablero: { ...d.tablero, agotado: u } })}
            />
          </div>
        </div>
        <div className="panel stack">
          <h3>Colores</h3>
          <div className="grid2">
            <div className="field">
              <label htmlFor="d-marco">Color del castillo (si no subes máquina)</label>
              <input
                id="d-marco"
                type="color"
                value={r.colorCastillo}
                style={{ minHeight: 52, padding: 4 }}
                onChange={(e) => setR('colorCastillo', e.target.value.toUpperCase())}
              />
            </div>
            <div className="field">
              <label htmlFor="d-boton">Color del botón LANZA (si no subes imagen)</label>
              <input
                id="d-boton"
                type="color"
                value={r.colorBoton}
                style={{ minHeight: 52, padding: 4 }}
                onChange={(e) => setR('colorBoton', e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar diseño'}
          </button>
          <BotonDobleToque
            className="btn btn-danger"
            accion={async () => {
              try {
                const base = await api.restablecerDiseno();
                qc.setQueryData(['diseno'], base);
                setD(base);
                avisar('Diseño original restablecido');
              } catch (er) {
                avisar(er instanceof Error ? er.message : 'No se pudo restablecer');
              }
            }}
          >
            Volver al diseño original
          </BotonDobleToque>
        </div>
      </form>
    </>
  );
}
