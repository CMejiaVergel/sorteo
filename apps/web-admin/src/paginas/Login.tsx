import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTemaNavegador } from '@pato/ui';
import { api } from '../api/cliente.ts';

export function PaginaLogin() {
  useTemaNavegador('#F1F4EF');
  const navegar = useNavigate();
  const lugar = useLocation();
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  return (
    <main className="wrap stack" style={{ paddingBlock: 40 }}>
      <div className="panel stack" style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
        <h1>Entrar</h1>
        <p className="muted">Usa el usuario y la contraseña de administrador.</p>
        <form
          className="stack"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            setError('');
            try {
              await api.login(usuario.trim(), clave);
              setClave('');
              await qc.invalidateQueries();
              const desde = (lugar.state as { desde?: string } | null)?.desde;
              navegar(desde && desde !== '/login' ? desde : '/sorteos', { replace: true });
            } catch (er) {
              setError(er instanceof Error ? er.message : 'Usuario o contraseña incorrectos');
            } finally {
              setEnviando(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="l-usuario">Usuario</label>
            <input
              id="l-usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="l-clave">Contraseña</label>
            <input id="l-clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </div>
          {error && <p className="err">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
