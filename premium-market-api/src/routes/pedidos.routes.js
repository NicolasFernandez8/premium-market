// ── IMPORTS ──────────────────────────────────
const express  = require('express');
const crypto   = require('crypto');
const mongoose = require('mongoose');
const router   = express.Router();

const Pedido   = require('../models/pedido.model');
const Producto = require('../models/producto.model');
const Usuario  = require('../models/usuario.model');
const { cotizar } = require('../services/precios');
const { ROLES_PERSONAL, ROLES_CLIENTE } = require('../config/clientes');

// ── CONSTANTES ────────────────────────────────
const MAX_RENGLONES   = 60;
const MAX_POR_ITEM    = 99;
const MINUTOS_PARA_PAGAR = 30;    // Después el pedido vence y libera el stock

// Cambios de estado permitidos. El personal mueve el pedido por la
// preparación; el cliente solo puede cancelar mientras no pagó.
const TRANSICIONES = {
  pendiente_pago: ['cancelado'],
  pagado:         ['preparando', 'cancelado'],
  preparando:     ['listo', 'cancelado'],
  listo:          ['entregado'],
  entregado:      [],
  cancelado:      [],
};

// ── HELPERS ───────────────────────────────────
const esId = id => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

// La sesión viaja en headers que el front completa (igual que la auditoría).
// No es una autenticación real: es la limitación conocida de la API.
const esPersonal = req => ROLES_PERSONAL.includes(req.headers['x-rol']);

// Quién compra: un cliente o mayorista activo, o un invitado.
// El tipo sale de la base, no del header, así nadie se asigna un descuento.
async function compradorDe(req) {
  const id = req.headers['x-usuario-id'];
  if (!id || !esId(id)) return { tipo: 'invitado', usuario: null };

  const usuario = await Usuario.findById(id).select('-password').lean();
  if (usuario?.activo && ROLES_CLIENTE.includes(usuario.rol)) {
    return { tipo: usuario.rol, usuario };
  }
  return { tipo: 'invitado', usuario: null };
}

// Valida el carrito que manda el front y junta renglones repetidos.
// Devuelve [{ producto: id, cantidad }] o lanza un error con el motivo.
function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');
  if (items.length > MAX_RENGLONES) throw new Error(`Máximo ${MAX_RENGLONES} productos distintos por pedido`);

  const porId = new Map();
  for (const item of items) {
    const id = String(item?.producto ?? '');
    const cantidad = Number(item?.cantidad);
    if (!esId(id)) throw new Error('Hay un producto inválido en el carrito');
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('Las cantidades tienen que ser números enteros mayores a 0');
    porId.set(id, Math.min((porId.get(id) ?? 0) + cantidad, MAX_POR_ITEM));
  }
  return [...porId].map(([producto, cantidad]) => ({ producto, cantidad }));
}

// Trae los productos del carrito; lanza error si alguno ya no existe
async function cargarLineas(items) {
  const productos = await Producto.find({ _id: { $in: items.map(i => i.producto) } }).lean();
  const porId = new Map(productos.map(p => [String(p._id), p]));
  return items.map(i => {
    const producto = porId.get(i.producto);
    if (!producto) throw new Error('Un producto del carrito ya no está disponible');
    return { producto, cantidad: i.cantidad };
  });
}

// Devuelve stock reservado (pedido cancelado, vencido o que no se pudo guardar)
async function devolverStock(items) {
  await Promise.all(items.map(i =>
    Producto.updateOne({ _id: i.producto }, { $inc: { stock: i.cantidad } })
  ));
}

function generarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin 0/O ni 1/I para leerlo sin errores
  const bytes = crypto.randomBytes(6);
  return 'PM-' + [...bytes].map(b => letras[b % letras.length]).join('');
}

const quienCambia = req => req.headers['x-usuario'] || 'invitado';

const MINUTOS_RECLAMO = 5; // Un reclamo sin terminar se puede retomar pasado este tiempo

