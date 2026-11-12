import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Ruleta, useTemaNavegador, type FinalGiro, type RespuestaLanzar } from '@pato/ui';
import { api, FalloApi } from '../api/cliente.ts';
import { giroDeHoy, guardarGiroDeHoy, guardarMiTel, miTel } from '../almacen.ts';
import { useConfig } from '../componentes/comunes.tsx';
import { Intro } from '../componentes/Intro.tsx';

/** Tarjeta de resultado con cuenta regresiva: 6 s si ganó, 3 s si no. */
function TarjetaResultado({ g, alTerminar }: { g: FinalGiro; alTerminar: () => void }) {
  const [n, setN] = useState(g.gano ? 6 : 3);
  useEffect(() => {
    if (n <= 0) {
      alTerminar();
      return;
    }
    const t = setTimeout(() => setN((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [n, alTerminar]);
  const pre = g.yaJugado ? 'Ya habías jugado hoy con este celular. ' : '';
  return (
    <div className={`c-res-card ${g.gano ? 'gano' : ''}`}>
      <b>{g.gano ? `¡Ganaste ${g.premio}!` : 'Esta vez no salió'}</b>
      <p>
        {pre}
        {g.gano
          ? 'Toma captura de pantalla. También te dejamos el premio a la vista en los sorteos para que lo reclames.'
          : 'Mañana tienes otro tiro gratis.'}
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={alTerminar}>
        Ir a los sorteos · <span>{n}</span>
      </button>
    </div>
  );
}

export function PaginaRuleta() {
  useTemaNavegador('#2F8FE0', 'fortuna');
  const navegar = useNavigate();
  const { data: cfg, isError, isLoading } = useConfig();
  // Se calcula una sola vez, al tener la configuración (con la marca de reinicio), para no redirigir a mitad del juego.
  const previoRef = useRef<ReturnType<typeof giroDeHoy> | undefined>(undefined);
  if (cfg && previoRef.current === undefined) previoRef.current = giroDeHoy(cfg.ruleta.reinicio);
  const previo = previoRef.current;
  const irSorteos = () => navegar('/sorteos', { replace: true });
  // La animación de inicio se muestra una vez por visita (no en cada recarga) y no con movimiento reducido.
  const [intro, setIntro] = useState(() => {
    try {
      return !sessionStorage.getItem('intro_visto') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  const terminarIntro = useCallback(() => {
    try {
      sessionStorage.setItem('intro_visto', '1');
    } catch {
      /* almacenamiento bloqueado */
    }
    setIntro(false);
  }, []);

  if (isLoading) return <section className="cielo" aria-busy="true" />;
  // Solo aparece si la ruleta está activa y este navegador no ha jugado hoy.
  if (isError || !cfg || !cfg.ruleta.activo || previo) return <Navigate to="/sorteos" replace />;

  async function lanzar(tel: string): Promise<RespuestaLanzar> {
    guardarMiTel(tel);
    try {
      const r = await api.girar(tel);
      guardarGiroDeHoy({ ...r, tel });
      return { ok: true, ...r };
    } catch (e) {
      if (e instanceof FalloApi && e.codigo === 'ya_giro') {
        const d = (e.detalle ?? {}) as { resultado?: string[]; gano?: number; premio?: string };
        const g = { resultado: d.resultado ?? [], gano: d.gano ?? 0, premio: d.premio ?? '' };
        guardarGiroDeHoy({ ...g, tel });
        return { ok: true, ...g, yaJugado: true };
      }
      if (e instanceof FalloApi && e.codigo === 'ruleta_inactiva') return { ok: false, mensaje: 'Ruleta apagada' };
      return { ok: false, mensaje: 'Intenta de nuevo' };
    }
  }

  return (
    <>
      {intro && <Intro logo={cfg.diseno.ruleta.logo} negocio={cfg.negocio} alTerminar={terminarIntro} />}
    <Ruleta
      diseno={cfg.diseno}
      premios={cfg.ruleta}
      pedirCelular
      celularInicial={miTel()}
      barraSuperior={
        <Link className="c-skip" to="/sorteos">
          Saltar →
        </Link>
      }
      lanzar={lanzar}
      resultado={(g) => <TarjetaResultado g={g} alTerminar={irSorteos} />}
      giroEntrada={!intro}
    />
    </>
  );
}
