import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { formatearTelefono, normalizarTelefono, SIMBOLOS, telefonoValido, textoCelular, type Diseno, type Simbolo } from '@pato/shared';
import { SvgSimbolo } from './Sprite.tsx';
import { vibrar } from './comunes.tsx';

export interface FinalGiro {
  resultado: string[];
  gano: number;
  premio: string;
  /** El celular ya había jugado hoy (respuesta ya_giro). */
  yaJugado?: boolean;
}

export type RespuestaLanzar = ({ ok: true } & FinalGiro) | { ok: false; mensaje: string };

interface Props {
  diseno: Diseno;
  premios: { premio_tres: string; premio_dos: string };
  /** Barra de arriba (enlace "Saltar →" o la etiqueta de modo prueba). */
  barraSuperior: ReactNode;
  /** false en modo prueba: no se pide celular. */
  pedirCelular: boolean;
  celularInicial?: string;
  lanzar: (telefono: string) => Promise<RespuestaLanzar>;
  /** Tarjeta de resultado; recibe una función para dejar la ruleta lista otra vez. */
  resultado: (g: FinalGiro, reiniciar: () => void) => ReactNode;
  /** Cuando pasa a true, los rodillos dan un giro de bienvenida y quedan en una posición al azar. */
  giroEntrada?: boolean;
  /** Línea con los premios debajo del botón (en el sitio público va oculta: menos texto, más ruleta). */
  mostrarReglas?: boolean;
}

const azar = (): Simbolo => SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)];
const clave = (k: string): Simbolo => ((SIMBOLOS as readonly string[]).includes(k) ? (k as Simbolo) : azar());
const reducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/** Espera a que se pinte un cuadro; si el navegador no está dibujando (pestaña de fondo), sigue a los 60 ms. */
const cuadro = () =>
  new Promise<void>((ok) => {
    const t = setTimeout(ok, 60);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(t);
        ok();
      }),
    );
  });

interface Columna {
  items: Simbolo[];
  y: number;
  dur: number;
}

function Cristal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 90" aria-hidden="true">
      <path d="M8 90 18 42 30 70 40 6 52 66 62 30 74 90Z" fill={color} stroke="rgb(0 0 0 / .25)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 6 36 70M18 42 22 80M62 30 58 80" stroke="#FFFFFF" strokeWidth="3" opacity=".45" strokeLinecap="round" />
    </svg>
  );
}

