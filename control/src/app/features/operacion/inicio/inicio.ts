// ── IMPORTS BASE ──────────────────────────────
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Pipes y directivas comunes

// ── ROUTER ────────────────────────────────────
import { RouterLink } from '@angular/router'; // Links de navegación entre rutas

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule   } from '@angular/material/icon';

// ── COMPONENTES PROPIOS ───────────────────────
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';

// ── SERVICIOS Y DATOS ─────────────────────────
import { ProductosService, Producto } from '../../../core/services/productos.service';
import { AuthService, Usuario } from '../../../core/services/auth.service';
import { FotosService } from '../../../core/services/fotos.service';
import { PROMOCIONES, Promocion, comoSeAplica, promocionesDelDia, textoDias } from '../../../core/data/promociones';

// Acceso rápido a un módulo, visible según el rol
interface Acceso {
  label: string;
  descripcion: string;
  icono: string;
  ruta: string;
  roles: string[];
}

// ── DECORADOR ────────────────────────────────
// Portal interno: la primera pantalla después del login.
// Estructura: saludo → promos vigentes (carrusel) → qué aplicar
// hoy en caja → alertas de stock → ofertas activas → accesos.
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ProductoImagenComponent,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css'
})
export class InicioComponent implements OnInit, OnDestroy {

  // ── SERVICIOS INYECTADOS ──────────────────
  private productosService = inject(ProductosService);  // API REST de productos
  private authService      = inject(AuthService);       // Usuario logueado
  private fotos            = inject(FotosService);      // Qué productos tienen foto
  private cdr              = inject(ChangeDetectorRef); // Fuerza actualización de la vista
  private ngZone           = inject(NgZone);            // Zona Angular para detectar cambios de HTTP

  // ── ESTADO GENERAL ────────────────────────
  usuario: Usuario | null = this.authService.obtenerUsuario();
  hoy = new Date();
  saludo = this.calcularSaludo();
  cargando = true;

  private conOferta: Producto[] = []; // Productos con oferta activa
  sinStock = 0;
  stockBajo = 0;
  totalProductos = 0;

  // ── PROMOCIONES ───────────────────────────
  promociones: Promocion[] = PROMOCIONES;
  promosHoy: Promocion[]   = promocionesDelDia();
  textoDias = textoDias;
  comoSeAplica = comoSeAplica;

  // ── CARRUSEL ──────────────────────────────
  slideActivo = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  // ── ACCESOS RÁPIDOS ───────────────────────
  private accesos: Acceso[] = [
    { label: 'Abrir caja',          descripcion: 'Cobrar y cerrar turno',          icono: 'point_of_sale',   ruta: '/admin/caja',         roles: ['admin', 'cajero'] },
    { label: 'Consultar precio',    descripcion: 'Precio, oferta y stock',         icono: 'sell',            ruta: '/catalogo',           roles: ['admin', 'empleado', 'cajero', 'repositor'] },
    { label: 'Recibir mercadería',  descripcion: 'Sumar stock de un proveedor',    icono: 'local_shipping',  ruta: '/admin/recepciones',  roles: ['admin', 'empleado', 'repositor'] },
    { label: 'Armar pedido',        descripcion: 'Reposición a proveedores',       icono: 'assignment',      ruta: '/admin/pedidos',      roles: ['admin', 'empleado', 'repositor'] },
    { label: 'Pedidos online',      descripcion: 'Preparar y entregar compras web', icono: 'groups',     ruta: '/admin/clientes',     roles: ['admin', 'empleado', 'cajero'] },
    { label: 'Productos',           descripcion: 'Altas, precios y ofertas',       icono: 'inventory_2',     ruta: '/admin/productos',    roles: ['admin', 'empleado', 'cajero', 'repositor'] },
    { label: 'Estadísticas',        descripcion: 'Stock y ofertas por categoría',  icono: 'query_stats',     ruta: '/admin/estadisticas', roles: ['admin'] },
  ];

  // Las 12 mejores ofertas, primero las que tienen foto
  get ofertas(): Producto[] {
    const conFoto = (p: Producto) => (this.fotos.tieneFoto(p.nombre) ? 1 : 0);
    return [...this.conOferta]
      .sort((a, b) => conFoto(b) - conFoto(a) || b.descuento - a.descuento)
      .slice(0, 12);
  }

  // Mismos roles que la ruta /admin/pedidos (noEsCajeroGuard)
  get puedePedir(): boolean {
    return ['admin', 'empleado', 'repositor'].includes(this.usuario?.rol ?? '');
  }

  get primerNombre(): string {
    return this.usuario?.nombre.split(' ')[0] ?? '';
  }

  get accesosDelRol(): Acceso[] {
    const rol = this.usuario?.rol ?? '';
    return this.accesos.filter(a => a.roles.includes(rol));
  }

  // ── LIFECYCLE ─────────────────────────────
  ngOnInit(): void {
    this.cargarProductos();
    this.iniciarTimer();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── MÉTODO: CARGAR PRODUCTOS ──────────────
  // GET — Trae el catálogo para ofertas y alertas de stock.
  // Usa NgZone + detectChanges para forzar la actualización de la vista
  cargarProductos(): void {
    this.productosService.getAll().subscribe({
      next: (productos) => {
        this.ngZone.run(() => {
          this.totalProductos = productos.length;
          this.sinStock  = productos.filter(p => p.stock === 0).length;
          this.stockBajo = productos.filter(p => p.stock > 0 && p.stock < 5).length;
          this.conOferta = productos.filter(p => p.oferta && p.descuento > 0);
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Error cargando productos:', err);
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── CARRUSEL: AUTO-AVANCE ─────────────────
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

  // Avanza (+1) o retrocede (-1) con vuelta al principio
  mover(direccion: number): void {
    const total = this.promociones.length;
    this.slideActivo = (this.slideActivo + direccion + total) % total;
    this.iniciarTimer();
  }

  irA(index: number): void {
    this.slideActivo = index;
    this.iniciarTimer();
  }

  esHoy(promo: Promocion): boolean {
    return promo.dias.includes(this.hoy.getDay());
  }

  // Baja suavemente hasta el panel "Promociones de hoy"
  irAPromos(evento: Event): void {
    evento.preventDefault();
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('promos-hoy')?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  }

  // ── MÉTODO: PRECIO FINAL ─────────────────
  // Calcula el precio con descuento — ej: 1000 con 40% → 600
  precioFinal(precio: number, descuento: number): number {
    return precio - (precio * descuento / 100);
  }

  private calcularSaludo(): string {
    const hora = new Date().getHours();
    if (hora < 13) return 'Buen día';
    if (hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
