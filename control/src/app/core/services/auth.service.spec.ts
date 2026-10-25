import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';

const sesion = (rol: string) =>
  localStorage.setItem('storehub_usuario', JSON.stringify({ _id: 'u1', nombre: 'Ana', usuario: 'ana', rol, activo: true }));

describe('AuthService.refrescarSesion', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  const responder = (cambios: object) =>
    http.expectOne(r => r.url.endsWith('/usuarios/u1')).flush({ _id: 'u1', nombre: 'Ana', usuario: 'ana', activo: true, ...cambios });

  it('un usuario desactivado pierde la sesión y sale de la pantalla protegida', () => {
    sesion('cajero');
    auth.refrescarSesion();
    responder({ rol: 'cajero', activo: false });
    expect(auth.obtenerUsuario()).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/');
  });

  it('el pase de cliente a mayorista actualiza la sesión sin mover de pantalla', () => {
    sesion('cliente');
    auth.refrescarSesion();
    responder({ rol: 'mayorista' });
    expect(auth.obtenerUsuario()?.rol).toBe('mayorista');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si mientras tanto entró otra cuenta, la respuesta vieja se descarta', () => {
    sesion('cajero');
    auth.refrescarSesion();
    localStorage.setItem('storehub_usuario', JSON.stringify({ _id: 'u2', nombre: 'Beto', usuario: 'beto', rol: 'admin', activo: true }));
    responder({ rol: 'cajero', activo: false });
    expect(auth.obtenerUsuario()?.usuario).toBe('beto');
    expect(navegar).not.toHaveBeenCalled();
  });
});
