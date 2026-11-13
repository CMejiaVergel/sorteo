import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  dinero,
  dosDigitos,
  enlaceWhatsApp,
  formatearApertura,
  formatearFecha,
  formatearTelefono,
  mensajePedido,
  normalizarTelefono,
  textoCelular,
  telefonoValido,
  temaDe,
  type SorteoPublico,
} from '@pato/shared';
import { avisar, BotonCopiar, Portada, SvgSimbolo, Tapa, useTemaNavegador, useTemaSorteo, vibrar } from '@pato/ui';
import { api, FalloApi } from '../api/cliente.ts';
import { guardarMiTel, miTel } from '../almacen.ts';
import { ErrorCarga, Marco, useConfig } from '../componentes/comunes.tsx';
import { BotonFinalizar, PagoNequi } from '../componentes/Pago.tsx';

type Paso = 'elegir' | 'datos' | 'listo';

/** Ejemplo con un resultado de 4 cifras: resalta qué parte tiene que coincidir con tu número. */
function Ejemplo({ desde }: { desde: number }) {
  return (
    <span className="pv-ej" aria-hidden="true">
      {'4523'.split('').map((d, i) => (
        <i key={i} className={i === desde || i === desde + 1 ? 'si' : ''}>
          {d}
        </i>
      ))}
    </span>
  );
}

