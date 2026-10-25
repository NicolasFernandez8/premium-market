// ── IMPORTS BASE ──────────────────────────────
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

// ── COMPONENTES Y SERVICIOS ───────────────────
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';
import { CarritoService, ItemCarrito } from '../../../core/services/carrito.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { AuthService } from '../../../core/services/auth.service';
import { Cotizacion, ItemCotizado } from '../../../core/models/pedido-tienda.model';
import { PROMOCIONES } from '../../../core/data/promociones';

// ── DECORADOR ────────────────────────────────
// Carrito de la tienda y checkout en una sola pantalla.
// Izquierda: productos y cantidades. Derecha: totales (los calcula la API
// con ofertas, promos del día y descuento del cliente) y datos para el pedido.
// Al confirmar se crea el pedido y se pasa a la pantalla del QR.
@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    ProductoImagenComponent,
  ],
  templateUrl: './carrito.html',
  styleUrls: ['../../admin/pedidos/pedidos.css', './carrito.css']
})
export class CarritoComponent implements OnInit {

  private carrito    = inject(CarritoService);
  private tienda     = inject(TiendaService);
  private auth       = inject(AuthService);
  private router     = inject(Router);
  private snackBar   = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private cdr        = inject(ChangeDetectorRef); // Respuestas HTTP fuera de un evento de la vista

  carrito$ = this.carrito.carrito$;
  usuario  = this.auth.obtenerUsuario();
  esCliente = this.auth.esCliente();

  cotizacion: Cotizacion | null = null;
  cotizando = false;
  errorCotizacion = '';
  enviando = false;

  // ── FORMULARIO DE CHECKOUT ────────────────
  formulario = new FormGroup({
    nombre:    new FormControl(this.esCliente ? this.usuario?.nombre ?? '' : '', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email:     new FormControl(this.esCliente ? this.usuario?.email ?? '' : '', { nonNullable: true, validators: [Validators.email] }),
    telefono:  new FormControl(this.esCliente ? this.usuario?.telefono ?? '' : '', { nonNullable: true, validators: [Validators.pattern(/^[0-9 +()-]{6,20}$/)] }),
    modalidad: new FormControl<'retiro' | 'envio'>('retiro', { nonNullable: true }),
    direccion: new FormControl('', { nonNullable: true }),
    notas:     new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });

  get f() { return this.formulario.controls; }

  ngOnInit(): void {
    // Cada cambio del carrito se vuelve a cotizar (con una pausa corta
    // para no llamar a la API en cada clic del +/-)
    this.carrito$.pipe(
      tap(() => { this.cotizando = true; }),
      debounceTime(250),
      switchMap(items => {
        if (items.length === 0) return of(null);
        return this.tienda.cotizar(this.carrito.paraApi()).pipe(
          catchError((err: HttpErrorResponse) => {
            this.errorCotizacion = err.error?.error ?? 'No se pudo calcular el total. Probá de nuevo.';
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(cotizacion => {
      this.cotizando = false;
      this.cotizacion = cotizacion;
      if (cotizacion) {
        this.errorCotizacion = '';
        // La API informa el stock real: si bajó, se ajusta el carrito
        for (const item of cotizacion.items) {
          if (item.disponible !== undefined) this.carrito.actualizarStock(item.producto, item.disponible);
        }
      }
      this.cdr.detectChanges();
    });

    // La dirección solo es obligatoria con envío
    this.f.modalidad.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(modalidad => {
      this.f.direccion.setValidators(modalidad === 'envio' ? [Validators.required, Validators.minLength(5)] : []);
      this.f.direccion.updateValueAndValidity();
    });
  }

  // ── CANTIDADES ────────────────────────────
  idDe(item: ItemCarrito): string {
    return this.carrito.idDe(item.producto);
  }

  sumar(item: ItemCarrito): void {
    this.carrito.agregar(item.producto);
  }

  restar(item: ItemCarrito): void {
    this.carrito.cambiarCantidad(this.idDe(item), item.cantidad - 1);
  }

  fijarCantidad(item: ItemCarrito, valor: string): void {
    this.carrito.cambiarCantidad(this.idDe(item), Number(valor));
  }

  quitar(item: ItemCarrito): void {
    this.carrito.quitar(this.idDe(item));
  }

  vaciar(): void {
    this.carrito.vaciar();
  }

  // Renglón cotizado por la API para mostrar el subtotal real
  cotizado(item: ItemCarrito): ItemCotizado | undefined {
    return this.cotizacion?.items.find(i => i.producto === this.idDe(item));
  }

  nombrePromo(id: string | null): string {
    const promo = PROMOCIONES.find(p => p.id === id);
    return promo ? `${promo.destacado} ${promo.titulo}` : '';
  }

  // ── CONFIRMAR PEDIDO ──────────────────────
  confirmar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const datos = this.formulario.getRawValue();
    if (!this.esCliente && !datos.email.trim() && !datos.telefono.trim()) {
      this.snackBar.open('Dejanos un email o teléfono para avisarte del pedido', 'Cerrar', { duration: 3500, panelClass: 'snackbar--warning' });
      return;
    }

    this.enviando = true;
    this.tienda.crearPedido({
      items: this.carrito.paraApi(),
      contacto: { nombre: datos.nombre.trim(), email: datos.email.trim(), telefono: datos.telefono.trim() },
      entrega: { modalidad: datos.modalidad, direccion: datos.direccion.trim() },
      notas: datos.notas.trim(),
    }).subscribe({
      next: (pedido) => {
        this.enviando = false;
        this.carrito.vaciar();
        this.router.navigate(['/pedido', pedido._id]);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando = false;
        this.cdr.detectChanges();
        const mensaje = err.status === 0 ? 'No se pudo conectar con el servidor' : err.error?.error ?? 'No se pudo crear el pedido';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000, panelClass: 'snackbar--error' });
        // Si faltó stock, se recotiza para mostrar lo disponible
        if (err.status === 409) this.carrito.refrescar();
      }
    });
  }
}
