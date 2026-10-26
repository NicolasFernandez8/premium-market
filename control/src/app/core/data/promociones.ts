// ── PROMOCIONES VIGENTES ──────────────────────
// Promos que el supermercado tiene activas esta temporada.
// Las usa el portal interno para que caja y reposición
// sepan qué se aplica cada día. Los productos de cada promo
// se muestran con su foto desde /public/productos.

export type TipoPromocion = 'bancaria' | 'cantidad' | 'categoria';

export interface Promocion {
  id: string;
  tipo: TipoPromocion;
  etiqueta: string;        // Texto chico de arriba ("Promo bancaria")
  destacado: string;       // Número grande ("25%", "2x1")
  titulo: string;          // Qué se ofrece
  detalle: string;         // Tope y condiciones para el cajero
  medioPago?: string;      // Medio de pago requerido, si aplica
  dias: number[];          // Días de vigencia (0 = domingo … 6 = sábado)
  productos: string[];     // Nombres de productos del catálogo para las fotos
  fondo: string;           // Color de fondo del banner
  tinta: 'clara' | 'oscura'; // Color del texto según el fondo
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const PROMOCIONES: Promocion[] = [
  {
    id: 'mp-miercoles',
    tipo: 'bancaria',
    etiqueta: 'Promo bancaria',
    destacado: '25%',
    titulo: 'de descuento pagando con Mercado Pago',
    detalle: 'Pagando con QR o débito de Mercado Pago. El banco reintegra hasta $10.000 por semana.',
    medioPago: 'Mercado Pago',
    dias: [3],
    productos: ['Yerba Mate Taragüí 500g', 'Aceite de Girasol Cocinero 1.5L', 'Fideos Tallarín Matarazzo 500g'],
    fondo: '#6B2D8C',
    tinta: 'clara',
  },
  {
    id: 'bna-jueves',
    tipo: 'bancaria',
    etiqueta: 'Jueves y viernes',
    destacado: '20%',
    titulo: 'con tarjetas de débito y crédito Banco Nación',
    detalle: 'Pagando con BNA+ o tarjetas del Banco Nación. El banco reintegra hasta $15.000 por mes. Compra mínima $20.000.',
    medioPago: 'Banco Nación',
    dias: [4, 5],
    productos: ['Café Molido La Virginia 500g', 'Tostadas Integrales x30', 'Mermelada Frutilla Arcor 454g'],
    fondo: '#43185C',
    tinta: 'clara',
  },
  {
    id: 'gaseosas-2x1',
    tipo: 'cantidad',
    etiqueta: 'Toda la semana',
    destacado: '2x1',
    titulo: 'en gaseosas Coca-Cola de 2,25 L',
    detalle: 'Llevando 2 unidades iguales se cobra 1. Máximo 6 unidades por ticket.',
    dias: [0, 1, 2, 3, 4, 5, 6],
    productos: ['Coca-Cola Original 2.25L', 'Sprite Lima Limón 2.25L', 'Fanta Naranja 1.5L'],
    fondo: '#C42A44',
    tinta: 'clara',
  },
  {
    id: 'lacteos-lunes',
    tipo: 'categoria',
    etiqueta: 'Lunes lácteo',
    destacado: '20%',
    titulo: 'en lácteos La Serenísima',
    detalle: 'Leches, manteca, crema y dulce de leche La Serenísima. Sin tope.',
    dias: [1],
    productos: ['Leche La Serenísima Entera 1L', 'Dulce de Leche La Serenísima 400g', 'Manteca La Serenísima 200g'],
    fondo: '#F3EAF8',
    tinta: 'oscura',
  },
  {
    id: 'carnes-sabado',
    tipo: 'categoria',
    etiqueta: 'Sábado de asado',
    destacado: '15%',
    titulo: 'en carnes vacunas y achuras',
    detalle: 'Cortes del mostrador de carnicería. El cajero aplica el 15% al cobrar.',
    dias: [6],
    productos: ['Asado de Tira x kg', 'Vacío x kg', 'Chorizo Parrillero x kg'],
    fondo: '#7A1F3D',
    tinta: 'clara',
  },
  {
    id: 'limpieza-martes',
    tipo: 'cantidad',
    etiqueta: 'Martes de limpieza',
    destacado: '2da al 70%',
    titulo: 'en limpieza y cuidado de la ropa',
    detalle: 'La segunda unidad del mismo producto lleva 70% de descuento.',
    dias: [2],
    productos: ['Jabón en Polvo Skip 3kg', 'Suavizante Downy 1L', 'Lavandina Ayudín 1L'],
    fondo: '#FBF9F7',
    tinta: 'oscura',
  },
];

// Cómo la ve el cajero: las bancarias las reintegra el banco
// (no tocan el ticket); las de cantidad y categoría se aplican a mano en caja.
export function comoSeAplica(promo: Promocion): { icono: string; texto: string; enCaja: boolean } {
  return promo.tipo === 'bancaria'
    ? { icono: 'account_balance', texto: 'Reintegro del banco: no se descuenta en caja', enCaja: false }
    : { icono: 'touch_app', texto: 'Se aplica a mano en caja', enCaja: true };
}

// Promos que aplican hoy
export function promocionesDelDia(dia: number = new Date().getDay()): Promocion[] {
  return PROMOCIONES.filter(p => p.dias.includes(dia));
}

// "Miércoles", "Jueves y viernes", "Todos los días"
export function textoDias(dias: number[]): string {
  if (dias.length === 7) return 'Todos los días';
  const nombres = dias.map(d => DIAS_SEMANA[d].toLowerCase());
  const texto = nombres.length > 1
    ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
    : nombres[0];
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
