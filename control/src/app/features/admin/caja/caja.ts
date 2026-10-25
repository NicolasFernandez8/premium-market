// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ── SERVICIOS ─────────────────────────────────
import { ProductosService, Producto } from '../../../core/services/productos.service';
import { AuthService, Usuario } from '../../../core/services/auth.service';
import { CajaService, Venta } from '../../../core/services/caja.service';
import { Router } from '@angular/router';
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';
import { ConfirmacionDialogComponent } from '../../../shared/components/confirmacion-dialog/confirmacion-dialog';

// ── INTERFACE ────────────────────────────────
interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProductoImagenComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
    MatTableModule,
    MatBadgeModule,
  ],
  templateUrl: './caja.html',
  styleUrl: './caja.css'
})
export class CajaComponent implements OnInit {

  // ── SERVICIOS INYECTADOS ──────────────────
  private productosService = inject(ProductosService);
  private authService      = inject(AuthService);
  private cajaService      = inject(CajaService);
  private snackBar         = inject(MatSnackBar);
  private cdr              = inject(ChangeDetectorRef);
  private ngZone           = inject(NgZone);
  private router           = inject(Router);
  private dialog           = inject(MatDialog);

  Math = Math;

  // ── DATOS ─────────────────────────────────
  usuarioLogueado: Usuario | null = null;
  productos: Producto[]           = [];
  productosFiltrados: Producto[]  = [];

  // ── CARRITO ───────────────────────────────
  carrito: ItemCarrito[] = [];

  // ── BÚSQUEDA ──────────────────────────────
  textoBusqueda: string = '';

  // ── ESTADO DE PANTALLAS ───────────────────
  cobrando: boolean         = false;
  mostrarHistorial: boolean = false;
  mostrarCierre: boolean    = false;
  cajaAbierta: boolean      = false;
  mostrarApertura: boolean  = false;

  // ── PAGO ──────────────────────────────────
  procesandoCobro       = false;      // Bloquea el botón mientras se descuenta el stock
  metodoPago: string    = 'efectivo';
  montoPagado: number   = 0;
  montoCobrado: number  = 0;  // ← lo que vos decidís cobrar (editable)
  montoInicial: number  = 0;

  // ── ACUMULADO ─────────────────────────────
  acumulado: number = 0;

  // ── CIERRE ────────────────────────────────
  efectivoContado: number = 0;

  // ── LIFECYCLE HOOK ────────────────────────
  ngOnInit(): void {
    this.usuarioLogueado = this.authService.obtenerUsuario();
    this.acumulado       = this.cajaService.obtenerAcumulado();

    const estado     = this.cajaService.obtenerEstado();
    this.cajaAbierta = estado?.abierta ?? false;

    if (!this.cajaAbierta) {
      this.mostrarApertura = true;
    } else {
      this.cargarProductos();
    }
  }

