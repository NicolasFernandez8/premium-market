// ── IMPORTS ──────────────────────────────────
const mongoose = require('mongoose'); // ODM para MongoDB

// ── SCHEMA: RENGLÓN DEL PEDIDO ────────────────
// Guarda el precio cobrado en el momento de la compra:
// si después cambia el precio del producto, el historial no se altera.
const itemPedidoSchema = new mongoose.Schema({
  producto:      { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
  nombre:        { type: String, required: true },
  categoria:     { type: String, default: '' },
  icono:         { type: String, default: 'shopping_bag' },
  cantidad:      { type: Number, required: true, min: 1 },
  precioLista:   { type: Number, required: true, min: 0 },
  ofertaPct:     { type: Number, default: 0 },
  promo:         { type: String, default: null },      // id de la promo aplicada
  subtotalLista: { type: Number, required: true },
  ahorroOferta:  { type: Number, default: 0 },
  ahorroPromo:   { type: Number, default: 0 },
  ahorroCliente: { type: Number, default: 0 },
  total:         { type: Number, required: true },
  devuelto:      { type: Boolean, default: false }, // Stock ya devuelto al cancelar (permite reintentar)
  reclamadoEn:   { type: Date, default: null },     // Un proceso está devolviendo este renglón
}, { _id: false });

// ── SCHEMA: PEDIDO DE LA TIENDA ONLINE ────────
// Compra de un cliente desde el catálogo web, pagada con QR.
// Distinto de los pedidos a proveedor del módulo de reposición.
const pedidoSchema = new mongoose.Schema({

  codigo: {
    type: String,       // Código corto para el cliente: "PM-K3F9Q2"
    required: true,
    unique: true
  },

  // ── QUIÉN COMPRA ──────────────────────────
  tipoCliente: {
    type: String,
    enum: ['invitado', 'cliente', 'mayorista'],
    default: 'invitado'
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null       // null si compró sin cuenta
  },
  contacto: {
    nombre:   { type: String, required: true, trim: true },
    email:    { type: String, trim: true, lowercase: true, default: '' },
    telefono: { type: String, trim: true, default: '' },
  },

  // ── ENTREGA ───────────────────────────────
  entrega: {
    modalidad: { type: String, enum: ['retiro', 'envio'], default: 'retiro' },
    direccion: { type: String, trim: true, default: '' },
  },
  notas: { type: String, trim: true, default: '' },

  // ── QUÉ COMPRA ────────────────────────────
  items: {
    type: [itemPedidoSchema],
    validate: [v => v.length > 0, 'El pedido no tiene productos']
  },
  descuentoClientePct: { type: Number, default: 0 },
  subtotalLista:  { type: Number, required: true },
  ahorroOfertas:  { type: Number, default: 0 },
  ahorroPromos:   { type: Number, default: 0 },
  ahorroCliente:  { type: Number, default: 0 },
  total:          { type: Number, required: true, min: 0 },

  // ── PAGO Y ESTADO ─────────────────────────
  metodoPago: { type: String, enum: ['qr'], default: 'qr' },
  estado: {
    type: String,
    enum: ['pendiente_pago', 'pagado', 'preparando', 'listo', 'entregado', 'cancelado'],
    default: 'pendiente_pago',
    index: true
  },
  expiraEn: { type: Date, required: true }, // Vence si no se paga: libera el stock
  pagadoEn: { type: Date, default: null },
  historial: [{
    _id:    false,
    estado: String,
    fecha:  { type: Date, default: Date.now },
    usuario: String,    // Quién hizo el cambio (cliente, invitado o personal)
  }],

}, {
  timestamps: true      // createdAt = fecha del pedido
});

pedidoSchema.index({ usuarioId: 1, createdAt: -1 });
pedidoSchema.index({ 'contacto.email': 1, createdAt: -1 });

module.exports = mongoose.model('Pedido', pedidoSchema);
