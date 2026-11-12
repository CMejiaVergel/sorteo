/** Error con la forma única de la API: { error: { codigo, mensaje, detalle } }. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    public mensaje: string,
    public detalle?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

export const noDisponible = () => new ErrorApi(404, 'sorteo_no_disponible', 'Este sorteo ya no está disponible.');
export const noEncontrado = (que = 'Eso') => new ErrorApi(404, 'no_encontrado', `${que} no existe.`);
export const invalido = (mensaje = 'Revisa los datos e intenta de nuevo.', detalle?: Record<string, unknown>) =>
  new ErrorApi(422, 'datos_invalidos', mensaje, detalle);
