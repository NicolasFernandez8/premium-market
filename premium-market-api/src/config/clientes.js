// ── TIPOS DE CLIENTE DE LA TIENDA ONLINE ─────────────────────────────
// Roles que compran desde el catálogo web y el descuento (%) que
// reciben sobre el total de cada renglón. El invitado no tiene descuento.
const DESCUENTO_POR_TIPO = {
  invitado:  0,
  cliente:   5,
  mayorista: 15,
};

// Roles del personal del supermercado (app de gestión interna)
const ROLES_PERSONAL = ['admin', 'empleado', 'cajero', 'repositor'];

// Roles de quienes compran en la tienda
const ROLES_CLIENTE = ['cliente', 'mayorista'];

module.exports = { DESCUENTO_POR_TIPO, ROLES_PERSONAL, ROLES_CLIENTE };
