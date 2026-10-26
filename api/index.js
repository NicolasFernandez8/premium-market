// ── API EN VERCEL (FUNCIÓN SERVERLESS) ────────────────────────────────
// Publica la misma app Express de premium-market-api bajo /api, en el mismo
// dominio que la web. La conexión a MongoDB se reutiliza entre invocaciones.
// MONGODB_URI se configura en las variables de entorno del proyecto en Vercel.

const path = require('path');
// El mismo mongoose que usan los modelos de la API (si hubiera dos copias
// instaladas, la conexión quedaría en una y los modelos esperarían en la otra)
const mongoose = require(require.resolve('mongoose', { paths: [path.join(__dirname, '../premium-market-api/src')] }));
const app = require('../premium-market-api/src/app');
const { vencerPendientes } = require('../premium-market-api/src/routes/pedidos.routes');
const { cargarDatosIniciales } = require('../premium-market-api/src/data/carga-inicial');

let conexion = null;
let ultimoVencimiento = 0;

// Conecta una sola vez por instancia; la primera vez completa la base si está vacía
function conectar() {
  if (!conexion) {
    conexion = mongoose.connect(process.env.MONGODB_URI)
      .then(() => cargarDatosIniciales())
      .catch(err => {
        conexion = null; // El próximo pedido reintenta
        throw err;
      });
  }
  return conexion;
}

module.exports = async (req, res) => {
  try {
    await conectar();
  } catch (err) {
    console.error('[API] Sin conexión a MongoDB:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Servicio no disponible. Probá de nuevo en unos segundos.' }));
  }

  // En Vercel no hay un proceso siempre encendido: los pedidos vencidos
  // se cancelan como mucho una vez por minuto, al llegar una petición
  if (Date.now() - ultimoVencimiento > 60 * 1000) {
    ultimoVencimiento = Date.now();
    await vencerPendientes().catch(err => console.error('[Pedidos] Error al vencer pendientes:', err.message));
  }

  return app(req, res);
};
