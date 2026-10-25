const Movimiento = require('../models/movimiento.model');

// ── MAPA: método HTTP + ruta → acción de auditoría ───────────────────
// Decide qué acción registrar según el endpoint y el método HTTP.
const MAPA_ACCIONES = {
  // Productos
  'POST /api/productos':          'CREAR_PRODUCTO',
  'PUT /api/productos':           'EDITAR_PRODUCTO',
  'PATCH /api/productos':         'EDITAR_PRODUCTO',
  'DELETE /api/productos':        'ELIMINAR_PRODUCTO',

  // Usuarios
  'POST /api/usuarios':           'CREAR_USUARIO',
  'PUT /api/usuarios':            'EDITAR_USUARIO',
  'PATCH /api/usuarios':          'EDITAR_USUARIO',
  'DELETE /api/usuarios':         'ELIMINAR_USUARIO',

  // Recepciones / Stock
  'POST /api/recepciones':        'RECEPCION_MERCADERIA',
  'PUT /api/recepciones':         'AJUSTE_STOCK',
  'PATCH /api/recepciones':       'AJUSTE_STOCK',

  // Ventas / Caja
  'POST /api/ventas':             'VENTA',
  'POST /api/caja':               'VENTA',
  'DELETE /api/ventas':           'ANULAR_VENTA',

  // Pedidos de la tienda online (pago, preparación, cancelación)
  'POST /api/pedidos':            'PEDIDO_CREADO',
  'PATCH /api/pedidos':           'PEDIDO_ACTUALIZADO',

  // Alta de clientes desde la tienda
  'POST /api/usuarios/registro':  'REGISTRO_CLIENTE',
};

// ── HELPER: extrae la ruta base sin el ID ─────────────────────────────
// /api/productos/64abc123  →  /api/productos
function rutaBase(path) {
  return path.replace(/\/[a-f0-9]{24}(\/.*)?$/i, '').replace(/\/\d+(\/.*)?$/, '');
}

// ── HELPER: genera el texto legible del detalle ───────────────────────
// "data" es la respuesta de la API: trae el nombre aunque el body no lo tenga
// (ej: la caja solo envía el stock nuevo de cada producto vendido)
function generarDetalle(metodo, rutaOriginal, body, params, data) {
  const base = rutaBase(rutaOriginal);
  const id   = params?.id || '';
  const nombre = body?.nombre || data?.nombre || body?.usuario || data?.usuario || id || '';

  // Actualización que solo cambia el stock (venta en caja)
  const soloStock = body && Object.keys(body).length === 1 && 'stock' in body;
  if ((metodo === 'PUT' || metodo === 'PATCH') && base === '/api/productos' && soloStock) {
    return `Actualizó stock por venta: ${nombre} → ${body.stock} u.`;
  }

  const mapa = {
    'POST /api/productos':    `Creó producto: ${nombre}`,
    'PUT /api/productos':     `Editó producto: ${nombre}`,
    'PATCH /api/productos':   `Editó producto: ${nombre}`,
    'DELETE /api/productos':  `Eliminó producto: ${nombre}`,
    'POST /api/usuarios':     `Creó usuario: ${nombre}`,
    'PUT /api/usuarios':      `Editó usuario: ${nombre}`,
    'PATCH /api/usuarios':    `Editó usuario: ${nombre}`,
    'DELETE /api/usuarios':   `Eliminó usuario: ${nombre}`,
    'POST /api/recepciones':  `Recibió ${body?.cantidad ?? ''} u. de ${body?.productoNombre ?? 'un producto'} (${body?.proveedor ?? 'sin proveedor'})`,
    'PUT /api/recepciones':   `Ajustó stock`,
    'PATCH /api/recepciones': `Ajustó stock`,
    'POST /api/ventas':       `Registró venta`,
    'POST /api/caja':         `Registró venta en caja`,
    'DELETE /api/ventas':     `Anuló venta ID: ${id}`,
    'POST /api/pedidos':      `Pedido online ${data?.codigo ?? ''} de ${data?.contacto?.nombre ?? 'un cliente'} por $${data?.total ?? ''}`,
    'PATCH /api/pedidos':     `Pedido ${data?.codigo ?? id}: ${String(data?.estado ?? '').replace('_', ' ')}`,
    'POST /api/usuarios/registro': `Se registró el cliente: ${data?.usuario ?? nombre}`,
  };

  return mapa[`${metodo} ${base}`] || `${metodo} ${rutaOriginal}`;
}

