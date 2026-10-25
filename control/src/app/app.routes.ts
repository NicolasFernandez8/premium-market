// ── IMPORTS ──────────────────────────────────
import { Routes } from '@angular/router';
import {
  authGuard, adminGuard, noEsCajeroGuard, cajaGuard, invitadoGuard, tiendaGuard, clienteGuard, clientesGuard,
} from './core/guards/auth.guard';

// Dos caras en una sola app:
// - Tienda online (raíz): catálogo, promos, carrito y pago con QR.
//   Abierta a invitados; clientes y mayoristas suman descuento.
// - Gestión interna (personal): portal, caja, stock, pedidos y clientes.
//   Se entra desde "Ingresar" arriba a la derecha.
export const routes: Routes = [

  // ── TIENDA ONLINE ────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/tienda/inicio/tienda-inicio')
        .then(m => m.TiendaInicioComponent),
    canActivate: [tiendaGuard]
  },
  {
    path: 'productos',
    loadComponent: () =>
      import('./features/tienda/productos/tienda-productos')
        .then(m => m.TiendaProductosComponent),
    canActivate: [tiendaGuard]
  },
  {
    path: 'carrito',
    loadComponent: () =>
      import('./features/tienda/carrito/carrito')
        .then(m => m.CarritoComponent),
    canActivate: [tiendaGuard]
  },
  // Seguimiento y QR de un pedido (también para quien compró sin cuenta)
  {
    path: 'pedido/:id',
    loadComponent: () =>
      import('./features/tienda/pedido/pedido')
        .then(m => m.PedidoComponent),
    canActivate: [tiendaGuard]
  },
  // Cómo pagar con QR: QR de muestra e instructivo
  {
    path: 'como-pagar',
    loadComponent: () =>
      import('./features/tienda/como-pagar/como-pagar')
        .then(m => m.ComoPagarComponent),
    canActivate: [tiendaGuard]
  },
  // Pantalla que abre el QR: simula la billetera que confirma el pago
  {
    path: 'pagar/:id',
    loadComponent: () =>
      import('./features/tienda/pagar/pagar')
        .then(m => m.PagarComponent)
  },
  {
    path: 'mi-cuenta',
    loadComponent: () =>
      import('./features/tienda/mi-cuenta/mi-cuenta')
        .then(m => m.MiCuentaComponent),
    canActivate: [clienteGuard]
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/tienda/registro/registro')
        .then(m => m.RegistroComponent),
    canActivate: [invitadoGuard]
  },

  // ── RUTA LOGIN ────────────────────────────────
  // Clientes y personal; con sesión activa redirige al inicio de su rol
  {
    path: 'login',
    loadComponent: () =>
      import('./features/admin/login/login')
        .then(m => m.LoginComponent),
    canActivate: [invitadoGuard]
  },

  // ── OPERACIÓN DIARIA — todo el personal ──────
  // Portal con promos vigentes y consulta de precios y stock
  {
    path: 'inicio',
    loadComponent: () =>
      import('./features/operacion/inicio/inicio')
        .then(m => m.InicioComponent),
    canActivate: [authGuard]
  },
  {
    path: 'catalogo',
    loadComponent: () =>
      import('./features/operacion/catalogo/catalogo')
        .then(m => m.CatalogoComponent),
    canActivate: [authGuard]
  },

  // ── PEDIDOS A PROVEEDOR — admin, empleado, repositor ──
  {
    path: 'admin/pedidos',
    loadComponent: () =>
      import('./features/admin/pedidos/pedidos')
        .then(m => m.PedidosComponent),
    canActivate: [authGuard, noEsCajeroGuard]
  },

  // ── DASHBOARD — todos los roles ───────────────
  {
    path: 'admin/dashboard',
    loadComponent: () =>
      import('./features/admin/dashboard/dashboard')
        .then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },

  // ── PRODUCTOS — todos los roles ───────────────
  {
    path: 'admin/productos',
    loadComponent: () =>
      import('./features/admin/productos/productos')
        .then(m => m.ProductosComponent),
    canActivate: [authGuard]
  },

  // ── RECEPCIONES — admin, empleado, repositor ──
  {
    path: 'admin/recepciones',
    loadComponent: () =>
      import('./features/admin/recepciones/recepciones')
        .then(m => m.RecepcionesComponent),
    canActivate: [authGuard, noEsCajeroGuard]
  },

  // ── CAJA — admin, cajero ──────────────────────
  {
    path: 'admin/caja',
    loadComponent: () =>
      import('./features/admin/caja/caja')
        .then(m => m.CajaComponent),
    canActivate: [authGuard, cajaGuard]
  },

  // ── CLIENTES Y PEDIDOS ONLINE — admin, empleado, cajero ──
  {
    path: 'admin/clientes',
    loadComponent: () =>
      import('./features/admin/clientes/clientes')
        .then(m => m.ClientesComponent),
    canActivate: [authGuard, clientesGuard]
  },

  // ── ESTADÍSTICAS — solo admin ─────────────────
  {
    path: 'admin/estadisticas',
    loadComponent: () =>
      import('./features/admin/estadisticas/estadisticas')
        .then(m => m.EstadisticasComponent),
    canActivate: [authGuard, adminGuard]
  },

  // ── USUARIOS — solo admin ─────────────────────
  {
    path: 'admin/usuarios',
    loadComponent: () =>
      import('./features/admin/usuarios/usuarios')
        .then(m => m.UsuariosComponent),
    canActivate: [authGuard, adminGuard]
  },

  // ── MOVIMIENTOS — solo admin ──────────────────
  {
    path: 'admin/movimientos',
    loadComponent: () =>
      import('./features/admin/movimientos/movimientos')
        .then(m => m.MovimientosComponent),
    canActivate: [authGuard, adminGuard]
  },

  // ── RUTA COMODÍN ─────────────────────────────
  {
    path: '**',
    redirectTo: ''
  }
];
