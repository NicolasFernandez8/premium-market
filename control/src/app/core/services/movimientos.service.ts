import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; // URL base de la API
import { Movimiento, RespuestaMovimientos, FiltrosMovimientos } from '../models/movimiento.model';
export type { Movimiento, RespuestaMovimientos, FiltrosMovimientos } from '../models/movimiento.model'; // Se re-exporta para los componentes

// ── ETIQUETAS LEGIBLES PARA ACCIONES ─────────────────────────────────
export const ETIQUETAS_ACCION: Record<string, string> = {
  LOGIN:                'Inicio de sesión',
  LOGOUT:               'Cierre de sesión',
  CREAR_PRODUCTO:       'Creó producto',
  EDITAR_PRODUCTO:      'Editó producto',
  ELIMINAR_PRODUCTO:    'Eliminó producto',
  CREAR_USUARIO:        'Creó usuario',
  EDITAR_USUARIO:       'Editó usuario',
  ELIMINAR_USUARIO:     'Eliminó usuario',
  VENTA:                'Registró venta',
  ANULAR_VENTA:         'Anuló venta',
  RECEPCION_MERCADERIA: 'Recepción de mercadería',
  AJUSTE_STOCK:         'Ajuste de stock',
  PEDIDO_CREADO:        'Pedido creado',
  PEDIDO_ACTUALIZADO:   'Pedido actualizado',
  REGISTRO_CLIENTE:     'Registro de cliente',
  ERROR:                'Error',
  OTRO:                 'Otro',
};

// ── COLORES POR ACCIÓN (para chips/badges en la tabla) ────────────────
// Tonos profundos: el texto del badge usa el mismo color sobre un fondo
// translúcido y tiene que leerse bien (contraste AA)
export const COLORES_ACCION: Record<string, string> = {
  LOGIN:                '#1B5E20',
  LOGOUT:               '#616161',
  CREAR_PRODUCTO:       '#0D47A1',
  EDITAR_PRODUCTO:      '#8F4700',
  ELIMINAR_PRODUCTO:    '#B71C1C',
  CREAR_USUARIO:        '#0D47A1',
  EDITAR_USUARIO:       '#8F4700',
  ELIMINAR_USUARIO:     '#B71C1C',
  VENTA:                '#1B5E20',
  ANULAR_VENTA:         '#B71C1C',
  RECEPCION_MERCADERIA: '#7B1FA2',
  AJUSTE_STOCK:         '#8F4700',
  PEDIDO_CREADO:        '#00695C',
  PEDIDO_ACTUALIZADO:   '#00695C',
  REGISTRO_CLIENTE:     '#2E7D32',
  ERROR:                '#B71C1C',
  OTRO:                 '#616161',
};

// ── SERVICIO ──────────────────────────────────────────────────────────
@Injectable({
  providedIn: 'root'
})
export class MovimientosService {

  private http    = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/movimientos`;

  // ── GET con filtros y paginación ──────────────────────────────────
  getAll(filtros: FiltrosMovimientos = {}): Observable<RespuestaMovimientos> {
    let params = new HttpParams();

    if (filtros.usuario)    params = params.set('usuario',    filtros.usuario);
    if (filtros.rol)        params = params.set('rol',        filtros.rol);
    if (filtros.accion)     params = params.set('accion',     filtros.accion);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.page)       params = params.set('page',       filtros.page.toString());
    if (filtros.limit)      params = params.set('limit',      filtros.limit.toString());

    return this.http.get<RespuestaMovimientos>(this.baseUrl, { params });
  }

  // ── Lista de usuarios únicos (para el selector de filtro) ─────────
  getUsuarios(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/usuarios`);
  }

  // ── Resumen por acción (para dashboard) ───────────────────────────
  getResumen(): Observable<{ _id: string; total: number; ultimo: string }[]> {
    return this.http.get<any[]>(`${this.baseUrl}/resumen`);
  }
}
