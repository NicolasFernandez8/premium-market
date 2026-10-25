// ── CÁLCULO DE PRECIOS DE LA TIENDA ONLINE ───────────────────────────
// Única fuente de verdad del total de un pedido: el front muestra lo
// que devuelve /api/pedidos/cotizar y nunca manda precios propios.
//
// Orden por renglón:
//   1. Precio de lista × cantidad
//   2. Oferta de góndola (descuento % del producto)
//   3. Promo del día (2x1, 2da al X%, o % de categoría si mejora la oferta)
//   4. Descuento del tipo de cliente (cliente / mayorista) sobre lo que queda
// Los montos se redondean a pesos enteros en cada paso.

const { PROMOCIONES, aplicaA } = require('../data/promociones');
const { DESCUENTO_POR_TIPO }   = require('../config/clientes');

// Día de la semana en Argentina (0 = domingo): el servidor puede correr en UTC
function diaArgentina(fecha = new Date()) {
  const nombre = fecha.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nombre);
}

// Promos que se cobran solas hoy (las de reintegro bancario no tocan el total)
function promosDelDia(fecha) {
  const dia = diaArgentina(fecha);
  return PROMOCIONES.filter(p => p.dias.includes(dia));
}

function cotizarRenglon(producto, cantidad, promosHoy, pctCliente) {
  const precio      = producto.precio;
  const conOferta   = producto.oferta && producto.descuento > 0;
  const precioOferta = conOferta ? precio * (1 - producto.descuento / 100) : precio;
  const lista       = Math.round(precio * cantidad);

  const promo = promosHoy.find(p => p.regla !== 'reintegro' && aplicaA(p, producto)) || null;

  let ahorroOferta = Math.round((precio - precioOferta) * cantidad);
  let ahorroPromo  = 0;
  let promoAplicada = null;

  if (promo?.regla === 'porcentaje') {
    const precioPromo = precio * (1 - promo.porcentaje / 100);
    if (precioPromo < precioOferta) {
      ahorroOferta  = 0;
      ahorroPromo   = Math.round((precio - precioPromo) * cantidad);
      promoAplicada = promo.id;
    }
  } else if (promo?.regla === '2x1') {
    const alcanzadas = Math.min(cantidad, promo.maxUnidades ?? cantidad);
    const gratis     = Math.floor(alcanzadas / 2);
    if (gratis > 0) {
      ahorroPromo   = Math.round(gratis * precioOferta);
      promoAplicada = promo.id;
    }
  } else if (promo?.regla === 'segunda') {
    const pares = Math.floor(cantidad / 2);
    if (pares > 0) {
      ahorroPromo   = Math.round(pares * precioOferta * promo.porcentaje / 100);
      promoAplicada = promo.id;
    }
  }

  const subtotal        = lista - ahorroOferta - ahorroPromo;
  const ahorroCliente   = Math.round(subtotal * pctCliente / 100);

  return {
    producto:      producto._id,
    nombre:        producto.nombre,
    categoria:     producto.categoria,
    icono:         producto.icono,
    cantidad,
    precioLista:   precio,
    ofertaPct:     conOferta && ahorroOferta > 0 ? producto.descuento : 0,
    promo:         promoAplicada,
    subtotalLista: lista,
    ahorroOferta,
    ahorroPromo,
    ahorroCliente,
    total:         subtotal - ahorroCliente,
  };
}

// lineas: [{ producto: <documento Producto>, cantidad }]
function cotizar(lineas, tipoCliente = 'invitado', fecha = new Date()) {
  const pctCliente = DESCUENTO_POR_TIPO[tipoCliente] ?? 0;
  const promosHoy  = promosDelDia(fecha);
  const items      = lineas.map(l => cotizarRenglon(l.producto, l.cantidad, promosHoy, pctCliente));

  const sumar = campo => items.reduce((acc, i) => acc + i[campo], 0);

  return {
    tipoCliente,
    descuentoClientePct: pctCliente,
    items,
    subtotalLista:  sumar('subtotalLista'),
    ahorroOfertas:  sumar('ahorroOferta'),
    ahorroPromos:   sumar('ahorroPromo'),
    ahorroCliente:  sumar('ahorroCliente'),
    total:          sumar('total'),
    promosAplicadas: [...new Set(items.map(i => i.promo).filter(Boolean))],
    promosReintegro: promosHoy.filter(p => p.regla === 'reintegro').map(p => p.id),
  };
}

module.exports = { cotizar, diaArgentina };
