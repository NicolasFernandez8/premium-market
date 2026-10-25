// ── IMPORTS ──────────────────────────────────
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// ── GUARD: PERSONAL ───────────────────────────
// Protege la app de gestión interna (todas las rutas de personal).
// Sin sesión → login. Clientes y mayoristas → vuelven a la tienda.
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.estaLogueado()) {
    return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
  }

  if (authService.esPersonal()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

// ── GUARD: TIENDA ─────────────────────────────
// Rutas de la tienda online (catálogo, carrito, checkout).
// Abiertas a invitados y clientes; el personal va a su portal.
export const tiendaGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  return authService.esPersonal() ? router.createUrlTree(['/inicio']) : true;
};

// ── GUARD: CLIENTE ────────────────────────────
// Ruta: mi cuenta (historial de compras). Pide sesión de cliente.
export const clienteGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.esCliente()) {
    return true;
  }

  return authService.esPersonal()
    ? router.createUrlTree(['/inicio'])
    : router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

// ── GUARD: SOLO SIN SESIÓN ────────────────────
// Rutas: login y registro. Si ya hay sesión, no tiene sentido volver
// a loguearse → redirige al inicio que le corresponde al rol.
export const invitadoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.estaLogueado()) {
    return true;
  }

  return router.createUrlTree([authService.rutaInicio()]);
};

// ── GUARD: SOLO ADMIN ─────────────────────────
// Rutas: estadisticas, usuarios, movimientos
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.esAdmin()) {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};

// ── GUARD: ADMIN + EMPLEADO + REPOSITOR ───────
// Rutas: recepciones (cajero NO puede entrar)
export const noEsCajeroGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const usuario = authService.obtenerUsuario();
  const rol = usuario?.rol;

  if (rol === 'admin' || rol === 'empleado' || rol === 'repositor') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};

// ── GUARD: ADMIN + CAJERO ─────────────────────
// Rutas: caja (empleado y repositor NO pueden entrar)
export const cajaGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const usuario = authService.obtenerUsuario();
  const rol = usuario?.rol;

  if (rol === 'admin' || rol === 'cajero') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};

// ── GUARD: CLIENTES Y PEDIDOS ONLINE ──────────
// Ruta: clientes (admin, empleado y cajero atienden los pedidos de la tienda)
export const clientesGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const rol = authService.obtenerUsuario()?.rol;

  if (rol === 'admin' || rol === 'empleado' || rol === 'cajero') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};
