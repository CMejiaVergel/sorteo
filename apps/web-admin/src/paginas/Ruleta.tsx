import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatearFecha,
  formatearTelefono,
  NOMBRE_SIMBOLO,
  normalizarTelefono,
  SIMBOLOS,
  telefonoValido,
  type ConfigRuleta,
  type Simbolo,
} from '@pato/shared';
import { avisar, BotonDobleToque, Ruleta, SvgSimbolo, useTemaNavegador } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { Cargando, ErrorPanel } from '../componentes/Marco.tsx';

const TRIOS: Record<Simbolo, string> = {
  moneda: 'monedas',
  trebol: 'tréboles',
  herradura: 'herraduras',
  siete: 'sietes',
  diamante: 'diamantes',
};

export function PaginaRuleta() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['ruleta'], queryFn: api.ruleta });
  const giros = useQuery({ queryKey: ['giros'], queryFn: api.giros });
  const [c, setC] = useState<ConfigRuleta | null>(null);
  const [error, setError] = useState('');
  const [telReinicio, setTelReinicio] = useState('');
  useEffect(() => {
    if (cfg.data) setC(cfg.data);
  }, [cfg.data]);

  if (cfg.isLoading || !c) return cfg.isError ? <ErrorPanel /> : <Cargando />;
  const ganadores = giros.data?.ganadores ?? [];

  return (
    <>
      <div className="adm-head">
        <h2>Tragamonedas</h2>
        <div className="row-actions">
          <Link className="btn btn-sm btn-primary" to="/ruleta/probar">
            Probar la ruleta
          </Link>
        </div>
      </div>
      <p className="muted small">
        “Probar la ruleta” te deja girar las veces que quieras sin gastar ningún tiro ni guardar nada.
      </p>
      <form
        className="panel stack"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (c.prob_tres + c.prob_dos > 100) return setError('La suma de las probabilidades no puede pasar de 100.');
          setError('');
          try {
            await api.guardarRuleta(c);
            await qc.invalidateQueries({ queryKey: ['ruleta'] });
            avisar('Tragamonedas guardada');
          } catch (er) {
            setError(er instanceof Error ? er.message : 'No se pudo guardar');
          }
        }}
      >
        <label className="check">
          <input type="checkbox" checked={c.activo} onChange={(e) => setC({ ...c, activo: e.target.checked })} />{' '}
          Mostrar la tragamonedas en la página
        </label>
        <h3>Premios</h3>
        <div className="grid2">
          <div className="field">
            <label htmlFor="t-r2">Un par igual (2 iguales)</label>
            <input
              id="t-r2"
              type="text"
              placeholder="$1.000 de descuento"
              value={c.premio_dos}
              onChange={(e) => setC({ ...c, premio_dos: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="t-r3">3 en línea (si el símbolo no tiene premio propio)</label>
            <input
              id="t-r3"
              type="text"
              placeholder="Un número gratis"
              value={c.premio_tres}
              onChange={(e) => setC({ ...c, premio_tres: e.target.value })}
            />
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <span className="small muted">
            Premio de cada trío (3 en línea del mismo símbolo). Vacío = el de “3 en línea” de arriba.
          </span>
          <div className="trios">
            {SIMBOLOS.map((k) => (
              <div className="field trio" key={k}>
                <label htmlFor={`t-tr-${k}`}>
                  <span className="trio-ico" aria-hidden="true">
                    <SvgSimbolo k={k} />
                    <SvgSimbolo k={k} />
                    <SvgSimbolo k={k} />
                  </span>
                  Tres {TRIOS[k]}
                </label>
                <input
                  id={`t-tr-${k}`}
                  type="text"
                  maxLength={80}
                  placeholder={c.premio_tres || 'Premio'}
                  value={c.premios_tres[k] ?? ''}
                  onChange={(e) => setC({ ...c, premios_tres: { ...c.premios_tres, [k]: e.target.value } })}
                />
              </div>
            ))}
          </div>
        </div>
        <h3>Probabilidades</h3>
        <div className="grid2">
          <div className="field">
            <label htmlFor="t-p3">3 en línea (%)</label>
            <input
              id="t-p3"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={c.prob_tres}
              onChange={(e) => setC({ ...c, prob_tres: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label htmlFor="t-p2">Un par igual (%)</label>
            <input
              id="t-p2"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={c.prob_dos}
              onChange={(e) => setC({ ...c, prob_dos: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <p className="hint">
          Cada celular tira una vez al día. El resultado lo decide el servidor, así que nadie puede hacer trampa desde
          su celular. Con 1% y 10%, de cada 100 tiros saldrán más o menos 1 trío y 10 pares. Cuando sale un trío, los 5
          símbolos tienen la misma probabilidad.
        </p>
        {error && <p className="err">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" type="submit">
            Guardar
          </button>
        </div>
      </form>
      <form
        className="panel stack"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const t = normalizarTelefono(telReinicio);
          if (!telefonoValido(t)) return avisar('Escribe un celular de 10 dígitos que empiece por 3.');
          try {
            const r = await api.reiniciarTiro(t);
            avisar(r.borrado ? 'Listo. Ese celular puede volver a jugar hoy' : 'Ese celular no ha jugado hoy');
            await qc.invalidateQueries({ queryKey: ['giros'] });
          } catch (er) {
            avisar(er instanceof Error ? er.message : 'No se pudo reiniciar');
          }
        }}
      >
        <h3>Reiniciar el tiro de hoy</h3>
        <div className="row-actions">
          <BotonDobleToque
            className="btn btn-danger"
            confirmar="¿Reiniciar los tiros de hoy de todos? Toca otra vez"
            accion={async () => {
              try {
                const r = await api.reiniciarTodos();
                avisar(`Listo: ${r.borrados} tiro(s) de hoy borrados. Todos pueden volver a jugar.`);
                await qc.invalidateQueries({ queryKey: ['giros'] });
              } catch (er) {
                avisar(er instanceof Error ? er.message : 'No se pudo reiniciar');
              }
            }}
          >
            Reiniciar los tiros de hoy para todos
          </BotonDobleToque>
        </div>
        <p className="muted small">
          Todos los celulares vuelven a ver la ruleta al abrir el link, aunque ya hubieran jugado hoy. O reinicia solo
          el de un celular:
        </p>
        <div className="mn-form">
          <label htmlFor="t-reset" className="oculto">
            Celular
          </label>
          <input
            id="t-reset"
            type="tel"
            inputMode="numeric"
            placeholder="300 123 4567"
            value={telReinicio}
            onChange={(e) => setTelReinicio(e.target.value)}
          />
          <button className="btn" type="submit">
            Reiniciar
          </button>
        </div>
      </form>
      <div className="stack">
        <div className="adm-head">
          <h3>Ganadores</h3>
          <span className="muted small">{giros.data?.total ?? 0} tiros en total</span>
        </div>
        {ganadores.length ? (
          <div className="rows">
            {ganadores.map((g) => (
              <div className="row" key={g.id}>
                <div className="row-main">
                  <b>{g.nombre || formatearTelefono(g.telefono)}</b>
                  <span className="small muted">
                    {formatearTelefono(g.telefono)} · {formatearFecha(g.fecha)} ·{' '}
                    {g.resultado.map((k) => NOMBRE_SIMBOLO[k as Simbolo] ?? k).join(' · ')}
                  </span>
                </div>
                <span className={`state ${g.reclamado ? 'pag' : ''}`}>{g.premio}</span>
                <div className="row-actions">
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await api.marcarEntregado(g.id, !g.reclamado);
                      await qc.invalidateQueries({ queryKey: ['giros'] });
                    }}
                  >
                    {g.reclamado ? 'Entregado' : 'Marcar entregado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel">
            <p className="muted">Todavía no hay ganadores.</p>
          </div>
        )}
      </div>
    </>
  );
}

/** Ruleta en modo prueba: giros ilimitados, sin celular, sin guardar y sin redirigir. */
export function PaginaProbarRuleta() {
  useTemaNavegador('#2F8FE0', 'fortuna');
  const cfg = useQuery({ queryKey: ['ruleta'], queryFn: api.ruleta });
  const diseno = useQuery({ queryKey: ['diseno'], queryFn: api.diseno });
  if (!cfg.data || !diseno.data) return <p className="wrap muted cargando">Cargando…</p>;
  return (
    <Ruleta
      diseno={diseno.data}
      premios={cfg.data}
      pedirCelular={false}
      mostrarReglas
      barraSuperior={
        <>
          <span className="c-prueba">Modo prueba · no cuenta como tiro</span>
          <Link className="c-skip" to="/ruleta">
            Volver al panel
          </Link>
        </>
      }
      lanzar={async () => {
        try {
          return { ok: true, ...(await api.probarRuleta()) };
        } catch {
          return { ok: false, mensaje: 'Intenta de nuevo' };
        }
      }}
      resultado={(g, reiniciar) => (
        <div className={`c-res-card ${g.gano ? 'gano' : ''}`}>
          <b>{g.gano ? `¡Ganaste ${g.premio}!` : 'Esta vez no salió'}</b>
          <p>Prueba: así lo vería un cliente. No se guardó ningún tiro.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={reiniciar}>
            Probar otra vez
          </button>
          <Link className="btn btn-block" to="/ruleta">
            Volver al panel
          </Link>
        </div>
      )}
    />
  );
}
