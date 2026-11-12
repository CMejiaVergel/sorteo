import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  dinero,
  enlaceWhatsApp,
  formatearTelefono,
  horaCorta,
  normalizarTelefono,
  textoCelular,
  telefonoValido,
  temaDe,
  type SorteoResumen,
} from '@pato/shared';
import { portadaDe, SvgSimbolo, useTemaNavegador } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { giroDeHoy, guardarMiTel, miTel } from '../almacen.ts';
import { useConfig } from '../componentes/comunes.tsx';
import { ResultadosMisNumeros } from '../componentes/ResultadosMisNumeros.tsx';

function Tarjeta({ s }: { s: SorteoResumen }) {
  const t = temaDe(s);
  return (
    <Link className="pcard" to={`/sorteo/${s.id}`} style={{ '--c1': t.c1, '--c2': t.c2, '--neon': t.neon } as CSSProperties}>
      {s.hora && <span className="pc-hora">{horaCorta(s.hora)}</span>}
      <div className="pc-arte">
        <img src={portadaDe(s)} alt="" />
      </div>
      <h3 className="pc-nombre">{s.nombre}</h3>
      <span className="pc-lbl">Precio:</span>
      <span className="pc-precio">{dinero(s.valor_boleta)}</span>
    </Link>
  );
}

function Lupa() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function PaginaSorteos() {
  useTemaNavegador('#5E1013', 'menu');
  const { data: cfg } = useConfig();
  const sorteos = useQuery({ queryKey: ['sorteos'], queryFn: api.sorteos });
  const [valor, setValor] = useState(formatearTelefono(miTel()));
  const [consulta, setConsulta] = useState('');
  const [error, setError] = useState('');
  const resRef = useRef<HTMLDivElement>(null);
  const telRef = useRef<HTMLInputElement>(null);
  const gHoy = giroDeHoy(cfg?.ruleta.reinicio);
  const negocio = cfg?.negocio ?? 'El Pato de la Suerte';

  useEffect(() => {
    if (consulta) resRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [consulta]);

  const consultar = (texto: string, forzar: boolean) => {
    const t = normalizarTelefono(texto);
    if (!telefonoValido(t)) {
      if (forzar) {
        setConsulta('');
        setError('Escribe tu celular de 10 dígitos. Debe empezar por 3.');
      }
      return;
    }
    telRef.current?.blur();
    setError('');
    guardarMiTel(t);
    setConsulta(t);
  };

  const lista = sorteos.data ?? [];
  const normales = lista.filter((s) => !s.etiqueta.trim());
  const grupos: { et: string; items: SorteoResumen[] }[] = [];
  for (const s of lista.filter((x) => x.etiqueta.trim())) {
    const et = s.etiqueta.trim();
    let g = grupos.find((x) => x.et.toLowerCase() === et.toLowerCase());
    if (!g) grupos.push((g = { et, items: [] }));
    g.items.push(s);
  }
  // Siempre 2 columnas: tarjetas grandes, fáciles de tocar.
  const cols = 2;

  return (
    <section className="menu">
      <div className="m-top">
        <Link className="m-marca" to="/sorteos">
          {negocio}
        </Link>
        <span className="m-acc">
          {cfg?.ruleta.activo && !gHoy && (
            <Link className="m-ruleta" to="/" aria-label="Tiro gratis">
              <SvgSimbolo k="trebol" />
              <span>Tiro gratis</span>
            </Link>
          )}
        </span>
      </div>
      <h1 className="m-titulo">
        <span>Selecciona</span>
        <span>un sorteo</span>
      </h1>
      <form
        className="m-buscar"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          consultar(valor, true);
        }}
      >
        <label htmlFor="m-tel">
          <Lupa />
          Consulta tus números
        </label>
        <div className="m-buscar-fila">
          <input
            id="m-tel"
            ref={telRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            enterKeyHint="search"
            placeholder="Escribe tu celular"
            value={valor}
            onChange={(e) => {
              setValor(textoCelular(e.target.value));
              // Al completar 10 dígitos válidos la consulta se lanza sola.
              const t = normalizarTelefono(e.target.value);
              if (telefonoValido(t) && t !== consulta) consultar(t, false);
            }}
          />
          <button type="submit">Consultar</button>
        </div>
      </form>
      {(consulta || error) && (
        <div className="m-res stack" ref={resRef} aria-live="polite">
          {error ? <p className="err">{error}</p> : <ResultadosMisNumeros tel={consulta} />}
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              setConsulta('');
              setError('');
            }}
          >
            Cerrar
          </button>
        </div>
      )}
      {gHoy && gHoy.gano > 0 && (
        <div className="m-premio">
          <SvgSimbolo k="trebol" />
          <div>
            <b>¡Ganaste {gHoy.premio} hoy!</b>
            <span className="small">Reclámalo enviando tu celular {formatearTelefono(gHoy.tel)}.</span>
          </div>
          {cfg?.whatsapp && (
            <a
              href={enlaceWhatsApp(
                cfg.whatsapp,
                `Hola, gané ${gHoy.premio} en la ruleta de ${negocio}. Mi celular es ${formatearTelefono(gHoy.tel)}.`,
              )}
              target="_blank"
              rel="noopener"
            >
              Reclamar
            </a>
          )}
        </div>
      )}
      <div className="m-cont" style={{ '--cols': cols } as CSSProperties}>
        {sorteos.isLoading && <p className="m-cargando">Cargando sorteos…</p>}
        {sorteos.isError && (
          <div className="m-vacio">
            <b>No se pudo cargar.</b>
            <br />
            Revisa tu conexión y vuelve a abrir el link.
          </div>
        )}
        {sorteos.isSuccess && !lista.length && (
          <div className="m-vacio">
            <b>No hay sorteos abiertos en este momento.</b>
            <br />
            Vuelve pronto o escríbenos por WhatsApp.
          </div>
        )}
        {normales.length > 0 && (
          <div className="pgrid pflex">
            {normales.map((s) => (
              <Tarjeta key={s.id} s={s} />
            ))}
          </div>
        )}
        {grupos.length > 0 && (
          <div className="pgrupos">
            {grupos.map((g) => (
              <div className="pgrupo" key={g.et} style={{ '--n': g.items.length } as CSSProperties}>
                <span className="pg-banda">{g.et}</span>
                <div className="pgrid pgrid-g">
                  {g.items.map((s) => (
                    <Tarjeta key={s.id} s={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="m-pie">
        <span>@{negocio.toUpperCase().replace(/\s+/g, '')}</span>
      </footer>
    </section>
  );
}
