import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatearTelefono, normalizarTelefono, telefonoValido, type Contacto } from '@pato/shared';
import { avisar, BotonDobleToque } from '@pato/ui';
import { api } from '../api/cliente.ts';
import { ErrorPanel } from '../componentes/Marco.tsx';

/** Valida nombre y celular igual que el servidor, para avisar antes de enviar. */
function revisar(nombre: string, tel: string): string {
  if (nombre.trim().length < 2) return 'Escribe el nombre (mínimo 2 letras).';
  if (!telefonoValido(normalizarTelefono(tel))) return 'Escribe un celular de 10 dígitos que empiece por 3.';
  return '';
}

export function PaginaContactos() {
  const qc = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [q, setQ] = useState('');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(buscar.trim()), 250);
    return () => clearTimeout(t);
  }, [buscar]);
  const lista = useQuery({ queryKey: ['contactos', q], queryFn: () => api.contactos(q), placeholderData: (p) => p });
  const recargar = () => qc.invalidateQueries({ queryKey: ['contactos'] });

  return (
    <>
      <div className="adm-head">
        <h2>Banco de contactos</h2>
        <span className="muted num">
          {lista.data?.length ?? 0}
          {lista.data?.length === 300 ? '+' : ''} contactos
        </span>
      </div>
      <p className="muted small">Quien aparta desde la página queda guardado aquí solo. Los contactos sirven para todos los sorteos.</p>
      <form
        className="panel stack"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const err = revisar(nombre, tel);
          if (err) return setError(err);
          setError('');
          setGuardando(true);
          try {
            const c = await api.crearContacto({ nombre: nombre.trim(), telefono: normalizarTelefono(tel) });
            avisar(`${c.nombre} guardado`);
            setNombre('');
            setTel('');
            await recargar();
          } catch (er) {
            setError(er instanceof Error ? er.message : 'No se pudo guardar');
          } finally {
            setGuardando(false);
          }
        }}
      >
        <h3>Agregar contacto</h3>
        <div className="grid2">
          <div className="field">
            <label htmlFor="c-nom">Nombre</label>
            <input id="c-nom" type="text" autoComplete="off" placeholder="Ana Ruiz" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-tel">Celular</label>
            <input id="c-tel" type="tel" inputMode="numeric" autoComplete="off" placeholder="300 123 4567" value={tel} onChange={(e) => setTel(e.target.value)} />
          </div>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            Guardar contacto
          </button>
        </div>
        <details className="stack">
          <summary className="small">Importar varios a la vez (pegar una lista)</summary>
          <p className="muted small">
            Una persona por línea, con nombre y celular en cualquier orden. Ejemplo: <b>Miguel 3001234567</b>. Si el celular ya existe, se actualiza el nombre.
          </p>
          <label htmlFor="c-imp" className="oculto">
            Contactos
          </label>
          <textarea id="c-imp" placeholder={'Miguel Pérez 3001234567\n3109876543 Carlos Díaz'} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {errores.length > 0 && (
            <p className="err">
              Estas líneas no tienen nombre y celular válidos:
              {errores.map((l, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {l}
                </span>
              ))}
            </p>
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn"
              disabled={guardando || !texto.trim()}
              onClick={async () => {
                setGuardando(true);
                try {
                  const r = await api.guardarContactos(texto);
                  avisar(`${r.guardados} contacto(s) guardado(s)`);
                  setErrores(r.errores);
                  setTexto(r.errores.join('\n'));
                  await recargar();
                } catch (er) {
                  avisar(er instanceof Error ? er.message : 'No se pudo guardar');
                } finally {
                  setGuardando(false);
                }
              }}
            >
              Importar lista
            </button>
          </div>
        </details>
      </form>
      <div className="field">
        <label htmlFor="c-q">Buscar</label>
        <input id="c-q" type="text" enterKeyHint="search" placeholder="Nombre o celular" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      {lista.isError && <ErrorPanel />}
      <div className="rows">
        {lista.data?.length ? (
          lista.data.map((c) =>
            editando === c.telefono ? (
              <EditarContacto
                key={c.telefono}
                c={c}
                alCerrar={() => setEditando(null)}
                alGuardar={async () => {
                  setEditando(null);
                  await Promise.all([recargar(), qc.invalidateQueries({ queryKey: ['reservas'] })]);
                }}
              />
            ) : (
              <div className="row" key={c.telefono}>
                <div className="row-main">
                  <b>{c.nombre}</b>
                  <span className="small muted num">{formatearTelefono(c.telefono)}</span>
                </div>
                <div className="row-actions">
                  <button className="btn btn-sm" onClick={() => setEditando(c.telefono)}>
                    Editar
                  </button>
                  <BotonDobleToque
                    className="btn btn-sm btn-danger"
                    accion={async () => {
                      try {
                        await api.borrarContacto(c.telefono);
                        avisar('Contacto borrado');
                        await recargar();
                      } catch (er) {
                        avisar(er instanceof Error ? er.message : 'No se pudo borrar');
                      }
                    }}
                  >
                    Borrar
                  </BotonDobleToque>
                </div>
              </div>
            ),
          )
        ) : (
          <div className="row">
            <span className="muted">{lista.isLoading ? 'Cargando…' : 'No hay contactos que coincidan.'}</span>
          </div>
        )}
      </div>
    </>
  );
}

/** Corrige nombre o celular. El cambio también se aplica a los números que tenga apartados. */
function EditarContacto({ c, alCerrar, alGuardar }: { c: Contacto; alCerrar: () => void; alGuardar: () => Promise<unknown> }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [tel, setTel] = useState(formatearTelefono(c.telefono));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  return (
    <form
      className="row contacto-edit stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const err = revisar(nombre, tel);
        if (err) return setError(err);
        setGuardando(true);
        try {
          await api.editarContacto(c.telefono, { nombre: nombre.trim(), telefono: normalizarTelefono(tel) });
          avisar('Contacto actualizado');
          await alGuardar();
        } catch (er) {
          setError(er instanceof Error ? er.message : 'No se pudo guardar');
          setGuardando(false);
        }
      }}
    >
      <div className="grid2">
        <div className="field">
          <label htmlFor={`e-n-${c.telefono}`}>Nombre</label>
          <input id={`e-n-${c.telefono}`} type="text" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`e-t-${c.telefono}`}>Celular</label>
          <input id={`e-t-${c.telefono}`} type="tel" inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} />
        </div>
      </div>
      <p className="hint">El cambio también se aplica a los números que tenga apartados en los sorteos.</p>
      {error && <p className="err">{error}</p>}
      <div className="row-actions">
        <button className="btn btn-sm btn-primary" type="submit" disabled={guardando}>
          Guardar cambios
        </button>
        <button className="btn btn-sm" type="button" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
