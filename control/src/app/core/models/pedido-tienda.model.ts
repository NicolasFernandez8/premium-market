// ── MODELO ───────────────────────────────────
// Pedidos de la tienda online (clientes que compran desde el catálogo).
// Los precios los calcula la API: el front solo los muestra.

export type TipoCliente = 'invitado' | 'cliente' | 'mayorista';
export type EstadoPedido = 'pendiente_pago' | 'pagado' | 'preparando' | 'listo' | 'entregado' | 'cancelado';

// Renglón cotizado o cobrado
export interface ItemCotizado {
  producto: string;
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  precioLista: number;
  ofertaPct: number;
  promo: string | null;     // id de la promo aplicada
  subtotalLista: number;
  ahorroOferta: number;
  ahorroPromo: number;
  ahorroCliente: number;
  total: number;
  disponible?: number;      // Solo en la cotización: stock actual
}

// Respuesta de POST /pedidos/cotizar
export interface Cotizacion {
  tipoCliente: TipoCliente;
  descuentoClientePct: number;
  items: ItemCotizado[];
  subtotalLista: number;
  ahorroOfertas: number;
  ahorroPromos: number;
  ahorroCliente: number;
  total: number;
  promosAplicadas: string[];
  promosReintegro: string[];
}

export interface PedidoTienda {
  _id: string;
  codigo: string;
  tipoCliente: TipoCliente;
  usuarioId: string | null;
  contacto: { nombre: string; email: string; telefono: string };
  entrega: { modalidad: 'retiro' | 'envio'; direccion: string };
  notas: string;
  items: ItemCotizado[];
  descuentoClientePct: number;
  subtotalLista: number;
  ahorroOfertas: number;
  ahorroPromos: number;
  ahorroCliente: number;
  total: number;
  metodoPago: 'qr';
  estado: EstadoPedido;
  expiraEn: string;
  pagadoEn: string | null;
  historial: { estado: EstadoPedido; fecha: string; usuario: string }[];
  createdAt: string;
}

// Resumen por cliente (GET /pedidos/clientes). clave = id de la cuenta o "inv:<contacto>"
export interface ResumenCliente {
  clave: string;
  usuarioId: string | null;
  nombre: string;
  email: string;
  telefono: string;
  tipoCliente: TipoCliente;
  pedidos: number;
  compras: number;
  gastado: number;
  ultimo: string;
}

// Datos que manda el checkout
export interface NuevoPedido {
  items: { producto: string; cantidad: number }[];
  contacto: { nombre: string; email: string; telefono: string };
  entrega: { modalidad: 'retiro' | 'envio'; direccion: string };
  notas: string;
}

// Regla de precio de una promo (GET /tienda/config)
export interface ReglaPromo {
  id: string;
  regla: 'reintegro' | 'porcentaje' | '2x1' | 'segunda';
  dias: number[];
  porcentaje?: number;
  maxUnidades?: number;
  productos?: string[];
  categoria?: string;
  coincide?: string;
}

export interface ConfigTienda {
  descuentos: Record<TipoCliente, number>;
  promociones: ReglaPromo[];
}

// Texto y color de cada estado para el cliente y el panel
export const ESTADOS_PEDIDO: Record<EstadoPedido, { texto: string; icono: string; clase: string }> = {
  pendiente_pago: { texto: 'Esperando el pago', icono: 'qr_code_2',      clase: 'alerta' },
  pagado:         { texto: 'Pagado',            icono: 'paid',           clase: 'ok' },
  preparando:     { texto: 'En preparación',    icono: 'inventory',      clase: 'info' },
  listo:          { texto: 'Listo para retirar o enviar', icono: 'shopping_bag', clase: 'info' },
  entregado:      { texto: 'Entregado',         icono: 'task_alt',       clase: 'ok' },
  cancelado:      { texto: 'Cancelado',         icono: 'cancel',         clase: 'error' },
};
