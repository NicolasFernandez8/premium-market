// ── IMPORTS ──────────────────────────────────
const express  = require('express');           // Router de Express
const router   = express.Router();             // Creamos el router
const Producto = require('../models/producto.model'); // Modelo de Producto

// ── GET /api/productos ────────────────────────
// Obtiene todos los productos de la base de datos
router.get('/', async (req, res) => {
  try {
    const productos = await Producto.find(); // Busca todos los documentos
    res.json(productos);                     // Devuelve el array en JSON
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo productos', detalle: err.message });
  }
});

// ── GET /api/productos/:id ────────────────────
// Obtiene un producto por su ID
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id); // Busca por ID
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo producto', detalle: err.message });
  }
});

// ── POST /api/productos ───────────────────────
// Crea un nuevo producto
router.post('/', async (req, res) => {
  try {
    const producto = new Producto(req.body); // Crea el documento con los datos del body
    await producto.save();                   // Guarda en MongoDB
    res.status(201).json(producto);          // Devuelve el producto creado
  } catch (err) {
    res.status(400).json({ error: 'Error creando producto', detalle: err.message });
  }
});

// ── PUT /api/productos/:id ────────────────────
// Actualiza un producto existente
router.put('/:id', async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,  // ID del producto a actualizar
      req.body,       // Nuevos datos
      { new: true, runValidators: true } // Devuelve el actualizado y respeta min/max del esquema
    );
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: 'Error actualizando producto', detalle: err.message });
  }
});

// ── PATCH /api/productos/:id/stock ────────────
// Suma o resta unidades de forma atómica ($inc): la caja vende con delta negativo.
// Al restar exige stock suficiente en la misma operación, así una venta en caja
// no pisa las reservas de los pedidos online que llegan al mismo tiempo.
router.patch('/:id/stock', async (req, res) => {
  try {
    const delta = Number(req.body?.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ error: 'El ajuste tiene que ser un número entero distinto de 0' });
    }

    const filtro = { _id: req.params.id };
    if (delta < 0) filtro.stock = { $gte: -delta };

    const producto = await Producto.findOneAndUpdate(filtro, { $inc: { stock: delta } }, { new: true });
    if (producto) return res.json(producto);

    const existe = await Producto.exists({ _id: req.params.id });
    if (!existe) return res.status(404).json({ error: 'Producto no encontrado' });
    res.status(409).json({ error: 'No hay stock suficiente' });
  } catch (err) {
    res.status(400).json({ error: 'Error ajustando stock', detalle: err.message });
  }
});

// ── DELETE /api/productos/:id ─────────────────
// Elimina un producto
router.delete('/:id', async (req, res) => {
  try {
    const producto = await Producto.findByIdAndDelete(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado correctamente', nombre: producto.nombre });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando producto', detalle: err.message });
  }
});

// ── EXPORTAMOS EL ROUTER ──────────────────────
module.exports = router;