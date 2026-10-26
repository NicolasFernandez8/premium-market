// ── CARGA INICIAL DE LA BASE LOCAL ────────────────────────────────────
// Llena una base vacía con el catálogo (scripts/data/productos.json)
// y usuarios de prueba de cada rol (ver src/data/carga-inicial.js).
//
//   npm run seed            → carga solo lo que falta
//   npm run seed -- --reset → borra productos, usuarios, pedidos, recepciones y movimientos y vuelve a cargar
//
// Por seguridad solo corre contra una base local (127.0.0.1 / localhost).

require('dotenv').config();
const mongoose = require('mongoose');

const Producto   = require('../src/models/producto.model');
const Usuario    = require('../src/models/usuario.model');
const Pedido     = require('../src/models/pedido.model');
const Movimiento = require('../src/models/movimiento.model');
const Recepcion  = require('../src/models/recepcion.model');
const { cargarDatosIniciales } = require('../src/data/carga-inicial');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/premium_market';

async function main() {
  const host = new URL(MONGODB_URI.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error(`La carga inicial solo corre en una base local (MONGODB_URI apunta a ${host})`);
  }

  await mongoose.connect(MONGODB_URI);
  console.log(`Conectado a ${mongoose.connection.name}`);

  if (process.argv.includes('--reset')) {
    await Promise.all([
      Producto.deleteMany({}), Usuario.deleteMany({}), Pedido.deleteMany({}),
      Recepcion.deleteMany({}), Movimiento.deleteMany({}),
    ]);
    console.log('Base vaciada');
  }

  await cargarDatosIniciales(console.log);
}

main()
  .catch(err => {
    console.error('Error en la carga inicial:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
