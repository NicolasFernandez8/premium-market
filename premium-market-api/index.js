require('dotenv').config();
const mongoose = require('mongoose');

const app = require('./src/app');
const { vencerPendientes } = require('./src/routes/pedidos.routes');

const PORT = process.env.PORT || 3000;

// Sin MONGODB_URI se usa la base local: la app nunca cae en otra base por accidente.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/premium_market';

// ── CONEXIÓN A MONGODB ────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log(`✅ Conectado a MongoDB (${mongoose.connection.host}/${mongoose.connection.name})`);
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

    // Los pedidos sin pagar liberan su stock al vencer
    setInterval(() => {
      vencerPendientes().catch(err => console.error('[Pedidos] Error al vencer pendientes:', err.message));
    }, 60 * 1000);
  })
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    process.exit(1);
  });