// Devuelve el stock de un pedido cancelado renglón por renglón.
// Cada renglón se "reclama" primero con una actualización atómica en la base
// (devuelto: false y sin reclamo vigente): si la cancelación y el barrido llegan
// a la vez, solo uno gana el reclamo y suma el stock. Después se marca devuelto.
// Si el proceso se corta a mitad de camino, el reclamo vence y el próximo
// barrido (vencerPendientes) lo retoma: el stock no se pierde ni se duplica.
async function devolverStockPedido(pedido) {
  for (let i = 0; i < pedido.items.length; i++) {
    const item = pedido.items[i];
    const vencido = new Date(Date.now() - MINUTOS_RECLAMO * 60 * 1000);
    const reclamo = await Pedido.updateOne(
      {
        _id: pedido._id,
        [`items.${i}.devuelto`]: false,
        // Ojo: con arrays, "items.0.campo: null" también matchea el campo "0" inexistente
        // de cada elemento; por eso "sin reclamo" se pregunta como "no es una fecha"
        $or: [{ [`items.${i}.reclamadoEn`]: { $not: { $type: 'date' } } }, { [`items.${i}.reclamadoEn`]: { $lt: vencido } }],
      },
      { $set: { [`items.${i}.reclamadoEn`]: new Date() } }
    );
    if (reclamo.modifiedCount === 0) continue; // Ya devuelto, o lo está devolviendo otro proceso

    // Suma idempotente: la clave del renglón se guarda en el producto en la misma
    // operación que el $inc. Si el proceso se corta antes de marcar "devuelto",
    // el reintento encuentra la clave y no vuelve a sumar.
    const clave = `${pedido._id}:${i}`;
    await Producto.updateOne(
      { _id: item.producto, devolucionesAplicadas: { $ne: clave } },
      { $inc: { stock: item.cantidad }, $push: { devolucionesAplicadas: clave } }
    );
    await Pedido.updateOne({ _id: pedido._id }, { $set: { [`items.${i}.devuelto`]: true } });
    // La clave queda guardada a propósito: un proceso que reclamó antes y se demoró
    // también la encuentra y no suma otra vez. Es una por renglón cancelado.
  }
}

// ── VENCER PEDIDOS SIN PAGAR ──────────────────
// Cancela los pendientes vencidos y devuelve su stock; además reintenta
// devoluciones que quedaron a medias en cancelaciones anteriores.
// La actualización exige estado pendiente: si dos procesos corren a la vez,
// solo uno cancela.
async function vencerPendientes(ahora = new Date()) {
  const vencidos = await Pedido.find({ estado: 'pendiente_pago', expiraEn: { $lte: ahora } }).select('_id').lean();
  let cancelados = 0;
  for (const { _id } of vencidos) {
    const pedido = await Pedido.findOneAndUpdate(
      { _id, estado: 'pendiente_pago' },
      { estado: 'cancelado', $push: { historial: { estado: 'cancelado', usuario: 'sistema (venció el plazo de pago)' } } },
      { new: true }
    );
    if (pedido) {
      await devolverStockPedido(pedido);
      cancelados++;
    }
  }

  const aMedias = await Pedido.find({ estado: 'cancelado', 'items.devuelto': false }).lean();
  for (const pedido of aMedias) await devolverStockPedido(pedido);

  return cancelados;
}