  // ── MÉTODO: CARGAR PRODUCTOS ──────────────
  cargarProductos(): void {
    this.productosService.getAll().subscribe({
      next: (productos) => {
        this.ngZone.run(() => {
          this.productos          = productos.filter(p => p.stock > 0);
          this.productosFiltrados = this.productos;
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Error cargando productos:', err)
    });
  }

  // ── MÉTODO: ABRIR CAJA ────────────────────
  abrirCaja(): void {
    if (this.montoInicial < 0) {
      this.snackBar.open('⚠️ El monto inicial no puede ser negativo', 'Cerrar', { duration: 2000, panelClass: 'snackbar--warning' });
      return;
    }
    this.cajaService.abrirCaja(this.montoInicial, this.usuarioLogueado?.nombre || '');
    this.cajaAbierta     = true;
    this.mostrarApertura = false;
    this.snackBar.open(`✅ Caja abierta con $${this.montoInicial}`, 'Cerrar', { duration: 3000, panelClass: 'snackbar--success' });
    this.cargarProductos();
  }

  // ── MÉTODO: FILTRAR PRODUCTOS ─────────────
  filtrar(): void {
    this.productosFiltrados = this.productos.filter(p =>
      p.nombre.toLowerCase().includes(this.textoBusqueda.toLowerCase())
    );
  }

  // ── MÉTODO: PRECIO REAL ───────────────────
  precioReal(producto: Producto): number {
    return (producto.oferta && producto.descuento)
      ? producto.precio * (1 - producto.descuento / 100)
      : producto.precio;
  }

  // ── MÉTODO: AGREGAR AL CARRITO ────────────
  agregarAlCarrito(producto: Producto): void {
    const idB = (producto as any)._id || producto.id;
    const itemExistente = this.carrito.find(i => {
      const idA = (i.producto as any)._id || i.producto.id;
      return idA === idB;
    });
    const precio = this.precioReal(producto);
    if (itemExistente) {
      if (itemExistente.cantidad < producto.stock!) {
        itemExistente.cantidad++;
        itemExistente.subtotal = itemExistente.cantidad * precio;
        this.snackBar.open(`+1 ${producto.nombre}`, '', { duration: 800, panelClass: 'snackbar--info' });
      } else {
        this.snackBar.open(`⚠️ Stock máximo alcanzado`, 'Cerrar', { duration: 2000, panelClass: 'snackbar--warning' });
      }
    } else if (producto.stock <= 0) {
      this.snackBar.open(`${producto.nombre} no tiene stock`, 'Cerrar', { duration: 2000, panelClass: 'snackbar--warning' });
    } else {
      this.carrito.push({ producto, cantidad: 1, subtotal: precio });
      this.snackBar.open(`✅ ${producto.nombre} agregado`, '', { duration: 800, panelClass: 'snackbar--success' });
    }
  }

  // ── MÉTODO: CAMBIAR CANTIDAD ──────────────
  cambiarCantidad(item: ItemCarrito, cambio: number): void {
    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad <= 0) { this.quitarDelCarrito(item); return; }
    if (nuevaCantidad > item.producto.stock!) {
      this.snackBar.open('⚠️ Sin stock suficiente', 'Cerrar', { duration: 2000, panelClass: 'snackbar--warning' });
      return;
    }
    item.cantidad = nuevaCantidad;
    item.subtotal = nuevaCantidad * this.precioReal(item.producto);
  }

  // ── MÉTODO: QUITAR DEL CARRITO ────────────
  quitarDelCarrito(item: ItemCarrito): void {
    const idItem = (item.producto as any)._id || item.producto.id;
    this.carrito = this.carrito.filter(i => {
      const id = (i.producto as any)._id || i.producto.id;
      return id !== idItem;
    });
  }

  // ── MÉTODO: LIMPIAR CARRITO ───────────────
  limpiarCarrito(): void {
    this.dialog.open(ConfirmacionDialogComponent, {
      width: 'min(420px, calc(100vw - 32px))',
      data: { titulo: 'Vaciar carrito', mensaje: '¿Querés quitar todos los productos del carrito?', textoConfirmar: 'Vaciar' },
    }).afterClosed().subscribe(confirmado => {
      if (confirmado) this.carrito = [];
    });
  }

  // ── MÉTODO: COBRAR ────────────────────────
  cobrar(): void {
    if (this.carrito.length === 0) {
      this.snackBar.open('⚠️ El carrito está vacío', 'Cerrar', { duration: 2000, panelClass: 'snackbar--warning' });
      return;
    }
    this.montoPagado  = this.totalRedondeado;
    this.montoCobrado = this.totalRedondeado;  // ← por defecto igual al redondeado, editable
    this.cobrando     = true;
  }

  // ── MÉTODO: CONFIRMAR COBRO ───────────────
  // 1. Valida el pago. 2. Descuenta el stock en la API (todos los productos).
  // 3. Recién si la API confirma, registra la venta y vacía el carrito.
  //    Si falla, no se registra nada y el cobro queda abierto para reintentar.
  confirmarCobro(): void {
    if (this.procesandoCobro) return;

    // Efectivo cobra el monto redondeado; débito, crédito y transferencia cobran el total exacto
    const importe = this.metodoPago === 'efectivo' ? this.montoCobrado : this.total;
    if (importe <= 0) {
      this.snackBar.open('El precio cobrado tiene que ser mayor a $0', 'Cerrar', { duration: 2500, panelClass: 'snackbar--warning' });
      return;
    }
    if (this.metodoPago === 'efectivo' && this.montoPagado < this.montoCobrado) {
      this.snackBar.open(`Falta dinero: el cliente entregó $${this.montoPagado} y se cobran $${this.montoCobrado}`, 'Cerrar', { duration: 3000, panelClass: 'snackbar--warning' });
      return;
    }

    // La diferencia usa montoCobrado (lo que vos decidís registrar),
    // no montoPagado (lo que dio el cliente) ni totalRedondeado.
    // Así si cobrás $50000 en vez de $49950 → diferencia = +$50
    const diferencia = this.metodoPago === 'efectivo'
      ? this.montoCobrado - this.total
      : 0;

    // Foto del cobro al confirmar: si algo cambia mientras responde la API,
    // la venta se registra con lo que realmente se descontó
    const items        = this.carrito.map(i => ({ ...i }));
    const total        = this.total;
    const metodoPago   = this.metodoPago;
    const montoCobrado = this.montoCobrado;
    const montoPagado  = this.montoPagado;
    const idDe = (p: Producto) => p._id || p.id!;

    // Se descuenta con un ajuste atómico (resta lo vendido sobre el stock actual):
    // no pisa precios ni las reservas de pedidos online que lleguen mientras tanto,
    // y la API rechaza la venta si ya no alcanza el stock.
    // Cada pedido informa si salió bien, para poder deshacer los que sí se aplicaron.
    const descuentos = items.map(item =>
      this.productosService.ajustarStock(idDe(item.producto), -item.cantidad).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );

    this.procesandoCobro = true;
    forkJoin(descuentos).subscribe(resultados => {
      if (resultados.some(ok => !ok)) {
        // Falla parcial: se devuelve el stock de los productos que sí se descontaron
        const reversiones = items
          .filter((_, i) => resultados[i])
          .map(item => this.productosService.ajustarStock(idDe(item.producto), item.cantidad)
            .pipe(map(() => true), catchError(() => of(false))));

        (reversiones.length ? forkJoin(reversiones) : of([] as boolean[])).subscribe(revertidos => {
          this.procesandoCobro = false;
          const msg = revertidos.every(ok => ok)
            ? 'No se pudo registrar la venta (sin conexión o sin stock suficiente): el stock no se modificó.'
            : 'No se pudo registrar la venta y parte del stock quedó descontado. Revisalo en Gestión de productos.';
          this.snackBar.open(msg, 'Cerrar', { duration: 6000, panelClass: 'snackbar--error' });
          this.cargarProductos();
          this.cdr.detectChanges();
        });
        return;
      }

      const venta: Venta = {
        id:           this.cajaService.generarId(),
        fecha:        new Date().toISOString(),
        cajero:       this.usuarioLogueado?.nombre || '',
        items:        items.map(i => ({
          nombre:   i.producto.nombre,
          cantidad: i.cantidad,
          precio:   i.producto.precio,
          subtotal: i.subtotal,
        })),
        total,
        // Lo que entra a la caja es lo cobrado, no lo que entregó el cliente
        totalCobrado: metodoPago === 'efectivo' ? montoCobrado : total,
        diferencia,
        metodoPago,
      };

      this.cajaService.guardarVenta(venta);
      this.acumulado = this.cajaService.obtenerAcumulado();

      const vuelto = montoPagado - montoCobrado;
      const msg = metodoPago === 'efectivo'
        ? `Cobrado $${montoCobrado} — Vuelto: $${vuelto} — Acumulado: ${this.acumulado >= 0 ? '+' : ''}$${this.acumulado}`
        : `Cobro confirmado — $${total}`;
      this.snackBar.open(msg, 'Cerrar', { duration: 4000, panelClass: 'snackbar--success' });

      this.carrito         = [];
      this.cobrando        = false;
      this.montoPagado     = 0;
      this.montoCobrado    = 0;
      this.procesandoCobro = false;
      this.cargarProductos();
    });
  }

  // ── MÉTODO: CANCELAR COBRO ────────────────
  cancelarCobro(): void {
    if (this.procesandoCobro) return; // No se puede volver al carrito mientras se registra el cobro
    this.cobrando = false;
  }

  // ── MÉTODO: CERRAR CAJA ───────────────────
  cerrarCaja(): void {
    this.efectivoContado = 0;
    this.mostrarCierre   = true;
  }

  // ── MÉTODO: CONFIRMAR CIERRE ──────────────
  confirmarCierre(): void {
    this.cajaService.cerrarCaja();
    this.snackBar.open('✅ Caja cerrada — Hasta luego!', 'Cerrar', { duration: 2000, panelClass: 'snackbar--success' });
    setTimeout(() => {
      this.authService.logout();
      this.router.navigate(['/login']);
    }, 2000);
  }

  // ── GETTERS ───────────────────────────────

  get total(): number {
    return this.carrito.reduce((acc, item) => acc + item.subtotal, 0);
  }

  get totalRedondeado(): number {
    return this.cajaService.redondearA50(this.total, this.acumulado);
  }

  get diferenciaVenta(): number {
    return this.montoCobrado - this.total;
  }

  // Diferencia en tiempo real mientras editás montoCobrado
  get diferenciaCobro(): number {
    return this.montoCobrado - this.total;
  }

  get vuelto(): number {
    return this.montoPagado - this.montoCobrado;  // vuelto respecto a lo que cobrás
  }

  get cantidadItems(): number {
    return this.carrito.reduce((acc, item) => acc + item.cantidad, 0);
  }

  get billetesVuelto(): { billete: number; cantidad: number }[] {
    return this.cajaService.calcularBilletes(this.vuelto);
  }

  get ventasHoy(): Venta[] {
    return this.cajaService.obtenerVentasDeHoy();
  }

  get totalHoy(): number {
    return this.cajaService.totalVendidoHoy();
  }

  get totalesPorMetodo() {
    return this.cajaService.totalPorMetodo();
  }

  get diferenciaCierre(): number {
    const estado           = this.cajaService.obtenerEstado();
    const efectivoEsperado = (estado?.montoInicial || 0) + this.totalesPorMetodo.efectivo;
    return this.efectivoContado - efectivoEsperado;
  }

  get estadoAcumulado(): string {
    if (Math.abs(this.acumulado) <= 50)  return 'ok';
    if (Math.abs(this.acumulado) <= 150) return 'warning';
    return 'danger';
  }
}
