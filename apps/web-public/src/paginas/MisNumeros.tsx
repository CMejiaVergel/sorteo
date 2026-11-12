import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatearTelefono, normalizarTelefono, telefonoValido, textoCelular } from '@pato/shared';
import { useTemaNavegador } from '@pato/ui';
import { guardarMiTel, miTel } from '../almacen.ts';
import { Marco } from '../componentes/comunes.tsx';
import { ResultadosMisNumeros } from '../componentes/ResultadosMisNumeros.tsx';

export function PaginaMisNumeros() {
  useTemaNavegador('#F1F4EF');
  const inicial = miTel();
  const [valor, setValor] = useState(formatearTelefono(inicial));
  const [buscado, setBuscado] = useState(telefonoValido(inicial) ? inicial : '');
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!buscado) setTimeout(() => ref.current?.focus({ preventScroll: true }), 250);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Marco>
      <Link className="back" to="/sorteos">
        ← Todos los sorteos
      </Link>
      <section className="stack">
        <div>
          <h1>Mis números</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Escribe tu celular y mira en qué sorteos estás participando y si ya pagaste.
          </p>
        </div>
        <form
          className="mn-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            ref.current?.blur();
            const t = normalizarTelefono(valor);
            if (!telefonoValido(t)) {
              setError('Escribe tu celular de 10 dígitos. Debe empezar por 3.');
              setBuscado('');
              return;
            }
            setError('');
            guardarMiTel(t);
            setBuscado(t);
          }}
        >
          <label htmlFor="mn-tel" className="oculto">
            Tu celular
          </label>
          <input
            id="mn-tel"
            ref={ref}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            enterKeyHint="search"
            placeholder="Tu celular: 300 123 4567"
            value={valor}
            onChange={(e) => setValor(textoCelular(e.target.value))}
          />
          <button className="btn btn-primary" type="submit">
            Buscar
          </button>
        </form>
        <div className="stack" aria-live="polite">
          {error && <p className="err">{error}</p>}
          {buscado && <ResultadosMisNumeros tel={buscado} />}
        </div>
      </section>
    </Marco>
  );
}