function Premios({ s }: { s: SorteoPublico }) {
  const items = (
    [
      ['🏆', 'Premio mayor', 'Tu número sale en las 2 últimas cifras', s.premio_ultimas, 2],
      ['🥈', 'Cifras del medio', 'Tu número sale en las 2 cifras del medio', s.premio_medio, 1],
      ['🥉', 'Dos primeras cifras', 'Tu número sale en las 2 primeras cifras', s.premio_primeras, 0],
    ] as [string, string, string, number, number][]
  ).filter((x) => x[3] > 0);
  return (
    <section className="premios-v" aria-label="Premios">
      <h3 className="pv-titulo">Premios</h3>
      {s.premio_total > 0 && (
        <div className="pv-total">
          <span className="pv-moneda">
            <SvgSimbolo k="moneda" />
          </span>
          <div>
            <small>Premio total</small>
            <b>{dinero(s.premio_total)}</b>
            <span>Con un solo número puedes ganar</span>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className={`pv-grid pv-${items.length}`}>
          {items.map(([ico, t, regla, v, desde]) => (
            <div className="pv-item" key={t}>
              <span className="pv-ico">{ico}</span>
              <small>{t}</small>
              <b>{dinero(v)}</b>
              <em>
                {regla}
                <Ejemplo desde={desde} />
              </em>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PaginaSorteo() {
  useTemaNavegador('#F1F4EF');
  const { id = '' } = useParams();
  const { data: cfg } = useConfig();
  const q = useQuery({
    queryKey: ['sorteo', id],
    queryFn: () => api.sorteo(id),
    retry: (n, e) => !(e instanceof FalloApi && (e.status === 404 || e.status === 403)) && n < 1,
  });
  const s = q.data;
  // Botones, bordes, etiquetas y fondo con los colores de este sorteo.
  useTemaSorteo(s ? temaDe(s) : null);

  const [ocup, setOcup] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [recien, setRecien] = useState<Set<number>>(new Set());
  const [pop, setPop] = useState<number | null>(null);
  const [paso, setPaso] = useState<Paso>('elegir');
  const [tel, setTel] = useState(formatearTelefono(miTel()));
  const [nombre, setNombre] = useState('');
  const [nombreFijo, setNombreFijo] = useState(false);
  const [hola, setHola] = useState('');
  const [err, setErr] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ nombre: string; numeros: number[]; tel: string } | null>(null);
  /** Números que la persona tenía elegidos y otra persona apartó primero. */
  const [tomados, setTomados] = useState<{ numeros: number[]; alApartar: boolean } | null>(null);
  /** Límite por celular o dispositivo bloqueado: se piden por WhatsApp. */
  const [pedido, setPedido] = useState<{ mensaje: string; numeros: number[] } | null>(null);
  const [enVivo, setEnVivo] = useState(false);
  const zona = useRef<HTMLElement>(null);
  const celdas = useRef<(HTMLButtonElement | null)[]>([]);
  const nomRef = useRef<HTMLInputElement>(null);
  const telRef = useRef<HTMLInputElement>(null);

  /**
   * Aplica una lista nueva de ocupados: marca los nuevos y, si alguno estaba elegido, lo quita de la selección
   * y avisa con claridad cuál fue. Mientras se envía la reserva no se toca la selección (los números propios
   * pueden llegar por el tablero en vivo antes que la respuesta).
   */
  const ocupRef = useRef(ocup);
  ocupRef.current = ocup;
  const selRef = useRef(sel);
  selRef.current = sel;
  const enviandoRef = useRef(false);
  const aplicarOcupados = (lista: number[]) => {
    const nuevo = new Set(lista);
    const recienOcupados = lista.filter((n) => !ocupRef.current.has(n));
    if (recienOcupados.length) {
      setRecien(new Set(recienOcupados));
      setTimeout(() => setRecien(new Set()), 900);
    }
    setOcup(nuevo);
    if (enviandoRef.current) return;
    const perdidos = [...selRef.current].filter((n) => nuevo.has(n));
    if (!perdidos.length) return;
    setSel((sl) => new Set([...sl].filter((n) => !nuevo.has(n))));
    setTomados((t) => ({
      numeros: [...new Set([...(t?.numeros ?? []), ...perdidos])].sort((a, b) => a - b),
      alApartar: false,
    }));
    vibrar(30);
  };

  useEffect(() => {
    if (s) setOcup(new Set(s.ocupados));
  }, [s]);

  // Tablero en vivo: el servidor avisa al instante cada vez que alguien aparta o se libera un número.
  // Si en 5 s no llega nada (un proxy o túnel que retiene el canal), se cierra y queda la revisión rápida de abajo.
  useEffect(() => {
    if (!s || paso === 'listo' || typeof EventSource === 'undefined') return;
    const es = new EventSource(api.urlEnVivo(s.id));
    let recibido = false;
    const vigia = setTimeout(() => {
      if (!recibido) es.close();
    }, 5000);
    es.onerror = () => setEnVivo(false); // EventSource se reconecta solo
    es.onmessage = (e) => {
      recibido = true;
      setEnVivo(true);
      try {
        aplicarOcupados((JSON.parse(e.data) as { ocupados: number[] }).ocupados);
      } catch {
        /* mensaje dañado: se ignora */
      }
    };
    return () => {
      clearTimeout(vigia);
      es.close();
      setEnVivo(false);
    };
  }, [s, paso === 'listo']); // eslint-disable-line react-hooks/exhaustive-deps

  // Respaldo: sin canal en vivo, se revisa cada 3 s (con ETag: si nada cambió, el servidor responde vacío).
  // Solo con la página a la vista, para no gastar datos en segundo plano.
  const [revisando, setRevisando] = useState(false);
  useEffect(() => {
    if (!s || paso === 'listo' || enVivo) return setRevisando(false);
    const revisar = async () => {
      if (document.hidden) return;
      try {
        aplicarOcupados((await api.ocupados(s.id)).ocupados);
        setRevisando(true);
      } catch {
        setRevisando(false);
      }
    };
    const t = setInterval(revisar, 3000);
    // Al volver a la página (por ejemplo, desde WhatsApp) se revisa de inmediato.
    document.addEventListener('visibilitychange', revisar);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [s, paso, enVivo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Buscar el contacto al completar un celular válido.
  useEffect(() => {
    if (paso !== 'datos') return;
    const t = normalizarTelefono(tel);
    if (!telefonoValido(t)) {
      setHola('');
      if (nombreFijo) {
        setNombre('');
        setNombreFijo(false);
      }
      return;
    }
    let vigente = true;
    api
      .contacto(t)
      .then((c) => {
        if (!vigente) return;
        setNombre(c.nombre);
        setNombreFijo(true);
        setHola(`¡Hola de nuevo, ${c.nombre}! Ya estás en nuestra lista.`);
      })
      .catch(() => {
        if (!vigente) return;
        setHola('');
        if (nombreFijo) setNombre('');
        setNombreFijo(false);
      });
    return () => {
      vigente = false;
    };
  }, [tel, paso]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (paso === 'datos' && !normalizarTelefono(tel))
      setTimeout(() => telRef.current?.focus({ preventScroll: true }), 250);
    // Cada paso empieza arriba de la pantalla.
    window.scrollTo({ top: 0 });
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading)
    return (
      <Marco sinEncabezado>
        <p className="muted">Cargando sorteo…</p>
      </Marco>
    );
  // Sorteo programado que todavía no abre: se dice cuándo.
  if (q.error instanceof FalloApi && q.error.codigo === 'sin_abrir')
    return (
      <Marco sinEncabezado>
        <Link className="back" to="/sorteos">
          ← Todos los sorteos
        </Link>
        <div className="panel stack sin-abrir">
          <span className="sa-reloj" aria-hidden="true">
            ⏰
          </span>
          <h2>Este sorteo aún no abre</h2>
          <p>
            Abre el <b>{formatearApertura(String(q.error.detalle?.abre ?? ''))}</b>: vuelve a esa hora para apartar tus
            números.
          </p>
          <Link className="btn btn-primary btn-block" to="/sorteos">
            Ver los sorteos abiertos
          </Link>
        </div>
      </Marco>
    );
  if (q.isError && !(q.error instanceof FalloApi && q.error.status === 404))
    return (
      <Marco sinEncabezado>
        <ErrorCarga />
      </Marco>
    );
  if (!s)
    return (
      <Marco sinEncabezado>
        <Link className="back" to="/sorteos">
          ← Todos los sorteos
        </Link>
        <div className="panel">
          <h2>Este sorteo ya no está disponible</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Mira los sorteos abiertos en la página principal.
          </p>
        </div>
      </Marco>
    );

  // El ticket va al WhatsApp de cobro de este sorteo (su Nequi); si no tiene, al general de Ajustes.
  const cobro = s.nequi || cfg?.whatsapp || '';
  const tapa = s.logo_ocupado || cfg?.diseno.tablero.logoOcupado || null;
  const nums = [...sel].sort((a, b) => a - b);
  const k = nums.length;
  const max = s.max_por_celular;
  const agotado = ocup.size >= 100;
  const imagenAgotado = s.imagen_agotado || cfg?.diseno.tablero.agotado || null;
  const total = (n: number) => (s.gratis ? 'Gratis' : dinero(n * s.valor_boleta));
  const avisoMax = () =>
    avisar(`En este sorteo cada persona puede apartar hasta ${max} ${max === 1 ? 'número' : 'números'}`);

  const tocar = (n: number) => {
    if (ocup.has(n)) return;
    if (!sel.has(n) && max > 0 && sel.size >= max) return avisoMax();
    vibrar(8);
    setSel((x) => {
      const y = new Set(x);
      if (y.has(n)) y.delete(n);
      else y.add(n);
      return y;
    });
  };

  const alAzar = () => {
    if (max > 0 && sel.size >= max) return avisoMax();
    const libres = Array.from({ length: 100 }, (_, n) => n).filter((n) => !ocup.has(n) && !sel.has(n));
    if (!libres.length) return avisar('Ya no quedan números libres');
    const n = libres[Math.floor(Math.random() * libres.length)];
    vibrar(8);
    setSel((x) => new Set(x).add(n));
    celdas.current[n]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setPop(n);
    setTimeout(() => setPop(null), 400);
  };

  async function apartar() {
    const t = normalizarTelefono(tel);
    const nom = nombre.trim();
    if (!telefonoValido(t)) return setErr('Escribe tu celular de 10 dígitos. Debe empezar por 3.');
    if (nom.length < 2) return setErr('Escribe tu nombre para saber de quién son los números.');
    if (k < 1 || k > 30) return setErr('Elige entre 1 y 30 números.');
    if (max > 0 && k > max)
      return setErr(`En este sorteo cada persona puede apartar hasta ${max} ${max === 1 ? 'número' : 'números'}.`);
    setErr('');
    setPedido(null);
    setEnviando(true);
    enviandoRef.current = true;
    try {
      const r = await api.reservar(s!.id, { numeros: nums, nombre: nom, telefono: t });
      guardarMiTel(t);
      setHecho({ nombre: r.nombre, numeros: r.numeros, tel: t });
      setSel(new Set());
      setTomados(null);
      setPaso('listo');
    } catch (e) {
      if (e instanceof FalloApi && e.codigo === 'numeros_ocupados') {
        // Ganó otra persona: se dice cuáles, se marcan en el tablero y se conservan los demás elegidos.
        const o = ((e.detalle?.ocupados as number[]) ?? []).map(Number);
        setOcup((x) => new Set([...x, ...o]));
        setSel((x) => new Set([...x].filter((n) => !o.includes(n))));
        setTomados({ numeros: o, alApartar: true });
        vibrar(30);
        api
          .ocupados(s!.id)
          .then((r) => aplicarOcupados(r.ocupados))
          .catch(() => {});
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e instanceof FalloApi && (e.codigo === 'limite_dispositivo' || e.codigo === 'dispositivo_bloqueado')) {
        setPedido({ mensaje: e.message, numeros: nums });
      } else if (e instanceof FalloApi && e.codigo === 'sin_abrir') {
        void q.refetch();
      } else setErr(e instanceof Error ? e.message : 'No se pudo apartar. Intenta de nuevo.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  /** Aviso cuando otra persona apartó primero alguno de los números elegidos. */
  const avisoTomados = tomados && (
    <div className="aviso-tomados" role="alert">
      <b>{tomados.alApartar ? 'Llegaste unos segundos tarde' : 'Otra persona fue más rápida'}</b>
      <p>
        {tomados.numeros.length === 1 ? 'El ' : 'Los '}
        <span className="num">{tomados.numeros.map(dosDigitos).join(', ')}</span>{' '}
        {tomados.alApartar
          ? `${tomados.numeros.length === 1 ? 'lo apartó' : 'los apartó'} otra persona justo antes que tú. Gana quien toca “Apartar” primero.`
          : `${tomados.numeros.length === 1 ? 'lo acaba' : 'los acaba'} de apartar otra persona. ${tomados.numeros.length === 1 ? 'Lo quitamos' : 'Los quitamos'} de tu selección.`}{' '}
        {k > 0
          ? `Tus otros números (${nums.map(dosDigitos).join(', ')}) siguen elegidos.`
          : 'Elige otro en el tablero: ya está actualizado.'}
      </p>
      <div className="row-actions">
        {paso === 'datos' && k > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={enviando}
            onClick={() => (setTomados(null), void apartar())}
          >
            Apartar solo {nums.map(dosDigitos).join(', ')}
          </button>
        )}
        {paso === 'datos' ? (
          <button type="button" className="btn btn-sm" onClick={() => (setTomados(null), setPaso('elegir'))}>
            {k > 0 ? 'Cambiar por otros números' : 'Elegir otros números'}
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setTomados(null)}>
            Entendido
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Marco sinEncabezado>
      <Link className="back" to="/sorteos">
        ← Todos los sorteos
      </Link>
      <section className="s-head">
        <Portada s={s} className="s-thumb" />
        <div className="s-head-info">
          <h1>{s.nombre}</h1>
          <div className="s-line">
            <span className={`pill ${s.jornada}`}>{s.jornada === 'noche' ? 'Noche' : 'Día'}</span>
            {s.hora && <span>Juega a las {s.hora}</span>}
          </div>
        </div>
      </section>

      <section className="stack" ref={zona}>
        <ol className="pasos" aria-label="Pasos para apartar">
          {(
            [
              ['elegir', 'Elige'],
              ['datos', 'Tus datos'],
              ['listo', s.gratis ? 'Listo' : 'Paga'],
            ] as const
          ).map(([p, t], i) => {
            const actual = ['elegir', 'datos', 'listo'].indexOf(paso);
            return (
              <li
                key={p}
                className={i === actual ? 'actual' : i < actual ? 'hecho' : ''}
                aria-current={i === actual ? 'step' : undefined}
              >
                {t}
              </li>
            );
          })}
        </ol>
        {paso === 'elegir' && (
          <div className="zona-elegir stack">
            {avisoTomados}
            <div className="adm-head">
              <div>
                <h2>{agotado ? '¡Todos vendidos!' : 'Elige tus números'}</h2>
                {s.gratis ? (
                  <span className="vale-boleta vale-gratis">
                    <b>¡Sorteo gratis!</b> No pagas nada
                  </span>
                ) : (
                  <span className="vale-boleta">
                    Cada número vale <b>{dinero(s.valor_boleta)}</b>
                  </span>
                )}
                {max > 0 && (
                  <span className="vale-boleta">
                    Máximo <b>{max}</b> {max === 1 ? 'número' : 'números'} por persona
                  </span>
                )}
              </div>
              {!agotado && (
                <button type="button" className="btn btn-sm btn-sun" onClick={alAzar}>
                  Al azar
                </button>
              )}
            </div>
            {agotado ? (
              <div className="agotado" role="status">
                {imagenAgotado ? (
                  <img src={imagenAgotado} alt="¡Todos los números fueron vendidos!" />
                ) : (
                  <div className="agotado-base">
                    <SvgSimbolo k="moneda" />
                    <b>¡Todos los números vendidos!</b>
                    <span>Gracias por participar. Atento al grupo para el próximo sorteo.</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="legend">
                  <span>
                    <i />
                    Libre
                  </span>
                  <span>
                    <i className="l-sel" />
                    Elegido
                  </span>
                  <span className="l-tapa">
                    <i className="l-tak">
                      <Tapa url={tapa} />
                    </i>
                    Ocupado
                  </span>
                  {(enVivo || revisando) && (
                    <span className="en-vivo" title="El tablero se actualiza solo cuando alguien aparta">
                      <i aria-hidden="true" />
                      En vivo
                    </span>
                  )}
                </div>
                <div className="board" role="group" aria-label="Tablero del 00 al 99">
                  {Array.from({ length: 100 }, (_, n) => {
                    const t = ocup.has(n);
                    const e = sel.has(n);
                    return (
                      <button
                        key={n}
                        ref={(el) => void (celdas.current[n] = el)}
                        type="button"
                        className={`cell${t ? ' taken' : ''}${e ? ' sel' : ''}${recien.has(n) ? ' recien' : ''}${pop === n ? ' pop' : ''}`}
                        disabled={t}
                        aria-pressed={e}
                        aria-label={`${dosDigitos(n)}${t ? ' ocupado' : e ? ' elegido' : ''}`}
                        onClick={() => tocar(n)}
                      >
                        {t ? (
                          <span className="tapa">
                            <Tapa url={tapa} />
                          </span>
                        ) : (
                          dosDigitos(n)
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <Premios s={s} />
            {!agotado && (
              <div className="bar">
                <div style={{ minWidth: 0 }}>
                  <b>{k ? `${k} ${k === 1 ? 'número' : 'números'} · ${total(k)}` : 'Ningún número'}</b>
                  {k ? (
                    <span className="bar-nums num">{nums.map(dosDigitos).join(' · ')}</span>
                  ) : (
                    <span className="muted">Toca los números que quieras</span>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!k}
                  onClick={() => {
                    setErr('');
                    setPaso('datos');
                  }}
                >
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {paso === 'datos' && (
          <div className="panel stack">
            <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setPaso('elegir')}>
              ← Cambiar números
            </button>
            {avisoTomados}
            <h2>Tus datos</h2>
            <div className="chips">
              {nums.map((n) => (
                <span key={n} className="chip">
                  {dosDigitos(n)}
                </span>
              ))}
            </div>
            <p>
              {k} {k === 1 ? 'número' : 'números'} · <b>{total(k)}</b>
            </p>
            <form
              className="stack"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void apartar();
              }}
            >
              <div className="field">
                <label htmlFor="d-tel">Número de celular</label>
                <input
                  id="d-tel"
                  ref={telRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  enterKeyHint="next"
                  placeholder="300 123 4567"
                  value={tel}
                  onChange={(e) => setTel(textoCelular(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      nomRef.current?.focus();
                    }
                  }}
                />
              </div>
              {hola && <p className="hola">{hola}</p>}
              <div className="field">
                <label htmlFor="d-nombre">Nombre y apellido</label>
                <input
                  id="d-nombre"
                  ref={nomRef}
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  placeholder="Como te conocen en el grupo"
                  readOnly={nombreFijo}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              {err && <p className="err">{err}</p>}
              {pedido ? (
                <div className="aviso-pedido" role="alert">
                  <p>{pedido.mensaje}</p>
                  {cobro ? (
                    <a
                      className="btn btn-primary btn-block btn-wa"
                      target="_blank"
                      rel="noopener"
                      href={enlaceWhatsApp(
                        cobro,
                        mensajePedido({
                          negocio: cfg?.negocio ?? 'El Pato de la Suerte',
                          nombre: nombre.trim(),
                          telefono: tel,
                          sorteo: s.nombre,
                          numeros: pedido.numeros,
                          valor_boleta: s.valor_boleta,
                        }),
                      )}
                    >
                      Pedir {pedido.numeros.length === 1 ? 'mi número' : 'mis números'} por WhatsApp
                    </a>
                  ) : (
                    <p className="small muted">Escríbenos por el grupo de WhatsApp y te los separamos.</p>
                  )}
                  <button type="button" className="btn btn-block" onClick={() => (setPedido(null), setPaso('elegir'))}>
                    Cambiar mis números
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>
                  {enviando ? 'Apartando…' : 'Apartar mis números'}
                </button>
              )}
            </form>
          </div>
        )}

        {paso === 'listo' && hecho && s.gratis && (
          <>
            <article className="ticket ticket-gratis">
              <div className="t-top">
                <span className="tg-sello" aria-hidden="true">
                  <SvgSimbolo k="trebol" />
                </span>
                <p className="eyebrow">Sorteo gratis</p>
                <h2>¡Reserva exitosa!</h2>
                <p className="muted">{hecho.nombre}, tus números ya están a tu nombre:</p>
                <div className="chips">
                  {hecho.numeros.map((n) => (
                    <span key={n} className="chip">
                      {dosDigitos(n)}
                    </span>
                  ))}
                </div>
                <dl className="t-rows">
                  <dt>Sorteo</dt>
                  <dd>{s.nombre}</dd>
                  <dt>Juega</dt>
                  <dd>
                    {formatearFecha(s.fecha)}
                    {s.hora ? ' · ' + s.hora : ''}
                  </dd>
                  <dt>Celular</dt>
                  <dd className="num">{formatearTelefono(hecho.tel)}</dd>
                </dl>
              </div>
              <div className="perf" aria-hidden="true" />
              <div className="t-pay tg-gracias">
                <b>¡Gracias por participar! 🍀</b>
                <p>Sigue jugando con nosotros por grandes premios: el próximo ganador puedes ser tú.</p>
              </div>
            </article>
            <Link className="btn btn-block" to="/mis-numeros">
              Ver todos mis números
            </Link>
            <Link className="btn btn-primary btn-block" to="/sorteos">
              Ver más sorteos
            </Link>
          </>
        )}

        {paso === 'listo' && hecho && !s.gratis && (
          <>
            <article className="ticket">
              <div className="t-top">
                <p className="eyebrow">Números apartados</p>
                <h2>Listo, {hecho.nombre}</h2>
                <p className="muted">Tus números son:</p>
                <div className="chips">
                  {hecho.numeros.map((n) => (
                    <span key={n} className="chip">
                      {dosDigitos(n)}
                    </span>
                  ))}
                </div>
                <dl className="t-rows">
                  <dt>Sorteo</dt>
                  <dd>{s.nombre}</dd>
                  <dt>Juega</dt>
                  <dd>
                    {formatearFecha(s.fecha)}
                    {s.hora ? ' · ' + s.hora : ''}
                  </dd>
                  <dt>Celular</dt>
                  <dd className="num">{formatearTelefono(hecho.tel)}</dd>
                  <dt>Total a pagar</dt>
                  <dd className="num">{dinero(hecho.numeros.length * s.valor_boleta)}</dd>
                </dl>
              </div>
              <div className="perf" aria-hidden="true" />
              <div className="t-pay">
                <p className="eyebrow">Último paso</p>
                {cobro ? (
                  <>
                    <p>
                      Toca <b>Finalizar</b>: se abre el WhatsApp de quien recibe los pagos con tu ticket ya escrito. Por
                      ese mismo chat envías el comprobante.
                    </p>
                    <BotonFinalizar
                      plantilla={cfg?.plantilla_ticket}
                      whatsapp={cobro}
                      ticket={{
                        negocio: cfg?.negocio ?? 'El Pato de la Suerte',
                        nombre: hecho.nombre,
                        telefono: hecho.tel,
                        sorteo: s.nombre,
                        fecha: s.fecha,
                        hora: s.hora,
                        numeros: hecho.numeros,
                        valor_boleta: s.valor_boleta,
                        nequi: s.nequi,
                        nequi_titular: s.nequi_titular,
                      }}
                    />
                  </>
                ) : (
                  <p>Te contactaremos por WhatsApp para confirmar tu pago.</p>
                )}
                <p className="eyebrow" style={{ marginTop: 8 }}>
                  Paga por Nequi
                </p>
                {s.nequi ? (
                  <PagoNequi nequi={s.nequi} titular={s.nequi_titular} total={hecho.numeros.length * s.valor_boleta} />
                ) : (
                  <p>El número de pago te lo damos por WhatsApp.</p>
                )}
                <p className="small muted">
                  Tus números quedan a tu nombre. El pago se confirma cuando recibimos el comprobante.
                </p>
              </div>
            </article>
            <Link className="btn btn-block" to="/mis-numeros">
              Ver todos mis números
            </Link>
            <button
              className="btn btn-block"
              onClick={async () => {
                setHecho(null);
                setPaso('elegir');
                try {
                  setOcup(new Set((await api.ocupados(s.id)).ocupados));
                } catch {
                  /* se actualiza en el próximo ciclo */
                }
              }}
            >
              Apartar más números
            </button>
          </>
        )}
      </section>
    </Marco>
  );
}
