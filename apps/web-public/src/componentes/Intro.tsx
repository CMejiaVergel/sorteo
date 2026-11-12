import { useEffect, useState, type CSSProperties } from 'react';
import { SvgSimbolo } from '@pato/ui';

const DURACION = 2600;
const SALIDA = 450;

/**
 * Animación de bienvenida antes de la ruleta: el logo entra rebotando sobre rayos de luz,
 * salta una lluvia de monedas y tréboles, y se desvanece. Un toque la salta.
 */
export function Intro({ logo, negocio, alTerminar }: { logo: string | null; negocio: string; alTerminar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setSaliendo(true), DURACION);
    return () => clearTimeout(a);
  }, []);
  useEffect(() => {
    if (!saliendo) return;
    const b = setTimeout(alTerminar, SALIDA);
    return () => clearTimeout(b);
  }, [saliendo, alTerminar]);

  const piezas = Array.from({ length: 14 }, (_, i) => ({
    k: i % 3 === 2 ? 'trebol' : 'moneda',
    a: `${(360 / 14) * i + (i % 2 ? 8 : -6)}deg`,
    d: `${0.45 + (i % 4) * 0.07}s`,
    r: `${34 + (i % 3) * 8}vmin`,
  }));

  return (
    <div className={`intro${saliendo ? ' saliendo' : ''}`} onClick={() => setSaliendo(true)} role="presentation">
      <div className="intro-rayos" aria-hidden="true" />
      <div className="c-nubes" aria-hidden="true">
        <i className="n1" />
        <i className="n2" />
        <i className="n3" />
      </div>
      {piezas.map((p, i) => (
        <span key={i} className="intro-pieza" style={{ '--a': p.a, '--d': p.d, '--r': p.r } as CSSProperties} aria-hidden="true">
          <SvgSimbolo k={p.k} />
        </span>
      ))}
      <div className="intro-centro">
        {logo ? <img className="intro-logo" src={logo} alt={negocio} /> : <SvgSimbolo k="moneda" className="intro-logo" />}
        <p className="intro-texto">
          <span>¡Bienvenido!</span>
        </p>
      </div>
      <span className="intro-saltar">Toca para continuar</span>
    </div>
  );
}
