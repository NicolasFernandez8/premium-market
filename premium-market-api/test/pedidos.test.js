// Flujo completo de la tienda contra una base en memoria (nunca la real):
// registro, cotización, pedido con reserva de stock, pago con QR y cancelación.
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Si MongoDB está instalado se usa ese binario y no se descarga otro
const MONGOD_LOCAL = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';
if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(MONGOD_LOCAL)) {
  process.env.MONGOMS_SYSTEM_BINARY = MONGOD_LOCAL;
}

const app      = require('../src/app');
const Producto = require('../src/models/producto.model');
const Usuario  = require('../src/models/usuario.model');
const Pedido   = require('../src/models/pedido.model');
const { vencerPendientes } = require('../src/routes/pedidos.routes');

let mongod, server, base;

async function api(metodo, ruta, body, headers = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const personal = { 'x-usuario': 'admin', 'x-rol': 'admin' };

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod?.stop();
});

test.beforeEach(async () => {
  await Promise.all([Producto.deleteMany({}), Usuario.deleteMany({}), Pedido.deleteMany({})]);
});

const crearProducto = (datos = {}) =>
  Producto.create({ nombre: 'Arroz Gallo 1kg', categoria: 'Almacén', precio: 1000, stock: 5, ...datos });

const unPedido = (productoId, cantidad = 2, extra = {}) => ({
  items: [{ producto: String(productoId), cantidad }],
  contacto: { nombre: 'Ana Invitada', email: 'ana@example.com' },
  entrega: { modalidad: 'retiro' },
  ...extra,
});

