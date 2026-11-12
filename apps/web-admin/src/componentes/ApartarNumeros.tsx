import { forwardRef, useEffect, useState } from 'react';
import { dinero, dosDigitos } from '@pato/shared';
import { avisar } from '@pato/ui';
import { api, FalloApi } from '../api/cliente.ts';
import { SelectorContacto, SelectorNumeros, type PersonaElegida } from './Selectores.tsx';

export interface Prellenado {
  persona: PersonaElegida;
  fijo: boolean;
  /** Cambia cada vez que se pide prellenar, para reiniciar el formulario. */
  clave: number;
}

/**
 * Apartar números a nombre de alguien desde el panel (pedidos por WhatsApp) o agregar fijos.
 * Contacto: se elige de los guardados o se crea uno nuevo. Números: se tocan en el tablero.
 */
export const ApartarNumeros = forwardRef<
  HTMLDivElement,
  {
    sorteoId: string;
    valorBoleta: number;
    ocupados: Set<number>;
    prellenado: Prellenado | null;
    alTerminar: () => Promise<unknown>;
  }
>(function ApartarNumeros({ sorteoId, valorBoleta, ocupados, prellenado, alTerminar }, ref) {
  const [persona, setPersona] = useState<PersonaElegida | null>(null);
  const [fijo, setFijo] = useState(false);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [claveSelector, setClaveSelector] = useState(0);

  useEffect(() => {
    if (!prellenado) return;
    setPersona(prellenado.persona);
    setFijo(prellenado.fijo);
    setElegidos([]);
    setError('');
    setClaveSelector((k) => k + 1);
  }, [prellenado]);

  // Si alguien aparta por la página un número que estaba elegido aquí, se quita de la selección.
  const validos = elegidos.filter((n) => !ocupados.has(n));

  async function apartar() {
    if (!persona) return setError('Elige un contacto o agrega uno nuevo con nombre y celular.');
    if (!validos.length) return setError('Toca en el tablero los números que quieres apartar.');
    setError('');
    setEnviando(true);
    try {
      const r = await api.apartar(sorteoId, { ...persona, numeros: validos, fijo });
      avisar(`${r.numeros.map(dosDigitos).join(', ')} ${fijo ? 'quedaron fijos' : 'apartados'} para ${r.nombre}`);
      setElegidos([]);
      setPersona(null);
      setFijo(false);
      setClaveSelector((k) => k + 1);
      await alTerminar();
    } catch (er) {
      if (er instanceof FalloApi && er.codigo === 'numeros_ocupados') await alTerminar();
      setError(er instanceof Error ? er.message : 'No se pudo apartar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="panel stack" ref={ref}>
      <div>
        <h3>Apartar números</h3>
        <p className="muted small">Para pedidos que te llegan por WhatsApp o para los números fijos de este sorteo.</p>
      </div>
      <div className="field">
        <span className="eyebrow">1. ¿Para quién?</span>
        <SelectorContacto key={claveSelector} valor={persona} alCambiar={setPersona} />
      </div>
      <div className="field">
        <span className="eyebrow">2. Tipo</span>
        <div className="seg-tipo" role="radiogroup" aria-label="Tipo de reserva">
          <button type="button" role="radio" aria-checked={!fijo} onClick={() => setFijo(false)}>
            Normal
          </button>
          <button type="button" role="radio" aria-checked={fijo} onClick={() => setFijo(true)}>
            Fijo
          </button>
        </div>
        <p className="hint">
          {fijo
            ? 'Los fijos son solo de este sorteo. Cópialos a otro con “Copiar fijos”.'
            : 'Como si la persona lo hubiera apartado desde la página.'}
        </p>
      </div>
      <div className="field">
        <span className="eyebrow">
          3. Números {validos.length > 0 && `· ${validos.length} elegidos · ${dinero(validos.length * valorBoleta)}`}
        </span>
        <SelectorNumeros ocupados={ocupados} elegidos={validos} alAlternar={(n) => setElegidos((e) => (e.includes(n) ? e.filter((x) => x !== n) : [...e, n].sort((a, b) => a - b)))} />
        <p className="hint">Los tachados ya están ocupados.</p>
      </div>
      {error && <p className="err">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={apartar}>
        {enviando
          ? 'Apartando…'
          : validos.length && persona
            ? `${fijo ? 'Dejar fijos' : 'Apartar'} ${validos.map(dosDigitos).join(', ')} para ${persona.nombre}`
            : fijo
              ? 'Dejar números fijos'
              : 'Apartar números'}
      </button>
    </div>
  );
});
