// ── CARGA INICIAL DE DATOS ────────────────────────────────────────────
// Completa una base vacía con el catálogo (scripts/data/productos.json)
// y un usuario de prueba por rol. Solo agrega lo que falta: no pisa datos.
// La usan el seed local (npm run seed) y la API publicada en Vercel
// la primera vez que arranca con la base vacía.

const bcrypt = require('bcryptjs');

const Producto  = require('../models/producto.model');
const Usuario   = require('../models/usuario.model');
const productos = require('../../scripts/data/productos.json');

// Usuarios de prueba. Contraseña = usuario + "1234".
const USUARIOS = [
  { nombre: 'Administración',   usuario: 'admin',     rol: 'admin' },
  { nombre: 'Elena Empleada',   usuario: 'empleado',  rol: 'empleado' },
  { nombre: 'Carlos Cajero',    usuario: 'cajero',    rol: 'cajero' },
  { nombre: 'Rita Repositora',  usuario: 'repositor', rol: 'repositor' },
  { nombre: 'Clara Cliente',    usuario: 'cliente',   rol: 'cliente',   email: 'cliente@example.com' },
  { nombre: 'Almacén Don Mario', usuario: 'mayorista', rol: 'mayorista', email: 'mayorista@example.com' },
];

async function cargarDatosIniciales(log = () => {}) {
  if (await Producto.estimatedDocumentCount() === 0) {
    await Producto.insertMany(productos);
    log(`Productos cargados: ${productos.length}`);
  } else {
    log('Productos: ya había datos, no se tocan');
  }

  for (const u of USUARIOS) {
    if (await Usuario.exists({ usuario: u.usuario })) continue;
    await Usuario.create({ ...u, password: await bcrypt.hash(`${u.usuario}1234`, 10), activo: true });
    log(`Usuario creado: ${u.usuario} (${u.rol})`);
  }
}

module.exports = { cargarDatosIniciales };
