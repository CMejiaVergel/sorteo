import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { esColorHex, hoyBogota, normalizarTelefono, temaDe, TEMAS, type Sorteo } from '@pato/shared';
import { avisar, BotonDobleToque } from '@pato/ui';
import { api, type SorteoDatos } from '../api/cliente.ts';
import { Cargando, ErrorPanel } from '../componentes/Marco.tsx';
import { SelectorImagen } from '../componentes/SelectorImagen.tsx';
import { guardarAvisos } from './Gestion.tsx';

const VACIO: SorteoDatos = {
  nombre: '',
  loteria: '',
  jornada: 'dia',
  fecha: hoyBogota(new Date()),
  hora: '',
  orden: 0,
  color: '',
  etiqueta: '',
  activo: true,
  valor_boleta: 0,
  premio_total: 0,
  premio_ultimas: 0,
  premio_primeras: 0,
  premio_medio: 0,
  nequi: '',
  nequi_titular: '',
  imagen: '',
  logo_loteria: '',
  logo_ocupado: '',
  fondo_imagen: '',
  gratis: false,
  max_por_celular: 0,
  abre: null,
  imagen_agotado: '',
  lista_encabezado: '',
  lista_pie: '',
};

const quitarMeta = ({ id: _i, creado: _c, ...d }: Sorteo): SorteoDatos => d;

/** Apertura propuesta al activar la programación: el día del sorteo a las 7:00 a. m. (o hoy si no tiene fecha). */
const aperturaSugerida = (d: SorteoDatos) => `${d.fecha || hoyBogota(new Date())}T07:00`;

export function PaginaEditor() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['sorteo', id], queryFn: () => api.sorteo(id!), enabled: !!id });
  if (id && q.isLoading) return <Cargando />;
  if (id && (q.isError || !q.data)) return <ErrorPanel mensaje="No encontré ese sorteo." />;
  return <Formulario key={id ?? 'nuevo'} id={id} inicial={q.data ? quitarMeta(q.data) : VACIO} />;
}

