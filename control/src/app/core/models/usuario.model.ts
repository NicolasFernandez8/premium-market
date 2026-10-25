// ── MODELO ───────────────────────────────────
// Usuario del sistema: personal del supermercado o cliente de la tienda.

// Personal (app de gestión interna) y clientes (tienda online)
export const ROLES_PERSONAL = ['admin', 'empleado', 'cajero', 'repositor'];
export const ROLES_CLIENTE  = ['cliente', 'mayorista'];

// ── INTERFACE ────────────────────────────────
// Define la forma de un Usuario
export interface Usuario {
  _id?: string;       // ← MongoDB usa _id
  id?: string;         // ← compatibilidad
  nombre: string;    // Nombre completo
  usuario: string;   // Nombre de usuario para login
  password: string;  // Contraseña
  rol: string;       // Personal: 'admin', 'empleado', 'cajero', 'repositor' · Tienda: 'cliente', 'mayorista'
  activo: boolean;   // Si el usuario está activo
  email?: string;    // Clientes: contacto para sus pedidos
  telefono?: string;
  createdAt?: string;
}

// Datos del formulario de registro de la tienda
export interface RegistroCliente {
  nombre: string;
  usuario: string;
  email: string;
  telefono: string;
  password: string;
}
