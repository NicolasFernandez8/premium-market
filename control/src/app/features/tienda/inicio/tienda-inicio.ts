// ── IMPORTS BASE ──────────────────────────────
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule   } from '@angular/material/icon';

// ── COMPONENTES PROPIOS ───────────────────────
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';
import { TarjetaProductoComponent } from '../../../shared/components/tarjeta-producto/tarjeta-producto';

// ── SERVICIOS Y DATOS ─────────────────────────
import { ProductosService, Producto } from '../../../core/services/productos.service';
import { AuthService } from '../../../core/services/auth.service';
import { FotosService } from '../../../core/services/fotos.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ConfigTienda } from '../../../core/models/pedido-tienda.model';
import { CATEGORIAS } from '../../../core/data/categorias';
import { PROMOCIONES, Promocion, promocionesDelDia, textoDias } from '../../../core/data/promociones';

const MAX_PRODUCTOS_PROMO = 12;

// ── DECORADOR ────────────────────────────────
// Página principal de la tienda online: lo primero que ve quien entra.
// Estructura: bienvenida → carrusel de promos → beneficios de cuenta →
// promos con sus productos para comprar → ofertas → categorías.
// Reusa los estilos del portal interno (carrusel, tarjetas, accesos).
@Component({
  selector: 'app-tienda-inicio',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ProductoImagenComponent,
    TarjetaProductoComponent,
  ],
  templateUrl: './tienda-inicio.html',
  styleUrls: ['../../operacion/inicio/inicio.css', './tienda-inicio.css']
})
export class TiendaInicioComponent implements OnInit, OnDestroy {

  // ── SERVICIOS INYECTADOS ──────────────────
  private productosService = inject(ProductosService);
  private tienda           = inject(TiendaService);
  private fotos            = inject(FotosService);
  private cdr              = inject(ChangeDetectorRef);
  private ngZone           = inject(NgZone);
  usuario$                 = inject(AuthService).usuarioActual$;

  // ── ESTADO ────────────────────────────────
  hoy = new Date();
  cargando = true;
  error = false;
  private productos: Producto[] = [];
  config: ConfigTienda | null = null;

  // ── PROMOCIONES ───────────────────────────
  promociones: Promocion[] = PROMOCIONES;
  promosHoy: Promocion[]   = promocionesDelDia();
  textoDias = textoDias;
  promoElegida: Promocion = this.promosHoy.find(p => p.tipo !== 'bancaria') ?? PROMOCIONES[0];
  productosPromo: Producto[] = [];

  // ── CARRUSEL ──────────────────────────────
  slideActivo = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  // ── CATEGORÍAS DESTACADAS ─────────────────
  categorias = CATEGORIAS.slice(0, 12);

  // Las 12 mejores ofertas, primero las que tienen foto
  ofertas: Producto[] = [];

  // ── LIFECYCLE ─────────────────────────────
  ngOnInit(): void {
    this.tienda.config$.subscribe(config => {
      this.config = config;
      this.calcularProductosPromo();
    });
    this.cargarProductos();
    this.iniciarTimer();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  cargarProductos(): void {
    this.productosService.getAll().subscribe({
      next: (productos) => {
        this.ngZone.run(() => {
          this.productos = productos;
          const conFoto = (p: Producto) => (this.fotos.tieneFoto(p.nombre) ? 1 : 0);
          this.ofertas = productos
            .filter(p => p.oferta && p.descuento > 0 && p.stock > 0)
            .sort((a, b) => conFoto(b) - conFoto(a) || b.descuento - a.descuento)
            .slice(0, 12);
          this.cargando = false;
          this.calcularProductosPromo();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Error cargando productos:', err);
          this.cargando = false;
          this.error = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── PROMOS: PRODUCTOS PARA COMPRAR ────────
  // Los productos de la promo elegida: primero los del cartel y después
  // el resto que alcanza la regla de precio (categoría o marca).
  elegirPromo(promo: Promocion, desplazar = false): void {
    this.promoElegida = promo;
    this.calcularProductosPromo();
    if (desplazar) {
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('promos')?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    }
  }

  private calcularProductosPromo(): void {
    const promo = this.promoElegida;
    const regla = this.config?.promociones.find(r => r.id === promo.id);
    const destacados = promo.productos
      .map(nombre => this.productos.find(p => p.nombre === nombre))
      .filter((p): p is Producto => !!p);
    const alcanzados = regla
      ? this.productos.filter(p => !destacados.includes(p) && this.tienda.aplicaA(regla, p) && p.stock > 0)
      : [];
    this.productosPromo = [...destacados, ...alcanzados].slice(0, MAX_PRODUCTOS_PROMO);
    this.cdr.detectChanges();
  }

  esHoy(promo: Promocion): boolean {
    return promo.dias.includes(this.hoy.getDay());
  }

  // Cómo se aprovecha la promo comprando online
  comoAplicaOnline(promo: Promocion): { icono: string; texto: string } {
    if (promo.tipo === 'bancaria') {
      return { icono: 'account_balance', texto: `Reintegro de ${promo.medioPago ?? 'tu banco'}: el total de la tienda no cambia` };
    }
    return this.esHoy(promo)
      ? { icono: 'auto_awesome', texto: 'Se descuenta sola en el carrito' }
      : { icono: 'event', texto: `Se descuenta sola en el carrito los días de la promo (${textoDias(promo.dias).toLowerCase()})` };
  }

  // ── CARRUSEL ──────────────────────────────
  iniciarTimer(): void {
    if (this.timer) clearInterval(this.timer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      this.ngZone.run(() => {
        this.slideActivo = (this.slideActivo + 1) % this.promociones.length;
        this.cdr.detectChanges();
      });
    }, 6000);
  }

  mover(direccion: number): void {
    const total = this.promociones.length;
    this.slideActivo = (this.slideActivo + direccion + total) % total;
    this.iniciarTimer();
  }

  irA(index: number): void {
    this.slideActivo = index;
    this.iniciarTimer();
  }

  descuentoDe(rol: string | undefined): number {
    return this.config ? this.tienda.descuentoPara(this.config, rol) : 0;
  }
}
