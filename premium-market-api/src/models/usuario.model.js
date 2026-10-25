// ── IMPORTS ──────────────────────────────────
const mongoose = require('mongoose'); // ODM para MongoDB

// ── SCHEMA ────────────────────────────────────
// Define la estructura de un documento Usuario en MongoDB.
const usuarioSchema = new mongoose.Schema({

  // ── CAMPOS ────────────────────────────────
  nombre: {
    type: String,
    required: true,
    trim: true          // Elimina espacios al inicio y fin
  },
  usuario: {
    type: String,
    required: true,
    unique: true,       // No puede haber dos usuarios iguales
    trim: true,
    lowercase: true     // Guarda siempre en minúsculas
  },
  password: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    required: true,
    enum: ['admin', 'empleado', 'cajero', 'repositor', 'cliente', 'mayorista'], // Personal + clientes de la tienda
    default: 'empleado'
  },
  email: {
    type: String,       // Clientes: para avisarles del pedido
    trim: true,
    lowercase: true,
    default: ''
  },
  telefono: {
    type: String,
    trim: true,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true       // Por defecto el usuario está activo
  }

}, {
  // ── OPCIONES ──────────────────────────────
  timestamps: true      // Agrega createdAt y updatedAt automáticamente
});

// ── EXPORTAMOS EL MODELO ──────────────────────
module.exports = mongoose.model('Usuario', usuarioSchema);