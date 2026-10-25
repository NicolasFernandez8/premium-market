// ── IMPORTS ──────────────────────────────────
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');          // Hash de contraseñas
const Usuario  = require('../models/usuario.model');
const { registrarAccion } = require('../middleware/auditoria.middleware');

// ── GET /api/usuarios ─────────────────────────
// Obtiene todos los usuarios (sin password)
router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password');
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios', detalle: err.message });
  }
});

// ── GET /api/usuarios/login ───────────────────
// Verifica credenciales con bcrypt y devuelve el usuario sin password
router.get('/login', async (req, res) => {
  try {
    const { usuario, password } = req.query; // Recibe ?usuario=admin&password=1234
    if (!usuario || !password) {
      return res.json([]); // Sin datos completos no hay login
    }

    // Buscamos el usuario (se guarda en minúsculas; incluye password para comparar)
    const usuarioEncontrado = await Usuario.findOne({ usuario: String(usuario).trim().toLowerCase() });

    if (!usuarioEncontrado) {
      return res.json([]); // Array vacío si no existe
    }

    // Comparamos el password ingresado con el hash guardado en la BD
    const passwordValido = await bcrypt.compare(password, usuarioEncontrado.password);

    if (!passwordValido) {
      return res.json([]); // Array vacío si la contraseña no coincide
    }

    // Devolvemos en array para compatibilidad, pero SIN el password
    const { password: _, ...usuarioSinPass } = usuarioEncontrado.toObject();

    // Auditoría: el login todavía no tiene sesión, así que indicamos quién es
    if (usuarioEncontrado.activo) {
      registrarAccion(req, 'LOGIN', `Inició sesión: ${usuarioEncontrado.usuario}`, null, {
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        usuarioId: usuarioEncontrado._id,
      });
    }

    res.json([usuarioSinPass]);

  } catch (err) {
    res.status(500).json({ error: 'Error en login', detalle: err.message });
  }
});

// ── GET /api/usuarios/:id ─────────────────────
// Obtiene un usuario por ID (sin password)
router.get('/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-password');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuario', detalle: err.message });
  }
});

// ── POST /api/usuarios ────────────────────────
// Crea un nuevo usuario — hashea la contraseña antes de guardar
router.post('/', async (req, res) => {
  try {
    const datos = { ...req.body };

    // Si viene password en texto plano, lo hasheamos
    if (datos.password) {
      datos.password = await bcrypt.hash(datos.password, 10);
    }

    const usuario = new Usuario(datos);
    await usuario.save();

    // Devolvemos sin el password
    const { password, ...usuarioSinPass } = usuario.toObject();
    res.status(201).json(usuarioSinPass);
  } catch (err) {
    res.status(400).json({ error: 'Error creando usuario', detalle: err.message });
  }
});

// ── POST /api/usuarios/registro ───────────────
// Alta de clientes desde la tienda online. El rol siempre es "cliente":
// el pase a mayorista lo hace el personal desde el panel de Clientes.
router.post('/registro', async (req, res) => {
  try {
    const nombre   = String(req.body?.nombre ?? '').trim();
    const usuario  = String(req.body?.usuario ?? '').trim().toLowerCase();
    const email    = String(req.body?.email ?? '').trim().toLowerCase();
    const telefono = String(req.body?.telefono ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (nombre.length < 3)  return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return res.status(400).json({ error: 'El usuario debe tener entre 3 y 30 letras, números, punto o guion' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'El email no es válido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    if (await Usuario.exists({ usuario })) {
      return res.status(409).json({ error: 'Ese usuario ya existe' });
    }

    const nuevo = await Usuario.create({
      nombre, usuario, email, telefono,
      password: await bcrypt.hash(password, 10),
      rol: 'cliente',
      activo: true,
    });

    const { password: _, ...usuarioSinPass } = nuevo.toObject();
    res.status(201).json(usuarioSinPass);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ese usuario ya existe' });
    res.status(400).json({ error: 'Error registrando cliente', detalle: err.message });
  }
});

// ── PUT /api/usuarios/:id ─────────────────────
// Actualiza un usuario — si cambia password, lo hashea
router.put('/:id', async (req, res) => {
  try {
    const datos = { ...req.body };

    // Solo hasheamos si mandan un password nuevo
    if (datos.password) {
      datos.password = await bcrypt.hash(datos.password, 10);
    } else {
      // Si no mandan password, no lo pisamos
      delete datos.password;
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      datos,
      { new: true, runValidators: true } // Respeta el enum de roles
    ).select('-password');

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(400).json({ error: 'Error actualizando usuario', detalle: err.message });
  }
});

// ── DELETE /api/usuarios/:id ──────────────────
// Elimina un usuario
router.delete('/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Usuario eliminado correctamente', usuario: usuario.usuario });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando usuario', detalle: err.message });
  }
});

// ── EXPORTAMOS EL ROUTER ──────────────────────
module.exports = router;