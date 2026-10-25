// ── IMPORTS ──────────────────────────────────
import { Injectable, inject } from '@angular/core'; // Decorador e inyección
import { HttpClient } from '@angular/common/http';  // Para llamadas HTTP
import { Observable } from 'rxjs';                  // Para manejar respuestas asíncronas
import { environment } from '../../../environments/environment'; // URL base de la API
import { Producto } from '../models/producto.model';
export type { Producto } from '../models/producto.model'; // Se re-exporta para los componentes

// ── DECORADOR ────────────────────────────────
// Servicio que centraliza todas las llamadas HTTP
// relacionadas con productos hacia la API REST.
@Injectable({
  providedIn: 'root' // Disponible en toda la app (Singleton)
})
export class ProductosService {

  // ── CONFIGURACIÓN ─────────────────────────
  private http = inject(HttpClient); // Inyectamos HttpClient
  private apiUrl = `${environment.apiUrl}/productos`; // URL base

  // ── MÉTODOS CRUD ──────────────────────────

  // GET — Obtener todos los productos
  getAll(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  // GET — Obtener un producto por id
  getById(id: string): Observable<Producto> {
    return this.http.get<Producto>(`${this.apiUrl}/${id}`);
  }

  // POST — Crear un nuevo producto
  create(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(this.apiUrl, producto);
  }

  // PUT — Actualizar un producto existente
  update(id: string, producto: Partial<Producto>): Observable<Producto> { // Admite cambios parciales (ej: solo stock)
    return this.http.put<Producto>(`${this.apiUrl}/${id}`, producto);
  }

  // PATCH — Suma (delta > 0) o resta (delta < 0) stock de forma atómica en la API.
  // Responde 409 si no alcanza el stock: no pisa reservas de pedidos online.
  ajustarStock(id: string, delta: number): Observable<Producto> {
    return this.http.patch<Producto>(`${this.apiUrl}/${id}/stock`, { delta });
  }

  // DELETE — Eliminar un producto
  delete(id: string): Observable<Producto> {
    return this.http.delete<Producto>(`${this.apiUrl}/${id}`);
  }
}
