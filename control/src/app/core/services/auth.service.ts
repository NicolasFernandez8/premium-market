// ── IMPORTS ──────────────────────────────────
import { Injectable, Injector, inject } from '@angular/core'; // Decorador e inyección
import { HttpClient } from '@angular/common/http';  // Para llamadas HTTP
import { Router } from '@angular/router';
import { Observable, BehaviorSubject } from 'rxjs'; // Para manejar respuestas asíncronas
import { environment } from '../../../environments/environment'; // URL base de la API
import { ROLES_CLIENTE, ROLES_PERSONAL, RegistroCliente, Usuario } from '../models/usuario.model';
export type { Usuario } from '../models/usuario.model'; // Se re-exporta para los componentes

// ── DECORADOR ────────────────────────────────
// Servicio que maneja la autenticación y sesión.
// Usa la API para verificar credenciales con bcrypt y
// LocalStorage para persistir la sesión.
@Injectable({
  providedIn: 'root' // Disponible en toda la app (Singleton)
})
export class AuthService {

  // ── CONFIGURACIÓN ─────────────────────────
  private http = inject(HttpClient);   // Inyectamos HttpClient
  private injector = inject(Injector); // El Router se pide recién al usarlo (los guards dependen de este servicio)
  private apiUrl = `${environment.apiUrl}/usuarios`; // URL base
  private claveStorage = 'storehub_usuario'; // Clave en LocalStorage
  
  // ── ESTADO REACTIVO DE SESIÓN ─────────────
  // BehaviorSubject: guarda el último valor y avisa a quien esté suscripto
  // cuando cambia. Arranca con lo que haya en LocalStorage al cargar la app.
  private usuarioActualSubject = new BehaviorSubject<Usuario | null>(
    this.leerUsuarioDeStorage()
  );

  // Observable público — los componentes se suscriben a esto, nunca al Subject directo
  usuarioActual$ = this.usuarioActualSubject.asObservable();

  // Lee el usuario del LocalStorage (uso interno, para inicializar el Subject).
  // Si el dato está corrupto o incompleto se descarta: mejor pedir login
  // que dejar la app sin arrancar.
  private leerUsuarioDeStorage(): Usuario | null {
    try {
      const datos = localStorage.getItem(this.claveStorage);
      const usuario = datos ? JSON.parse(datos) : null;
      if (usuario && typeof usuario.rol === 'string' && typeof usuario.nombre === 'string') {
        return usuario;
      }
    } catch { /* JSON inválido */ }
    localStorage.removeItem(this.claveStorage);
    return null;
  }

  // ── MÉTODOS DE SESIÓN ─────────────────────

  // Guarda el usuario en LocalStorage al hacer login
  guardarSesion(usuario: Usuario): void {
    localStorage.setItem(this.claveStorage, JSON.stringify(usuario));
    this.usuarioActualSubject.next(usuario); // Avisamos del cambio
  }

  // Al abrir la app, vuelve a leer el usuario de la API: si el personal lo pasó
  // a mayorista (o lo desactivó) la sesión se actualiza sin pedir un nuevo login.
  // Sin conexión se conserva la sesión guardada.
  refrescarSesion(): void {
    const actual = this.obtenerUsuario();
    const id = actual?._id ?? actual?.id;
    if (!id) return;
    // Si mientras tanto se cerró la sesión o entró otra cuenta, la respuesta se descarta
    const sigueSiendoLaMisma = () => {
      const ahora = this.obtenerUsuario();
      return (ahora?._id ?? ahora?.id) === id;
    };
    // La pantalla actual ya pasó los guards con la sesión vieja: si el acceso
    // cambió, se lleva al usuario al inicio que le corresponde ahora
    const salir = () => {
      this.logout();
      this.injector.get(Router).navigateByUrl('/');
    };
    this.http.get<Usuario>(`${this.apiUrl}/${id}`).subscribe({
      next: (usuario) => {
        if (!sigueSiendoLaMisma()) return;
        if (!usuario.activo) {
          salir();
        } else if (usuario.rol !== actual!.rol || usuario.nombre !== actual!.nombre) {
          this.guardarSesion({ ...actual!, ...usuario });
          // Entre cliente y mayorista no cambia ninguna pantalla; en el personal sí
          const ambosClientes = ROLES_CLIENTE.includes(actual!.rol) && ROLES_CLIENTE.includes(usuario.rol);
          if (usuario.rol !== actual!.rol && !ambosClientes) {
            this.injector.get(Router).navigateByUrl(this.rutaInicio(usuario));
          }
        }
      },
      error: (err) => { if (err.status === 404 && sigueSiendoLaMisma()) salir(); },
    });
  }

  // Recupera el usuario guardado en LocalStorage
  obtenerUsuario(): Usuario | null {
    return this.leerUsuarioDeStorage();
  }

  // Verifica si hay una sesión activa
  estaLogueado(): boolean {
    return this.obtenerUsuario() !== null;
  }

  // Verifica si el usuario tiene un rol específico
  tieneRol(rol: string): boolean {
    const usuario = this.obtenerUsuario();
    return usuario?.rol === rol;
  }

  // Verifica si el usuario es admin
  esAdmin(): boolean {
    return this.tieneRol('admin');
  }

  // Personal del supermercado: entra a la app de gestión
  esPersonal(): boolean {
    return ROLES_PERSONAL.includes(this.obtenerUsuario()?.rol ?? '');
  }

  // Cliente o mayorista de la tienda online
  esCliente(): boolean {
    return ROLES_CLIENTE.includes(this.obtenerUsuario()?.rol ?? '');
  }

  // Pantalla de inicio según quién entra: el personal va al portal interno,
  // los clientes y los invitados a la tienda
  rutaInicio(usuario: Usuario | null = this.obtenerUsuario()): string {
    return ROLES_PERSONAL.includes(usuario?.rol ?? '') ? '/inicio' : '/';
  }

  // Cierra la sesión eliminando el usuario de LocalStorage
  logout(): void {
    localStorage.removeItem(this.claveStorage);
    this.usuarioActualSubject.next(null); // Avisamos del cambio
  }

  // ── MÉTODOS HTTP ──────────────────────────

  // GET — Obtener todos los usuarios (solo admin)
  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  // POST — Crear nuevo usuario (solo admin)
  createUsuario(usuario: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, usuario);
  }

  // PUT — Actualizar usuario (solo admin)
  updateUsuario(id: string, usuario: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, usuario);
  }

  // DELETE — Eliminar usuario (solo admin)
  deleteUsuario(id: string): Observable<Usuario> {
    return this.http.delete<Usuario>(`${this.apiUrl}/${id}`);
  }

  // POST — Registro de un cliente desde la tienda (la API fija el rol)
  registrar(datos: RegistroCliente): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/registro`, datos);
  }

  // LOGIN — Manda usuario y password al backend para verificar con bcrypt
  // El backend compara y devuelve el usuario sin password, o array vacío si falla
  login(usuarioInput: string, passwordInput: string): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(
      `${this.apiUrl}/login?usuario=${encodeURIComponent(usuarioInput)}&password=${encodeURIComponent(passwordInput)}`
    );
  }
}