test('el registro crea siempre un cliente, aunque pidan otro rol', async () => {
  const r = await api('POST', '/usuarios/registro', {
    nombre: 'Juan Pérez', usuario: 'juanp', email: 'juan@example.com', password: 'secreto1', rol: 'admin',
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.rol, 'cliente');
  assert.equal(r.body.password, undefined);

  const repetido = await api('POST', '/usuarios/registro', {
    nombre: 'Otro Juan', usuario: 'juanp', email: 'otro@example.com', password: 'secreto1',
  });
  assert.equal(repetido.status, 409);
});

test('cotizar aplica el descuento según el rol guardado en la base, no el del header', async () => {
  const p = await crearProducto();
  const mayorista = await Usuario.create({ nombre: 'Don Mario', usuario: 'mario', password: await bcrypt.hash('x', 4), rol: 'mayorista' });

  const comoMayorista = await api('POST', '/pedidos/cotizar', { items: [{ producto: p._id, cantidad: 2 }] },
    { 'x-usuario-id': String(mayorista._id), 'x-rol': 'cliente' });
  assert.equal(comoMayorista.body.tipoCliente, 'mayorista');
  assert.equal(comoMayorista.body.total, 1700);

  const falso = await api('POST', '/pedidos/cotizar', { items: [{ producto: p._id, cantidad: 2 }] }, { 'x-rol': 'mayorista' });
  assert.equal(falso.body.tipoCliente, 'invitado');
  assert.equal(falso.body.total, 2000);
});

test('crear pedido reserva stock y no permite comprar más de lo que hay', async () => {
  const p = await crearProducto({ stock: 3 });

  const ok = await api('POST', '/pedidos', unPedido(p._id, 2));
  assert.equal(ok.status, 201);
  assert.match(ok.body.codigo, /^PM-[A-Z2-9]{6}$/);
  assert.equal(ok.body.estado, 'pendiente_pago');
  assert.equal(ok.body.total, 2000);
  assert.equal((await Producto.findById(p._id)).stock, 1);

  const sinStock = await api('POST', '/pedidos', unPedido(p._id, 2));
  assert.equal(sinStock.status, 409);
  assert.equal((await Producto.findById(p._id)).stock, 1);
});

test('si un renglón no tiene stock se devuelve lo reservado de los anteriores', async () => {
  const a = await crearProducto({ nombre: 'A', stock: 10 });
  const b = await crearProducto({ nombre: 'B', stock: 1 });
  const r = await api('POST', '/pedidos', {
    ...unPedido(a._id),
    items: [{ producto: String(a._id), cantidad: 4 }, { producto: String(b._id), cantidad: 2 }],
  });
  assert.equal(r.status, 409);
  assert.equal((await Producto.findById(a._id)).stock, 10);
  assert.equal((await Producto.findById(b._id)).stock, 1);
});

test('el invitado tiene que dejar un contacto', async () => {
  const p = await crearProducto();
  const r = await api('POST', '/pedidos', unPedido(p._id, 1, { contacto: { nombre: 'Ana' } }));
  assert.equal(r.status, 400);
});

test('pago con QR: pagar una vez, no dos', async () => {
  const p = await crearProducto();
  const { body: pedido } = await api('POST', '/pedidos', unPedido(p._id));

  const pago = await api('PATCH', `/pedidos/${pedido._id}/pagar`);
  assert.equal(pago.status, 200);
  assert.equal(pago.body.estado, 'pagado');
  assert.ok(pago.body.pagadoEn);

  const otraVez = await api('PATCH', `/pedidos/${pedido._id}/pagar`);
  assert.equal(otraVez.status, 409);
});

test('cancelar devuelve el stock; el cliente no puede cancelar un pedido pagado', async () => {
  const p = await crearProducto({ stock: 5 });
  const { body: pendiente } = await api('POST', '/pedidos', unPedido(p._id, 2));
  const cancelado = await api('PATCH', `/pedidos/${pendiente._id}/estado`, { estado: 'cancelado' });
  assert.equal(cancelado.status, 200);
  assert.equal((await Producto.findById(p._id)).stock, 5);

  const { body: otro } = await api('POST', '/pedidos', unPedido(p._id, 1));
  await api('PATCH', `/pedidos/${otro._id}/pagar`);
  const sinPermiso = await api('PATCH', `/pedidos/${otro._id}/estado`, { estado: 'cancelado' });
  assert.equal(sinPermiso.status, 403);

  const preparando = await api('PATCH', `/pedidos/${otro._id}/estado`, { estado: 'preparando' }, personal);
  assert.equal(preparando.body.estado, 'preparando');
  const salto = await api('PATCH', `/pedidos/${otro._id}/estado`, { estado: 'entregado' }, personal);
  assert.equal(salto.status, 409);
});

test('los pedidos vencidos se cancelan y liberan el stock', async () => {
  const p = await crearProducto({ stock: 5 });
  const { body: pedido } = await api('POST', '/pedidos', unPedido(p._id, 3));
  await Pedido.updateOne({ _id: pedido._id }, { expiraEn: new Date(Date.now() - 1000) });

  const vencido = await api('PATCH', `/pedidos/${pedido._id}/pagar`);
  assert.equal(vencido.status, 410);

  assert.equal(await vencerPendientes(), 1);
  assert.equal((await Pedido.findById(pedido._id)).estado, 'cancelado');
  assert.equal((await Producto.findById(p._id)).stock, 5);
});

test('una devolución de stock que quedó a medias se completa en el próximo barrido', async () => {
  const p = await crearProducto({ stock: 5 });
  const { body: pedido } = await api('POST', '/pedidos', unPedido(p._id, 2));
  // Simula una cancelación cuya devolución falló: cancelado, stock sin devolver
  await Pedido.updateOne({ _id: pedido._id }, { estado: 'cancelado' });
  assert.equal((await Producto.findById(p._id)).stock, 3);

  await vencerPendientes();
  assert.equal((await Producto.findById(p._id)).stock, 5);
  await vencerPendientes();   // No devuelve dos veces
  assert.equal((await Producto.findById(p._id)).stock, 5);
});

test('si se corta después de sumar el stock, el reintento no lo suma de nuevo', async () => {
  const p = await crearProducto({ stock: 10 });
  const { body: pedido } = await api('POST', '/pedidos', unPedido(p._id, 4));
  // Estado tras un corte: stock ya sumado (clave guardada), renglón sin marcar y reclamo vencido
  await Pedido.updateOne({ _id: pedido._id }, { estado: 'cancelado', 'items.0.reclamadoEn': new Date(0) });
  await Producto.updateOne({ _id: p._id }, { $inc: { stock: 4 }, $push: { devolucionesAplicadas: `${pedido._id}:0` } });

  await vencerPendientes();
  assert.equal((await Producto.findById(p._id)).stock, 10);
  assert.equal((await Pedido.findById(pedido._id)).items[0].devuelto, true);
});

test('cancelación y barrido simultáneos devuelven el stock una sola vez', async () => {
  const p = await crearProducto({ stock: 10 });
  const { body: pedido } = await api('POST', '/pedidos', unPedido(p._id, 4));
  await Pedido.updateOne({ _id: pedido._id }, { expiraEn: new Date(Date.now() - 1000) });

  await Promise.all([
    api('PATCH', `/pedidos/${pedido._id}/estado`, { estado: 'cancelado' }),
    vencerPendientes(),
    vencerPendientes(),
  ]);
  assert.equal((await Producto.findById(p._id)).stock, 10);
});

test('historial: el cliente ve los suyos y solo el personal ve todos', async () => {
  const p = await crearProducto();
  const cliente = await Usuario.create({ nombre: 'Clara', usuario: 'clara', password: 'x', rol: 'cliente' });
  const sesion = { 'x-usuario-id': String(cliente._id), 'x-usuario': 'clara', 'x-rol': 'cliente' };

  await api('POST', '/pedidos', unPedido(p._id, 1, { contacto: { nombre: 'Clara' } }), sesion);
  await api('POST', '/pedidos', unPedido(p._id, 1));

  const mios = await api('GET', '/pedidos/mios', null, sesion);
  assert.equal(mios.body.length, 1);
  assert.equal(mios.body[0].tipoCliente, 'cliente');

  assert.equal((await api('GET', '/pedidos', null, sesion)).status, 403);
  assert.equal((await api('GET', '/pedidos', null, personal)).body.length, 2);
});

test('panel: los abiertos nunca se recortan y el resumen por cliente cuenta todo', async () => {
  const p = await crearProducto({ stock: 50 });
  const { body: abierto } = await api('POST', '/pedidos', unPedido(p._id, 1));
  await api('PATCH', `/pedidos/${abierto._id}/pagar`);
  for (let i = 0; i < 3; i++) {
    const { body } = await api('POST', '/pedidos', unPedido(p._id, 1));
    await api('PATCH', `/pedidos/${body._id}/estado`, { estado: 'cancelado' });
  }

  // limit=1: solo un cerrado, pero el pagado (abierto) siempre viene
  const lista = await api('GET', '/pedidos?limit=1', null, personal);
  assert.equal(lista.body.length, 2);
  assert.ok(lista.body.some(x => x._id === abierto._id));

  const resumen = await api('GET', '/pedidos/clientes', null, personal);
  assert.equal(resumen.body.length, 1);
  assert.equal(resumen.body[0].clave, 'inv:ana@example.com');
  assert.equal(resumen.body[0].pedidos, 4);
  assert.equal(resumen.body[0].compras, 1);
  assert.equal(resumen.body[0].gastado, abierto.total);

  const historial = await api('GET', '/pedidos?cliente=' + encodeURIComponent('inv:ana@example.com'), null, personal);
  assert.equal(historial.body.length, 4);
});