/** Ruleta tragamonedas: proforma base (castillo) o máquina personalizada con ventana. */
export function Ruleta({ diseno, premios, barraSuperior, pedirCelular, celularInicial = '', lanzar, resultado, giroEntrada = false, mostrarReglas = false }: Props) {
  const d = diseno.ruleta;
  const [cols, setCols] = useState<Columna[]>(() => [0, 1, 2].map(() => ({ items: [azar(), azar(), azar()], y: 0, dur: 0 })));
  const [gana, setGana] = useState<boolean[]>([false, false, false]);
  const [titulo, setTitulo] = useState({ texto: 'Tiro gratis del día', n: 0 });
  const [tel, setTel] = useState(formatearTelefono(celularInicial));
  const [alerta, setAlerta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [final, setFinal] = useState<FinalGiro | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const telRef = useRef<HTMLInputElement>(null);

  const decir = (texto: string) => setTitulo((t) => ({ texto, n: t.n + 1 }));

  async function girarRodillos(fila: Simbolo[]) {
    if (reducido()) {
      setCols(fila.map((k) => ({ items: [azar(), k, azar()], y: 0, dur: 0 })));
      return;
    }
    const altos = [0, 1, 2].map((c) => (colRefs.current[c]?.offsetHeight ?? 300) / 3);
    const tiras = cols.map((col, c) => [...col.items, ...Array.from({ length: 16 + c * 5 }, azar), azar(), fila[c], azar()]);
    setCols(tiras.map((items) => ({ items, y: 0, dur: 0 })));
    await cuadro();
    setCols(tiras.map((items, c) => ({ items, y: -(items.length - 3) * altos[c], dur: 1.3 + c * 0.45 })));
    await esperar(2200 + 120);
    setCols(tiras.map((items) => ({ items: items.slice(-3), y: 0, dur: 0 })));
  }

  // Giro de bienvenida: una sola vez, sin resultado ni premio, solo para invitar a jugar.
  const yaDioBienvenida = useRef(false);
  useEffect(() => {
    if (!giroEntrada || yaDioBienvenida.current) return;
    const t = setTimeout(async () => {
      if (yaDioBienvenida.current) return;
      yaDioBienvenida.current = true;
      setOcupado(true);
      decir('¡Prepárate!');
      const mezcla = [...SIMBOLOS].sort(() => Math.random() - 0.5);
      await girarRodillos([mezcla[0], mezcla[1], mezcla[2]]);
      setOcupado(false);
      decir('Tiro gratis del día');
    }, 250);
    return () => clearTimeout(t);
  }, [giroEntrada]); // eslint-disable-line react-hooks/exhaustive-deps

  function resaltar(fila: string[], gano: number) {
    if (!gano) return setGana([false, false, false]);
    setGana(fila.map((k) => fila.filter((x) => x === k).length >= 2));
  }

  function reiniciar() {
    setFinal(null);
    setOcupado(false);
    setGana([false, false, false]);
    decir('Tiro gratis del día');
  }

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    const t = normalizarTelefono(tel);
    if (pedirCelular && !telefonoValido(t)) {
      decir('Escribe tu celular');
      setAlerta(true);
      telRef.current?.focus();
      setTimeout(() => setAlerta(false), 600);
      return;
    }
    telRef.current?.blur();
    setOcupado(true);
    vibrar(15);
    decir('¡Suerte!');
    setGana([false, false, false]);
    const r = await lanzar(t);
    if (!r.ok) {
      setOcupado(false);
      decir(r.mensaje);
      return;
    }
    const fila = r.resultado.map(clave);
    if (r.resultado.length === 3) await girarRodillos(fila);
    resaltar(fila, r.gano);
    if (r.gano) vibrar([40, 60, 40]);
    decir(r.yaJugado ? 'Ya jugaste hoy' : r.gano === 3 ? '¡Ganaste!' : r.gano === 2 ? '¡2 iguales!' : 'Casi…');
    setFinal({ ...r, resultado: fila });
  }

  const simbolo = (k: Simbolo, i: number, c: number, enMedio: boolean) => {
    const img = d.simbolos[k];
    return (
      <div key={i} className={`sim${enMedio && gana[c] ? ' gana' : ''}`} data-k={k}>
        {img ? <img src={img} alt="" /> : <SvgSimbolo k={k} />}
      </div>
    );
  };

  const rodillos = (extra = '', style?: CSSProperties) => (
    <div className={`c-rodillos tablas ${extra}`} style={style} aria-live="polite" aria-label="Tragamonedas">
      {cols.map((col, c) => (
        <div className="col" key={c} ref={(el) => void (colRefs.current[c] = el)}>
          <div
            className="strip"
            style={{
              transform: `translateY(${col.y}px)`,
              transition: col.dur ? `transform ${col.dur}s cubic-bezier(.12,.75,.18,1.02)` : 'none',
            }}
          >
            {col.items.map((k, i) => simbolo(k, i, c, col.items.length === 3 && i === 1))}
          </div>
        </div>
      ))}
    </div>
  );

  const campoTel = (
    <>
      <i className="clavo c1" />
      <i className="clavo c2" />
      <i className="clavo c3" />
      <i className="clavo c4" />
      {/* Sin placa visible: el campo ya dice "Escribe tu celular". La etiqueta queda para lectores de pantalla. */}
      <label htmlFor="f-tel" className="oculto">
        Tu celular para jugar
      </label>
      <input
        id="f-tel"
        ref={telRef}
        className={alerta ? 'alerta' : ''}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        enterKeyHint="go"
        placeholder={pedirCelular ? 'Escribe tu celular' : ''}
        disabled={!pedirCelular}
        value={tel}
        onChange={(e) => setTel(textoCelular(e.target.value))}
      />
    </>
  );

  const v = d.ventana;
  const estilo = {
    '--sim': `${d.escalaSimbolos}%`,
    '--piedra': d.colorCastillo,
    '--lanza': d.colorBoton,
    ...(d.fondo ? { '--fondo': `url('${d.fondo}')` } : {}),
  } as CSSProperties;
  const conLogo = !!d.logo && !d.ocultarLogo;

  return (
    <section className={`cielo ${d.fondo ? 'con-fondo' : ''}`} style={estilo}>
      {!d.fondo && (
        <div className="c-nubes" aria-hidden="true">
          <i className="n1" />
          <i className="n2" />
          <i className="n3" />
        </div>
      )}
      <div className="c-top">{barraSuperior}</div>
      {(conLogo || d.mascota) && (
        <header className="c-cab">
          {d.mascota && <img className="c-mascota izq" src={d.mascota} alt="" />}
          <div className="c-logo">{conLogo && <img src={d.logo!} alt="" />}</div>
          {d.mascota && <img className="c-mascota der" src={d.mascota} alt="" />}
        </header>
      )}
      <h1 className="c-titulo">
        <span key={titulo.n} className={titulo.n ? 'pop' : ''} aria-live="polite">
          {titulo.texto}
        </span>
      </h1>
      <form className="c-juego" onSubmit={alEnviar} noValidate>
        {d.maquina ? (
          <>
            <div className="maquina">
              <div className="maquina-caja">
                <img src={d.maquina} alt="" />
                {rodillos(`ventana${d.rodillosBlancos ? ' blancos' : ''}`, { left: `${v.x}%`, top: `${v.y}%`, width: `${v.w}%`, height: `${v.h}%` })}
              </div>
            </div>
            <div className="c-ranura suelta">{campoTel}</div>
          </>
        ) : (
          <>
            <div className="castillo">
              <div className="c-banner">
                <span>¡Gira y gana!</span>
              </div>
              <i className="c-pend izq" aria-hidden="true" />
              <i className="c-pend der" aria-hidden="true" />
              {rodillos()}
              <i className="c-gema g1" aria-hidden="true" />
              <i className="c-gema g2" aria-hidden="true" />
              <div className="c-ranura">{campoTel}</div>
            </div>
            <div className="c-suelo" aria-hidden="true">
              <span className="cr izq">
                <Cristal color="#F0457A" />
              </span>
              <span className="cr der">
                <Cristal color="#A84BF0" />
              </span>
            </div>
          </>
        )}
        <button className={`lanza ${d.botonImagen ? 'lanza-img' : ''}`} type="submit" aria-label="Lanza" disabled={ocupado}>
          {d.botonImagen ? (
            <img src={d.botonImagen} alt="" />
          ) : (
            <span className="l-tecla">
              <span className="l-txt">Lanza</span>
            </span>
          )}
        </button>
      </form>
      {mostrarReglas && (
        <p className="c-reglas">
          3 iguales en la línea del medio: <b>{premios.premio_tres}</b> · 2 iguales: <b>{premios.premio_dos}</b>
        </p>
      )}
      {final && <div className="c-res">{resultado(final, reiniciar)}</div>}
    </section>
  );
}
