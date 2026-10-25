import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { authGuard, clienteGuard, invitadoGuard, tiendaGuard } from './auth.guard';

const sesion = (rol: string) =>
  localStorage.setItem('storehub_usuario', JSON.stringify({ _id: '1', nombre: 'Prueba', usuario: 'prueba', rol, activo: true }));

// Ejecuta un guard y devuelve true o la URL a la que redirige
function correr(guard: typeof authGuard, url = '/x'): true | string {
  const resultado = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  return resultado instanceof UrlTree ? TestBed.inject(Router).serializeUrl(resultado) : (resultado as true);
}

describe('guards de tienda y personal', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('la tienda está abierta a invitados y clientes, pero el personal va a su portal', () => {
    expect(correr(tiendaGuard)).toBe(true);
    sesion('cliente');
    expect(correr(tiendaGuard)).toBe(true);
    sesion('cajero');
    expect(correr(tiendaGuard)).toBe('/inicio');
  });

  it('la gestión interna pide sesión de personal: un cliente vuelve a la tienda', () => {
    expect(correr(authGuard, '/admin/caja')).toBe('/login?volver=%2Fadmin%2Fcaja');
    sesion('mayorista');
    expect(correr(authGuard)).toBe('/');
    sesion('admin');
    expect(correr(authGuard)).toBe(true);
  });

  it('mi cuenta es solo para clientes', () => {
    expect(correr(clienteGuard, '/mi-cuenta')).toBe('/login?volver=%2Fmi-cuenta');
    sesion('empleado');
    expect(correr(clienteGuard)).toBe('/inicio');
    sesion('cliente');
    expect(correr(clienteGuard)).toBe(true);
  });

  it('con sesión, login y registro llevan al inicio del rol', () => {
    sesion('cliente');
    expect(correr(invitadoGuard)).toBe('/');
    sesion('repositor');
    expect(correr(invitadoGuard)).toBe('/inicio');
  });
});
