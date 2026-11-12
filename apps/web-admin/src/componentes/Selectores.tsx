import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { dosDigitos, formatearTelefono, normalizarTelefono, telefonoValido } from '@pato/shared';
import { api } from '../api/cliente.ts';

export interface PersonaElegida {
  telefono: string;
  nombre: string;
}

/** Retrasa un valor para no consultar al servidor en cada tecla. */
function useRetraso<T>(v: T, ms = 250): T {
  const [x, setX] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return x;
}

/**
 * Elige un contacto guardado buscando por nombre o celular. Si no está, "Agregar contacto nuevo"
 * muestra los campos de nombre y celular. Devuelve null mientras no haya una persona válida.
 */
export function SelectorContacto({
  valor,
  alCambiar,
}: {
  valor: PersonaElegida | null;
  alCambiar: (p: PersonaElegida | null) => void;
}) {
  const id = useId();
  const [modo, setModo] = useState<'buscar' | 'nuevo'>('buscar');
  const [busca, setBusca] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const q = useRetraso(busca.trim());
  const lista = useQuery({
    queryKey: ['contactos', q],
    queryFn: () => api.contactos(q),
    enabled: modo === 'buscar' && !valor,
    placeholderData: (p) => p,
  });

  const telN = normalizarTelefono(tel);
  const telOk = telefonoValido(telN);
  const existente = useQuery({
    queryKey: ['contactos', telN],
    queryFn: () => api.contactos(telN),
    enabled: modo === 'nuevo' && telOk,
  });
  const yaGuardado = existente.data?.find((c) => c.telefono === telN);

  // En modo nuevo, la persona es válida cuando nombre y celular lo son.
  useEffect(() => {
    if (modo !== 'nuevo') return;
    const n = nombre.trim().replace(/\s+/g, ' ');
    alCambiar(n.length >= 2 && telOk ? { nombre: n, telefono: telN } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, nombre, telN, telOk]);

  if (valor && modo === 'buscar')
    return (
      <div className="persona-elegida">
        <div>
          <b>{valor.nombre}</b>
          <span className="small muted num">{formatearTelefono(valor.telefono)}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => alCambiar(null)}>
          Cambiar
        </button>
      </div>
    );

  if (modo === 'nuevo')
    return (
      <div className="stack" style={{ gap: 10 }}>
        <div className="grid2">
          <div className="field">
            <label htmlFor={id + 'n'}>Nombre</label>
            <input
              id={id + 'n'}
              type="text"
              autoComplete="off"
              placeholder="Ana Ruiz"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={id + 't'}>Celular</label>
            <input
              id={id + 't'}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="300 123 4567"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
            />
            {tel.trim() && !telOk && <p className="hint">10 dígitos, empieza por 3.</p>}
          </div>
        </div>
        {yaGuardado && (
          <div className="warn">
            Ese celular ya está guardado como <b>{yaGuardado.nombre}</b>.{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModo('buscar');
                alCambiar({ telefono: yaGuardado.telefono, nombre: yaGuardado.nombre });
              }}
            >
              Usar ese contacto
            </button>
          </div>
        )}
        <button
          type="button"
          className="link-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setModo('buscar');
            alCambiar(null);
          }}
        >
          ← Buscar en mis contactos
        </button>
      </div>
    );

  const resultados = (lista.data ?? []).slice(0, 8);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label htmlFor={id + 'b'} className="oculto">
        Buscar contacto
      </label>
      <input
        id={id + 'b'}
        type="text" enterKeyHint="search"
        autoComplete="off"
        placeholder="Busca por nombre o celular"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="busca-lista" role="listbox" aria-label="Contactos">
        {resultados.map((c) => (
          <button
            type="button"
            role="option"
            aria-selected={false}
            key={c.telefono}
            onClick={() => alCambiar({ telefono: c.telefono, nombre: c.nombre })}
          >
            <b>{c.nombre}</b>
            <span className="small muted num">{formatearTelefono(c.telefono)}</span>
          </button>
        ))}
        {!resultados.length && (
          <p className="small muted">{lista.isLoading ? 'Buscando…' : 'No hay contactos con ese nombre o celular.'}</p>
        )}
        <button
          type="button"
          className="busca-nuevo"
          onClick={() => {
            // Lo que se escribió en la búsqueda pasa al campo que corresponde.
            const t = busca.trim();
            if (/^[\d\s+()-]+$/.test(t)) setTel(t);
            else if (t) setNombre(t);
            setModo('nuevo');
          }}
        >
          + Agregar contacto nuevo
        </button>
      </div>
    </div>
  );
}

/** Tablero 00–99 para elegir números. Los ocupados salen tachados y no se pueden tocar. */
export function SelectorNumeros({
  ocupados,
  elegidos,
  alAlternar,
}: {
  ocupados: Set<number>;
  elegidos: number[];
  alAlternar: (n: number) => void;
}) {
  return (
    <div className="sel-nums" role="group" aria-label="Números del tablero">
      {Array.from({ length: 100 }, (_, n) => {
        const ocu = ocupados.has(n);
        const sel = elegidos.includes(n);
        return (
          <button
            type="button"
            key={n}
            disabled={ocu}
            aria-pressed={sel}
            aria-label={ocu ? `${dosDigitos(n)} ocupado` : dosDigitos(n)}
            onClick={() => alAlternar(n)}
          >
            {dosDigitos(n)}
          </button>
        );
      })}
    </div>
  );
}
