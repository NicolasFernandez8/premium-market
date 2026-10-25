import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Producto } from '../models/producto.model';
import {
  ConfigTienda, Cotizacion, EstadoPedido, NuevoPedido, PedidoTienda, ReglaPromo, ResumenCliente, TipoCliente,
} from '../models/pedido-tienda.model';

const CONFIG_VACIA: ConfigTienda = { descuentos: { invitado: 0, cliente: 0, mayorista: 0 }, promociones: [] };

// ── SERVICIO ──────────────────────────────────
// Tienda online: reglas de precio, cotización del carrito,
// pedidos con pago QR e historial de clientes.
@Injectable({
  providedIn: 'root'
})
export class TiendaService {

  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pedidos`;

  // Descuentos por tipo de cliente y reglas de promos (se pide una vez)
  readonly config$: Observable<ConfigTienda> = this.http
    .get<ConfigTienda>(`${environment.apiUrl}/tienda/config`)
    .pipe(catchError(() => of(CONFIG_VACIA)), shareReplay(1));

  // ── COTIZACIÓN Y PEDIDOS ──────────────────
  cotizar(items: { producto: string; cantidad: number }[]): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.apiUrl}/cotizar`, { items });
  }

  crearPedido(pedido: NuevoPedido): Observable<PedidoTienda> {
    return this.http.post<PedidoTienda>(this.apiUrl, pedido);
  }

  getPedido(id: string): Observable<PedidoTienda> {
    return this.http.get<PedidoTienda>(`${this.apiUrl}/${id}`);
  }

  pagar(id: string): Observable<PedidoTienda> {
    return this.http.patch<PedidoTienda>(`${this.apiUrl}/${id}/pagar`, {});
  }

  cambiarEstado(id: string, estado: EstadoPedido): Observable<PedidoTienda> {
    return this.http.patch<PedidoTienda>(`${this.apiUrl}/${id}/estado`, { estado });
  }

  misPedidos(): Observable<PedidoTienda[]> {
    return this.http.get<PedidoTienda[]>(`${this.apiUrl}/mios`);
  }

  // Panel de Clientes (personal): todos los abiertos + los últimos cerrados
  todos(): Observable<PedidoTienda[]> {
    return this.http.get<PedidoTienda[]>(this.apiUrl);
  }

  // Compras y gasto por cliente, calculado por la API sobre todos los pedidos
  resumenClientes(): Observable<ResumenCliente[]> {
    return this.http.get<ResumenCliente[]>(`${this.apiUrl}/clientes`);
  }

  // Historial completo de un cliente (clave de ResumenCliente)
  historialDe(clave: string): Observable<PedidoTienda[]> {
    return this.http.get<PedidoTienda[]>(this.apiUrl, { params: { cliente: clave } });
  }

  // ── REGLAS DE PROMOS ──────────────────────
  // Misma lógica de alcance que la API (premium-market-api/src/data/promociones.js)

  aplicaA(regla: ReglaPromo, producto: Pick<Producto, 'nombre' | 'categoria'>): boolean {
    return !!(regla.productos?.includes(producto.nombre)
      || (regla.categoria && producto.categoria === regla.categoria)
      || (regla.coincide && producto.nombre.includes(regla.coincide)));
  }

  // Promo que se cobra sola hoy para este producto (las de reintegro no cuentan)
  promoDeHoy(config: ConfigTienda, producto: Producto, dia = new Date().getDay()): ReglaPromo | null {
    return config.promociones.find(r =>
      r.regla !== 'reintegro' && r.dias.includes(dia) && this.aplicaA(r, producto)) ?? null;
  }

  // Precio con oferta de góndola — ej: 1000 con 40% → 600
  precioOferta(producto: Producto): number {
    return producto.oferta && producto.descuento > 0
      ? producto.precio - (producto.precio * producto.descuento / 100)
      : producto.precio;
  }

  descuentoPara(config: ConfigTienda, rol: string | undefined): number {
    return config.descuentos[(rol ?? 'invitado') as TipoCliente] ?? 0;
  }
}