// ── HELPER: extrae usuario de la request ─────────────────────────────
// Busca en: header x-usuario, body.usuarioActual, query.usuario
function extraerUsuario(req) {
  // El frontend debe enviar el usuario logueado en el header
  const headerUsuario = req.headers['x-usuario'];
  const headerRol     = req.headers['x-rol'];
  const headerId      = req.headers['x-usuario-id'];

  if (headerUsuario) {
    return {
      usuario:   headerUsuario,
      rol:       headerRol || 'empleado',
      usuarioId: headerId  || null
    };
  }

  // Fallback: invitado
  return { usuario: 'invitado', rol: 'invitado', usuarioId: null };
}

// ── HELPER: extrae la IP real ─────────────────────────────────────────
function extraerIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

// ── MIDDLEWARE PRINCIPAL ──────────────────────────────────────────────
// Se aplica globalmente. Solo registra métodos que modifican datos.
// Los GET no se auditan (son consultas, no acciones).
function auditoriaMiddleware(req, res, next) {
  const metodo = req.method.toUpperCase();

  // Solo auditar mutaciones
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo)) {
    return next();
  }

  // Montado en /api: req.path llega sin el prefijo, así que usamos la ruta completa
  const rutaCompleta = req.baseUrl + req.path;
  const base   = rutaBase(rutaCompleta);
  const clave  = `${metodo} ${base}`;
  const accion = MAPA_ACCIONES[clave];

  // Si la ruta no está mapeada (ej: login), no auditar aquí
  // El login tiene su propio registro manual en la ruta
  if (!accion) {
    return next();
  }

  // Capturar el json original para poder leerlo luego del body-parser
  const bodyOriginal = req.body;

  // Hook en res.json para registrar DESPUÉS de que la operación sea exitosa
  const jsonOriginal = res.json.bind(res);
  res.json = function(data) {

    // Solo registrar si la respuesta fue exitosa (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const { usuario, rol, usuarioId } = extraerUsuario(req);

      const movimiento = new Movimiento({
        usuario,
        usuarioId,
        rol,
        accion,
        detalle:   generarDetalle(metodo, rutaCompleta, bodyOriginal, req.params, data),
        entidad:   base.replace('/api/', ''),
        entidadId: req.params?.id || data?._id || data?.id || '',
        ip:        extraerIp(req),
        metodo,
        endpoint:  req.originalUrl.split('?')[0], // Sin query: nunca guardar contraseñas u otros parámetros
        fecha:     new Date()
      });

      // Guardar de forma asíncrona — no bloquea la respuesta
      movimiento.save().catch(err =>
        console.error('[Auditoría] Error al guardar movimiento:', err.message)
      );
    }

    return jsonOriginal(data);
  };

  next();
}

// ── FUNCIÓN MANUAL: para registrar login/logout ───────────────────────
// Llamar desde la ruta de login: registrarAccion(req, 'LOGIN', 'Inició sesión')
// "quien" permite indicar el usuario cuando todavía no hay sesión (ej: el login)
async function registrarAccion(req, accion, detalle = '', datos = null, quien = null) {
  try {
    const { usuario, rol, usuarioId } = quien || extraerUsuario(req);
    await new Movimiento({
      usuario,
      usuarioId,
      rol,
      accion,
      detalle,
      entidad:  '',
      entidadId: '',
      datos,
      ip:       extraerIp(req),
      metodo:   req.method,
      endpoint: req.originalUrl.split('?')[0],
      fecha:    new Date()
    }).save();
  } catch (err) {
    console.error('[Auditoría] Error al registrar acción manual:', err.message);
  }
}

module.exports = { auditoriaMiddleware, registrarAccion };