// ── POST /api/pedidos/cotizar ─────────────────
// Calcula el total del carrito con ofertas, promos del día y el
// descuento del cliente logueado. No reserva stock ni guarda nada.
router.post('/cotizar', async (req, res) => {
  try {
    const items  = normalizarItems(req.body?.items);
    const lineas = await cargarLineas(items);
    const { tipo } = await compradorDe(req);
    const cotizacion = cotizar(lineas, tipo);

    // Stock disponible para que el carrito avise si se pide de más
    cotizacion.items = cotizacion.items.map((item, i) => ({ ...item, disponible: lineas[i].producto.stock }));
    res.json(cotizacion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/pedidos ─────────────────────────
// Crea el pedido: reserva el stock de forma atómica y queda
// pendiente de pago con QR durante MINUTOS_PARA_PAGAR minutos.
router.post('/', async (req, res) => {
  let reservados = [];
  try {
    const items = normalizarItems(req.body?.items);
    const { tipo, usuario } = await compradorDe(req);

    // ── Contacto y entrega ──
    const contacto = {
      nombre:   String(req.body?.contacto?.nombre ?? usuario?.nombre ?? '').trim(),
      email:    String(req.body?.contacto?.email ?? usuario?.email ?? '').trim().toLowerCase(),
      telefono: String(req.body?.contacto?.telefono ?? '').trim(),
    };
    const modalidad = req.body?.entrega?.modalidad === 'envio' ? 'envio' : 'retiro';
    const direccion = String(req.body?.entrega?.direccion ?? '').trim();

    if (contacto.nombre.length < 2) throw new Error('Ingresá tu nombre');
    if (contacto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.email)) throw new Error('El email no es válido');
    if (!usuario && !contacto.email && !contacto.telefono) throw new Error('Dejanos un email o teléfono para avisarte del pedido');
    if (modalidad === 'envio' && direccion.length < 5) throw new Error('Ingresá la dirección de envío');

    const lineas = await cargarLineas(items);

    // ── Reserva de stock ──
    // Cada descuento exige stock suficiente en la misma operación ($gte + $inc),
    // así dos compras simultáneas no dejan el stock en negativo.
    // Limitación conocida: sin transacciones (MongoDB standalone), si el servidor se
    // cae entre la reserva y Pedido.create, esas unidades quedan descontadas sin pedido.
    for (const linea of lineas) {
      const actualizado = await Producto.findOneAndUpdate(
        { _id: linea.producto._id, stock: { $gte: linea.cantidad } },
        { $inc: { stock: -linea.cantidad } },
        { new: true }
      );
      if (!actualizado) {
        await devolverStock(reservados);
        reservados = [];
        return res.status(409).json({ error: `No hay stock suficiente de ${linea.producto.nombre}` });
      }
      reservados.push({ producto: linea.producto._id, cantidad: linea.cantidad });
    }

    const cotizacion = cotizar(lineas, tipo);
    const datos = {
      tipoCliente: tipo,
      usuarioId:   usuario?._id ?? null,
      contacto,
      entrega:     { modalidad, direccion: modalidad === 'envio' ? direccion : '' },
      notas:       String(req.body?.notas ?? '').trim().slice(0, 300),
      items:       cotizacion.items,
      descuentoClientePct: cotizacion.descuentoClientePct,
      subtotalLista: cotizacion.subtotalLista,
      ahorroOfertas: cotizacion.ahorroOfertas,
      ahorroPromos:  cotizacion.ahorroPromos,
      ahorroCliente: cotizacion.ahorroCliente,
      total:         cotizacion.total,
      expiraEn:      new Date(Date.now() + MINUTOS_PARA_PAGAR * 60 * 1000),
      historial:     [{ estado: 'pendiente_pago', usuario: usuario?.usuario ?? 'invitado' }],
    };

    // El código es aleatorio: si choca con uno existente se genera otro
    let pedido;
    for (let intento = 0; !pedido; intento++) {
      try {
        pedido = await Pedido.create({ ...datos, codigo: generarCodigo() });
      } catch (err) {
        if (err.code !== 11000 || intento >= 4) throw err;
      }
    }

    res.status(201).json(pedido);
  } catch (err) {
    if (reservados.length) await devolverStock(reservados);
    res.status(400).json({ error: err.message });
  }
});

// Clave con la que el panel agrupa a un cliente: su cuenta, o el
// contacto que dejó al comprar como invitado (email, teléfono o nombre)
const CLAVE_CLIENTE = {
  $cond: [
    { $ne: ['$usuarioId', null] },
    { $toString: '$usuarioId' },
    { $concat: ['inv:', { $cond: [{ $ne: ['$contacto.email', ''] }, '$contacto.email',
      { $cond: [{ $ne: ['$contacto.telefono', ''] }, '$contacto.telefono', '$contacto.nombre'] }] }] },
  ],
};

const ESTADOS_ABIERTOS = ['pendiente_pago', 'pagado', 'preparando', 'listo'];

// ── GET /api/pedidos ──────────────────────────
// Pedidos de la tienda para el panel de Clientes (solo personal).
// Sin filtros: todos los pedidos abiertos (nunca se recortan, son la cola de trabajo)
// más los últimos "limit" cerrados (entregados o cancelados, ≤ 500).
// Con ?cliente=<clave>: el historial completo de ese cliente.
router.get('/', async (req, res) => {
  if (!esPersonal(req)) return res.status(403).json({ error: 'Solo el personal puede ver todos los pedidos' });
  try {
    const { cliente, limit = 200 } = req.query;

    if (cliente) {
      const pedidos = await Pedido.aggregate([
        { $addFields: { clave: CLAVE_CLIENTE } },
        { $match: { clave: String(cliente) } },
        { $sort: { createdAt: -1 } },
        { $project: { clave: 0 } },
      ]);
      return res.json(pedidos);
    }

    const [abiertos, cerrados] = await Promise.all([
      Pedido.find({ estado: { $in: ESTADOS_ABIERTOS } }).sort({ createdAt: -1 }).lean(),
      Pedido.find({ estado: { $nin: ESTADOS_ABIERTOS } })
        .sort({ createdAt: -1 })
        .limit(Math.min(parseInt(limit) || 200, 500))
        .lean(),
    ]);
    res.json([...abiertos, ...cerrados].sort((a, b) => b.createdAt - a.createdAt));
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos', detalle: err.message });
  }
});

// ── GET /api/pedidos/clientes ─────────────────
// Resumen por cliente calculado sobre todos los pedidos (solo personal):
// compras concretadas, total gastado y fecha del último pedido.
router.get('/clientes', async (req, res) => {
  if (!esPersonal(req)) return res.status(403).json({ error: 'Solo el personal puede ver los clientes' });
  try {
    const concretado = { $not: [{ $in: ['$estado', ['pendiente_pago', 'cancelado']] }] };
    const resumen = await Pedido.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: CLAVE_CLIENTE,
        usuarioId:   { $first: '$usuarioId' },
        nombre:      { $first: '$contacto.nombre' },
        email:       { $first: '$contacto.email' },
        telefono:    { $first: '$contacto.telefono' },
        tipoCliente: { $first: '$tipoCliente' },
        pedidos:     { $sum: 1 },
        compras:     { $sum: { $cond: [concretado, 1, 0] } },
        gastado:     { $sum: { $cond: [concretado, '$total', 0] } },
        ultimo:      { $first: '$createdAt' },
      } },
      { $project: { _id: 0, clave: '$_id', usuarioId: 1, nombre: 1, email: 1, telefono: 1, tipoCliente: 1, pedidos: 1, compras: 1, gastado: 1, ultimo: 1 } },
    ]);
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo clientes', detalle: err.message });
  }
});

