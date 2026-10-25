const express  = require('express');
const cors     = require('cors');

// ── RUTAS ─────────────────────────────────────────────────────────────
const productosRoutes    = require('./routes/productos.routes');
const usuariosRoutes     = require('./routes/usuarios.routes');
const recepcionesRoutes  = require('./routes/recepciones.routes');
const movimientosRoutes  = require('./routes/movimientos.routes');
const pedidosRoutes      = require('./routes/pedidos.routes');
const { PROMOCIONES }    = require('./data/promociones');
const { DESCUENTO_POR_TIPO } = require('./config/clientes');

// ── MIDDLEWARE DE AUDITORÍA ───────────────────────────────────────────
const { auditoriaMiddleware } = require('./middleware/auditoria.middleware');

// ── APP ───────────────────────────────────────────────────────────────
// Se arma aparte de index.js para poder levantarla en los tests
// con una base en memoria, sin abrir la conexión real.
const app = express();

// ── MIDDLEWARES GLOBALES ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── AUDITORÍA AUTOMÁTICA ──────────────────────────────────────────────
app.use('/api', auditoriaMiddleware);

// ── PROXY DÓLAR ───────────────────────────────────────────────────────
// Angular no puede llamar a dolarapi.com directamente (CORS).
// El backend hace el fetch server-to-server y lo devuelve al frontend.
app.get('/api/dolar', async (req, res) => {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares');
    const data     = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener cotización del dólar' });
  }
});

// ── CONFIGURACIÓN DE LA TIENDA ────────────────────────────────────────
// Reglas de precio que la tienda online muestra al cliente:
// descuento por tipo de cliente y promos que se aplican solas.
app.get('/api/tienda/config', (req, res) => {
  res.json({
    descuentos: DESCUENTO_POR_TIPO,
    promociones: PROMOCIONES,
  });
});

// ── RUTAS ─────────────────────────────────────────────────────────────
app.use('/api/productos',   productosRoutes);
app.use('/api/usuarios',    usuariosRoutes);
app.use('/api/recepciones', recepcionesRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/pedidos',     pedidosRoutes);

module.exports = app;
