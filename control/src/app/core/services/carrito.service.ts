import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { Producto } from '../models/producto.model';

const CLAVE_CARRITO = 'pm_carrito';
const MAX_POR_ITEM  = 99; // Mismo tope que la API

// Un renglón del carrito: foto del producto al agregarlo + cantidad.
// El precio final siempre lo recalcula la API al cotizar.
export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// ── SERVICIO ──────────────────────────────────
// Carrito de compras de la tienda online (clientes e invitados).
// Distinto del PedidoService, que arma la reposición a proveedores.
// Se guarda en LocalStorage para no perderlo al recargar.
@Injectable({
  providedIn: 'root'
})
export class CarritoService {

  private items$ = new BehaviorSubject<ItemCarrito[]>(this.leer());

  // Observable público del carrito
  carrito$ = this.items$.asObservable();

  // Total de unidades (badge del header)
  cantidadTotal$ = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.cantidad, 0))
  );

  idDe(producto: Producto): string {
    return producto._id ?? producto.id ?? producto.nombre;
  }

  get items(): ItemCarrito[] {
    return this.items$.value;
  }

  cantidadDe(producto: Producto): number {
    const id = this.idDe(producto);
    return this.items.find(i => this.idDe(i.producto) === id)?.cantidad ?? 0;
  }

  // Tope por producto: el stock conocido y nunca más de MAX_POR_ITEM
  private tope(producto: Producto): number {
    return Math.max(0, Math.min(producto.stock, MAX_POR_ITEM));
  }

  // Devuelve la cantidad que quedó en el carrito (puede ser menor a la pedida si no hay stock)
  agregar(producto: Producto, cantidad = 1): number {
    const id = this.idDe(producto);
    const actual = this.cantidadDe(producto);
    const nueva = Math.min(actual + cantidad, this.tope(producto));
    if (nueva <= 0) return 0;

    const items = this.items;
    const idx = items.findIndex(i => this.idDe(i.producto) === id);
    if (idx >= 0) {
      const nuevos = [...items];
      nuevos[idx] = { producto, cantidad: nueva };
      this.guardar(nuevos);
    } else {
      this.guardar([...items, { producto, cantidad: nueva }]);
    }
    return nueva;
  }

  cambiarCantidad(productoId: string, cantidad: number): void {
    const items = this.items;
    const idx = items.findIndex(i => this.idDe(i.producto) === productoId);
    if (idx < 0) return;

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.quitar(productoId);
      return;
    }

    const nuevos = [...items];
    nuevos[idx] = { ...items[idx], cantidad: Math.min(Math.floor(cantidad), this.tope(items[idx].producto)) };
    this.guardar(nuevos);
  }

  // Actualiza el stock conocido de un renglón (lo informa la cotización)
  // y recorta la cantidad si ya no alcanza
  actualizarStock(productoId: string, stock: number): void {
    const items = this.items;
    const idx = items.findIndex(i => this.idDe(i.producto) === productoId);
    if (idx < 0 || items[idx].producto.stock === stock) return;

    const nuevos = [...items];
    const producto = { ...items[idx].producto, stock };
    nuevos[idx] = { producto, cantidad: Math.min(items[idx].cantidad, this.tope(producto)) };
    this.guardar(nuevos.filter(i => i.cantidad > 0));
  }

  quitar(productoId: string): void {
    this.guardar(this.items.filter(i => this.idDe(i.producto) !== productoId));
  }

  vaciar(): void {
    this.guardar([]);
  }

  // Vuelve a emitir el carrito para que se recotice (ej: la API avisó falta de stock)
  refrescar(): void {
    this.items$.next([...this.items]);
  }

  // Lo que se manda a la API: solo id y cantidad, nunca precios
  paraApi(): { producto: string; cantidad: number }[] {
    return this.items.map(i => ({ producto: this.idDe(i.producto), cantidad: i.cantidad }));
  }

  private guardar(items: ItemCarrito[]): void {
    this.items$.next(items);
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
    } catch { /* storage lleno o privado: el carrito sigue en memoria */ }
  }

  private leer(): ItemCarrito[] {
    try {
      const raw = localStorage.getItem(CLAVE_CARRITO);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items)
        ? items.filter(i => i?.producto?.nombre && Number.isInteger(i.cantidad) && i.cantidad > 0)
        : [];
    } catch {
      return [];
    }
  }
}