// ── GET /api/pedidos/mios ─────────────────────
// Historial del cliente logueado
router.get('/mios', async (req, res) => {
  try {
    const { usuario } = await compradorDe(req);
    if (!usuario) return res.status(401).json({ error: 'Iniciá sesión para ver tus pedidos' });
    const pedidos = await Pedido.find({ usuarioId: usuario._id }).sort({ createdAt: -1 }).lean();
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos', detalle: err.message });
  }
});

// ── GET /api/pedidos/:id ──────────────────────
// Seguimiento de un pedido (el id solo lo tiene quien lo creó)
router.get('/:id', async (req, res) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
  try {
    const pedido = await Pedido.findById(req.params.id).lean();
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedido', detalle: err.message });
  }
});

// ── PATCH /api/pedidos/:id/pagar ──────────────
// Confirma el pago con QR (simulado: lo dispara la pantalla de pago
// que abre el QR). Solo pasa si sigue pendiente y no venció.
router.patch('/:id/pagar', async (req, res) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
  try {
    const ahora = new Date();
    const pedido = await Pedido.findOneAndUpdate(
      { _id: req.params.id, estado: 'pendiente_pago', expiraEn: { $gt: ahora } },
      { estado: 'pagado', pagadoEn: ahora, $push: { historial: { estado: 'pagado', usuario: quienCambia(req) } } },
      { new: true }
    );
    if (pedido) return res.json(pedido);

    const actual = await Pedido.findById(req.params.id).lean();
    if (!actual) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (actual.estado === 'pendiente_pago') return res.status(410).json({ error: 'El plazo para pagar venció' });
    if (actual.estado === 'cancelado') return res.status(409).json({ error: 'El pedido está cancelado' });
    return res.status(409).json({ error: 'El pedido ya estaba pagado' });
  } catch (err) {
    res.status(500).json({ error: 'Error registrando el pago', detalle: err.message });
  }
});

// ── PATCH /api/pedidos/:id/estado ─────────────
// Avanza el pedido (personal) o lo cancela. Al cancelar se devuelve el stock.
router.patch('/:id/estado', async (req, res) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'Pedido no encontrado' });
  try {
    const nuevo  = String(req.body?.estado ?? '');
    const actual = await Pedido.findById(req.params.id).lean();
    if (!actual) return res.status(404).json({ error: 'Pedido no encontrado' });

    if (!TRANSICIONES[actual.estado]?.includes(nuevo)) {
      return res.status(409).json({ error: `No se puede pasar de "${actual.estado}" a "${nuevo}"` });
    }
    if (!esPersonal(req) && !(actual.estado === 'pendiente_pago' && nuevo === 'cancelado')) {
      return res.status(403).json({ error: 'Solo podés cancelar un pedido que todavía no pagaste' });
    }

    // Condición sobre el estado leído: si otro cambio llegó antes, no se pisa
    const pedido = await Pedido.findOneAndUpdate(
      { _id: actual._id, estado: actual.estado },
      { estado: nuevo, $push: { historial: { estado: nuevo, usuario: quienCambia(req) } } },
      { new: true }
    );
    if (!pedido) return res.status(409).json({ error: 'El pedido cambió mientras tanto. Actualizá la pantalla.' });

    if (nuevo === 'cancelado') {
      await devolverStockPedido(pedido);
      return res.json(await Pedido.findById(pedido._id).lean());
    }
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando el pedido', detalle: err.message });
  }
});

module.exports = router;
module.exports.vencerPendientes = vencerPendientes;
