// ── IMPORTS ──────────────────────────────────
import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProductoImagenComponent } from '../producto-imagen/producto-imagen';
import { Producto } from '../../../core/models/producto.model';
import { CarritoService } from '../../../core/services/carrito.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { AuthService } from '../../../core/services/auth.service';

// Texto corto de la promo para el sello de la tarjeta
const SELLO_PROMO: Record<string, (p?: number) => string> = {
  '2x1':        () => '2x1 hoy',
  'segunda':    (p) => `2da al ${p}% hoy`,
  'porcentaje': (p) => `${p}% hoy`,
};

// ── COMPONENTE: TARJETA DE PRODUCTO DE LA TIENDA ──
// Foto, precio con oferta, promo del día, precio con el descuento
// del cliente logueado y botón para sumar al carrito.
@Component({
  selector: 'app-tarjeta-producto',
  standalone: true,
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, ProductoImagenComponent],
  templateUrl: './tarjeta-producto.html',
  styleUrl: './tarjeta-producto.css',
  host: { class: 'tarjeta-producto' },
})
export class TarjetaProductoComponent {

  private carrito  = inject(CarritoService);
  private tienda   = inject(TiendaService);
  private auth     = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router   = inject(Router);

  producto = input.required<Producto>();

  private config  = toSignal(this.tienda.config$, { initialValue: null });
  private usuario = toSignal(this.auth.usuarioActual$, { initialValue: null });
  private carritoActual = toSignal(this.carrito.carrito$, { initialValue: [] });

  promo = computed(() => {
    const config = this.config();
    return config ? this.tienda.promoDeHoy(config, this.producto()) : null;
  });

  // Precio unitario como lo cobra la API: un % del día reemplaza a la oferta si es mejor
  private precioPromo = computed(() => {
    const promo = this.promo();
    return promo?.regla === 'porcentaje' && promo.porcentaje
      ? this.producto().precio * (1 - promo.porcentaje / 100)
      : Infinity;
  });

  private promoGana = computed(() => this.precioPromo() < this.tienda.precioOferta(this.producto()));

  conOferta   = computed(() => this.producto().oferta && this.producto().descuento > 0 && !this.promoGana());
  conRebaja   = computed(() => this.conOferta() || this.promoGana());
  precioFinal = computed(() => Math.min(this.tienda.precioOferta(this.producto()), this.precioPromo()));

  sello = computed(() => {
    const promo = this.promo();
    return promo ? SELLO_PROMO[promo.regla]?.(promo.porcentaje) ?? null : null;
  });

  // Descuento del cliente logueado (0 para invitados y personal)
  pctCliente = computed(() => {
    const config = this.config();
    return config ? this.tienda.descuentoPara(config, this.usuario()?.rol) : 0;
  });

  precioCliente = computed(() => Math.round(this.precioFinal() * (1 - this.pctCliente() / 100)));

  enCarrito = computed(() => {
    this.carritoActual();
    return this.carrito.cantidadDe(this.producto());
  });

  sinStock     = computed(() => this.producto().stock <= 0);
  topeAlcanzado = computed(() => this.enCarrito() >= Math.min(this.producto().stock, 99));

  agregar(): void {
    const antes = this.enCarrito();
    const ahora = this.carrito.agregar(this.producto());
    if (ahora === antes) {
      this.snackBar.open('No hay más stock de este producto', 'Cerrar', { duration: 2500, panelClass: 'snackbar--warning' });
      return;
    }
    if (antes === 0) {
      this.snackBar
        .open(`${this.producto().nombre} al carrito`, 'Ver carrito', { duration: 2500, panelClass: 'snackbar--info' })
        .onAction()
        .subscribe(() => this.router.navigate(['/carrito']));
    }
  }

  restar(): void {
    this.carrito.cambiarCantidad(this.carrito.idDe(this.producto()), this.enCarrito() - 1);
  }
}