function Formulario({ id, inicial }: { id?: string; inicial: SorteoDatos }) {
  const [d, setD] = useState<SorteoDatos>(inicial);
  const [nums, setNums] = useState<Record<string, string>>({});
  const [fijos, setFijos] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const navegar = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const set = <K extends keyof SorteoDatos>(k: K, v: SorteoDatos[K]) => setD((x) => ({ ...x, [k]: v }));
  const campo = (k: keyof SorteoDatos, t: string, extra: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{t}</label>
      <input
        id={`f-${k}`}
        type="text"
        value={String(d[k] ?? '')}
        onChange={(e) => set(k, e.target.value as never)}
        {...extra}
      />
    </div>
  );
  /** Campo numérico: se guarda el texto mientras se escribe y se convierte al enviar. */
  const numero = (k: keyof SorteoDatos, t: string, extra: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{t}</label>
      <input
        id={`f-${k}`}
        type="number"
        inputMode="numeric"
        value={nums[k] ?? (d[k] ? String(d[k]) : '')}
        onChange={(e) => setNums((x) => ({ ...x, [k]: e.target.value }))}
        {...extra}
      />
    </div>
  );
  const img = (
    k: 'imagen' | 'logo_loteria' | 'logo_ocupado' | 'fondo_imagen' | 'imagen_agotado',
    t: string,
    uso: string,
  ) => <SelectorImagen etiqueta={t} valor={d[k] || null} uso={uso} alCambiar={(u) => set(k, u ?? '')} />;

  async function guardar() {
    const n = (k: keyof SorteoDatos) => Number(nums[k] ?? d[k]) || 0;
    const datos: SorteoDatos = {
      ...d,
      nombre: d.nombre.trim(),
      orden: n('orden'),
      valor_boleta: d.gratis ? 0 : n('valor_boleta'),
      max_por_celular: n('max_por_celular'),
      abre: d.abre || null,
      premio_total: n('premio_total'),
      premio_ultimas: n('premio_ultimas'),
      premio_primeras: n('premio_primeras'),
      premio_medio: n('premio_medio'),
      nequi: normalizarTelefono(d.nequi),
      fecha: d.fecha || null,
    };
    if (!datos.nombre) return setError('Ponle un nombre al sorteo.');
    if (!datos.gratis && !datos.valor_boleta)
      return setError('Escribe el valor de la boleta o marca el sorteo como gratis.');
    if (datos.max_por_celular < 0 || datos.max_por_celular > 100)
      return setError('El máximo de números por persona va de 0 a 100.');
    if (!/^3\d{9}$/.test(datos.nequi))
      return setError('Escribe el número de cobro (Nequi y WhatsApp): 10 dígitos que empiecen por 3.');
    if (datos.nequi_titular.trim().length < 2) return setError('Escribe a nombre de quién está el Nequi.');
    setError('');
    setGuardando(true);
    try {
      const r = id ? await api.editarSorteo(id, { ...datos, fijos }) : await api.crearSorteo({ ...datos, fijos });
      await qc.invalidateQueries({ queryKey: ['sorteos'] });
      qc.removeQueries({ queryKey: ['sorteo', r.sorteo.id] });
      avisar(
        r.fijos.errores.length
          ? `Guardado. ${r.fijos.errores.length} línea(s) de fijos con problemas.`
          : 'Sorteo guardado',
      );
      if (r.fijos.errores.length) guardarAvisos(r.fijos.errores);
      navegar(`/sorteos/${r.sorteo.id}`);
    } catch (er) {
      setError('No se pudo guardar: ' + (er instanceof Error ? er.message : ''));
      setGuardando(false);
    }
  }

  return (
    <>
      <Link className="link-btn" to="/sorteos" style={{ alignSelf: 'flex-start' }}>
        ← Volver a sorteos
      </Link>
      <h2>{id ? 'Editar sorteo' : 'Nuevo sorteo'}</h2>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="panel stack">
          <h3>Datos del sorteo</h3>
          <div className="grid2">
            {campo('nombre', 'Nombre del sorteo', { placeholder: 'Paisita Día' })}
            {campo('loteria', 'Lotería con la que juega', { placeholder: 'Lotería de Medellín' })}
            <div className="field">
              <label htmlFor="f-jornada">Jornada</label>
              <select
                id="f-jornada"
                value={d.jornada}
                onChange={(e) => set('jornada', e.target.value as 'dia' | 'noche')}
              >
                <option value="dia">Día</option>
                <option value="noche">Noche</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-fecha">Día que juega</label>
              <input id="f-fecha" type="date" value={d.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} />
            </div>
            {campo('hora', 'Hora', { placeholder: '1:00 p. m.' })}
            {numero('orden', 'Orden en la página')}
            <div className="field">
              <label htmlFor="f-color">Color del sorteo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  id="f-color"
                  value={esColorHex(d.color) ? 'propio' : d.color}
                  onChange={(e) => set('color', e.target.value === 'propio' ? temaDe(d).c1 : e.target.value)}
                >
                  <option value="">Automático según el nombre</option>
                  {Object.entries(TEMAS).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.nombre}
                    </option>
                  ))}
                  <option value="propio">Color propio…</option>
                </select>
                <input
                  type="color"
                  aria-label="Elegir color propio"
                  value={temaDe(d).c1.toLowerCase()}
                  onChange={(e) => set('color', e.target.value.toUpperCase())}
                  style={{ width: 56, minHeight: 46, padding: 4, flex: '0 0 auto' }}
                />
              </div>
              <p className="hint">
                Pinta la tarjeta del menú y la página del sorteo: botones, bordes, etiquetas y premios.
              </p>
            </div>
            {campo('etiqueta', 'Grupo especial (opcional)', { placeholder: 'Miércoles, Sábados…' })}
          </div>
          <label className="check">
            <input type="checkbox" checked={d.activo} onChange={(e) => set('activo', e.target.checked)} /> Visible para
            los clientes
          </label>
          {d.activo && (
            <div className="stack" style={{ gap: 8 }}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!d.abre}
                  onChange={(e) => set('abre', e.target.checked ? aperturaSugerida(d) : null)}
                />{' '}
                Programar la hora en que se abre a los clientes
              </label>
              {d.abre && (
                <div className="field" style={{ maxWidth: 320 }}>
                  <label htmlFor="f-abre">Se abre el</label>
                  <input
                    id="f-abre"
                    type="datetime-local"
                    value={d.abre}
                    onChange={(e) => set('abre', e.target.value || null)}
                  />
                  <p className="hint">
                    Hora de Colombia. Antes de esa hora el sorteo no aparece en la página ni deja apartar; a esa hora se
                    abre solo. Así lo alistas con tiempo y avisas por el grupo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="panel stack">
          <h3>Valor y premios</h3>
          <label className="check">
            <input type="checkbox" checked={d.gratis} onChange={(e) => set('gratis', e.target.checked)} /> Sorteo gratis
            (la boleta vale $0)
          </label>
          {d.gratis && (
            <p className="hint" style={{ marginTop: 0 }}>
              Para motivar a la comunidad. Al apartar no se pide pago: la persona ve “¡Reserva exitosa!” y un mensaje de
              agradecimiento. Pon un máximo de números por persona abajo.
            </p>
          )}
          <div className="grid2">
            {d.gratis ? (
              <div className="field">
                <label htmlFor="f-valor_boleta">Valor de la boleta</label>
                <input id="f-valor_boleta" type="text" value="$0 · gratis" disabled />
              </div>
            ) : (
              numero('valor_boleta', 'Valor de la boleta', { placeholder: '5000' })
            )}
            <div className="field">
              <label htmlFor="f-max_por_celular">Máximo de números por persona</label>
              <input
                id="f-max_por_celular"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                placeholder="Sin límite"
                value={nums.max_por_celular ?? (d.max_por_celular ? String(d.max_por_celular) : '')}
                onChange={(e) => setNums((x) => ({ ...x, max_por_celular: e.target.value }))}
              />
              <p className="hint">
                Por celular, en este sorteo, desde la página. Vacío o 0 = sin límite. Desde el panel sí puedes apartar
                más.
              </p>
            </div>
            {numero('premio_total', 'Premio total')}
            {numero('premio_ultimas', 'Premio mayor (dos últimas cifras)')}
            {numero('premio_primeras', 'Premio dos primeras cifras')}
            {numero('premio_medio', 'Premio cifras del medio')}
          </div>
          <p className="hint">Deja en 0 o vacío los premios que no apliquen y no se mostrarán.</p>
        </div>
        <div className="panel stack">
          <h3>Cobro del sorteo</h3>
          <p className="muted small">
            A este número los clientes pagan por Nequi y le envían su ticket y comprobante por WhatsApp. Obligatorio.
          </p>
          <div className="grid2">
            {campo('nequi', 'Número de cobro (Nequi y WhatsApp)', {
              type: 'tel',
              inputMode: 'numeric',
              placeholder: '300 123 4567',
            })}
            {campo('nequi_titular', 'A nombre de')}
          </div>
        </div>
        <div className="panel stack">
          <h3>Imágenes</h3>
          <div className="grid2">
            {img('imagen', 'Portada de la tarjeta (imagen cuadrada)', 'portada')}
            {img('logo_loteria', 'Logo de la lotería', 'logo')}
            {img('logo_ocupado', 'Logo para números ocupados (solo este sorteo)', 'ocupado')}
            {img('fondo_imagen', 'Fondo para la imagen del tablero (vertical)', 'fondo')}
            {img('imagen_agotado', 'Imagen de “todos los números vendidos” (si no, la general de Diseño)', 'agotado')}
          </div>
        </div>
        <div className="panel stack">
          <h3>Números fijos</h3>
          <p className="muted small">
            Una persona por línea: números, nombre y celular. Ejemplo: <b>01-02-03 Miguel 3001234567</b>. Si la persona
            ya está en tus contactos, basta con el nombre.
          </p>
          <label htmlFor="f-fijos" className="oculto">
            Números fijos
          </label>
          <textarea
            id="f-fijos"
            placeholder={'01-02-03 Miguel 3001234567\n05-07-99 Carlos 3109876543'}
            value={fijos}
            onChange={(e) => setFijos(e.target.value)}
          />
        </div>
        {error && <p className="err">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar sorteo'}
          </button>
          {id && (
            <BotonDobleToque
              className="btn btn-danger"
              confirmar="¿Eliminar con todos sus números? Toca otra vez"
              accion={async () => {
                try {
                  await api.eliminarSorteo(id);
                  await qc.invalidateQueries({ queryKey: ['sorteos'] });
                  avisar('Sorteo eliminado');
                  navegar('/sorteos');
                } catch (er) {
                  avisar(er instanceof Error ? er.message : 'No se pudo eliminar');
                }
              }}
            >
              Eliminar sorteo
            </BotonDobleToque>
          )}
        </div>
      </form>
    </>
  );
}
