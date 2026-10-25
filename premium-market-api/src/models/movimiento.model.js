const mongoose = require('mongoose');

// ── SCHEMA DE AUDITORÍA ───────────────────────────────────────────────
// Registra cada acción importante del sistema.
// Se crea automáticamente desde el middleware — nunca desde el frontend.
const movimientoSchema = new mongoose.Schema({

  // ── QUIÉN ─────────────────────────────────────────────────────────
  usuario: {
    type: String,
    required: true,
    default: 'sistema'          // Por si una acción ocurre sin sesión
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null               // null si es un invitado o acción de sistema
  },
  rol: {
    type: String,
    enum: ['admin', 'empleado', 'cajero', 'repositor', 'cliente', 'mayorista', 'invitado', 'sistema'],
    default: 'sistema'
  },

  // ── QUÉ ───────────────────────────────────────────────────────────
  accion: {
    type: String,
    required: true,
    enum: [
      // Sesión
      'LOGIN', 'LOGOUT',
      // Productos
      'CREAR_PRODUCTO', 'EDITAR_PRODUCTO', 'ELIMINAR_PRODUCTO',
      // Usuarios
      'CREAR_USUARIO', 'EDITAR_USUARIO', 'ELIMINAR_USUARIO',
      // Ventas / Caja
      'VENTA', 'ANULAR_VENTA',
      // Stock / Recepciones
      'RECEPCION_MERCADERIA', 'AJUSTE_STOCK',
      // Carrito / Pedidos
      'PEDIDO_CREADO', 'PEDIDO_ACTUALIZADO',
      // Tienda online
      'REGISTRO_CLIENTE',
      // Sistema
      'ERROR', 'OTRO'
    ]
  },
  detalle: {
    type: String,
    default: ''                 // Descripción legible: "Editó producto Coca-Cola 500ml"
  },
  entidad: {
    type: String,
    default: ''                 // Nombre del recurso afectado: "productos", "usuarios", etc.
  },
  entidadId: {
    type: String,
    default: ''                 // ID del documento afectado
  },
  datos: {
    type: mongoose.Schema.Types.Mixed,
    default: null               // Snapshot del objeto antes/después (opcional)
  },

  // ── CONTEXTO TÉCNICO ──────────────────────────────────────────────
  ip: {
    type: String,
    default: ''
  },
  metodo: {
    type: String,               // GET, POST, PUT, DELETE
    default: ''
  },
  endpoint: {
    type: String,               // /api/productos/123
    default: ''
  },

  // ── CUÁNDO ────────────────────────────────────────────────────────
  fecha: {
    type: Date,
    default: Date.now,
    index: true                 // Índice para queries por fecha rápidas
  }

}, {
  timestamps: false,            // Usamos "fecha" propio en vez de createdAt/updatedAt
  versionKey: false
});

// ── ÍNDICES COMPUESTOS ────────────────────────────────────────────────
// Para que los filtros del admin sean rápidos
movimientoSchema.index({ usuario: 1, fecha: -1 });
movimientoSchema.index({ accion: 1, fecha: -1 });
movimientoSchema.index({ rol: 1, fecha: -1 });

module.exports = mongoose.model('Movimiento', movimientoSchema);