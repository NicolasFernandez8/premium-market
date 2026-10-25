// ── IMPORTS ──────────────────────────────────
const mongoose = require('mongoose'); // ODM para MongoDB

// ── SCHEMA ────────────────────────────────────
// Define la estructura de un documento Producto en MongoDB.
// Equivale a la interface Producto en TypeScript.
const productoSchema = new mongoose.Schema({

  // ── CAMPOS ────────────────────────────────
  nombre: {
    type: String,      // Tipo de dato
    required: true,    // Campo obligatorio
    trim: true         // Elimina espacios al inicio y fin
  },
  categoria: {
    type: String,
    required: true,
    trim: true
  },
  precio: {
    type: Number,
    required: true,
    min: 0             // No puede ser negativo
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0         // Por defecto sin stock
  },
  descripcion: {
    type: String,
    trim: true,
    default: ''
  },
  icono: {
    type: String,
    default: 'shopping_bag' // Ícono por defecto de Material Icons
  },
  oferta: {
    type: Boolean,
    default: false     // Por defecto sin oferta
  },
  descuento: {
    type: Number,
    min: 0,
    max: 100,
    default: 0         // Sin descuento por defecto
  },
  devolucionesAplicadas: {
    type: [String],    // Uso interno: devoluciones de stock de pedidos cancelados en curso
    default: undefined,
    select: false      // No viaja en las respuestas de la API
  }

}, {
  // ── OPCIONES ──────────────────────────────
  timestamps: true     // Agrega createdAt y updatedAt automáticamente
});

// ── EXPORTAMOS EL MODELO ──────────────────────
// "Producto" es el nombre de la colección en MongoDB (se guarda como "productos")
module.exports = mongoose.model('Producto', productoSchema);