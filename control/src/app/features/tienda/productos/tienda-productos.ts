// ── IMPORTS BASE ──────────────────────────────
import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule  } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule          } from '@angular/material/button';
import { MatIconModule            } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// ── COMPONENTES Y SERVICIOS ───────────────────
import { TarjetaProductoComponent } from '../../../shared/components/tarjeta-producto/tarjeta-producto';
import { ProductosService, Producto } from '../../../core/services/productos.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ConfigTienda } from '../../../core/models/pedido-tienda.model';
import { CATEGORIAS } from '../../../core/data/categorias';

type Orden = 'nombre' | 'precio-asc' | 'precio-desc' | 'descuento';

const POR_PAGINA = 48;

// ── DECORADOR ────────────────────────────────
// Catálogo de la tienda online: búsqueda, categorías, ofertas y
// promos del día, con "Agregar al carrito" en cada producto.
// Mismo formato que la consulta de precios interna (reusa catalogo.css).
// Filtros por URL: ?q=, ?categoria=, ?ofertas=1, ?promos=1
@Component({
  selector: 'app-tienda-productos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TarjetaProductoComponent,
  ],
  templateUrl: './tienda-productos.html',
  styleUrl: '../../operacion/catalogo/catalogo.css'
})
export class TiendaProductosComponent implements OnInit {

  private productosService = inject(ProductosService);
  private tienda           = inject(TiendaService);
  private route            = inject(ActivatedRoute);
  private cdr              = inject(ChangeDetectorRef);
  private ngZone           = inject(NgZone);

  // ── ESTADO ────────────────────────────────
  productos: Producto[]          = [];
  productosFiltrados: Producto[] = [];
  cargando = false;
  error = false;
  visibles = POR_PAGINA;
  private config: ConfigTienda | null = null;

  // ── FILTROS ───────────────────────────────
  textoBusqueda = '';
  categoriaSeleccionada = '';
  soloOfertas = false;
  soloPromos = false;
  orden: Orden = 'nombre';

  categorias = CATEGORIAS;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.textoBusqueda         = params.get('q') ?? '';
      this.soloOfertas           = params.get('ofertas') === '1';
      this.soloPromos            = params.get('promos') === '1';
      this.categoriaSeleccionada = params.get('categoria') ?? '';
      this.aplicarFiltros();
    });

    this.tienda.config$.subscribe(config => {
      this.config = config;
      this.aplicarFiltros();
    });

    this.cargando = true;
    this.productosService.getAll().subscribe({
      next: (productos) => {
        this.ngZone.run(() => {
          this.productos = productos;
          this.cargando  = false;
          this.aplicarFiltros();
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

  // Recalcula la lista según búsqueda, categoría, ofertas y promos.
  // Los productos sin stock quedan al final.
  aplicarFiltros(): void {
    const texto = this.normalizar(this.textoBusqueda);

    this.productosFiltrados = this.productos
      .filter(p => {
        const coincideTexto     = !texto || this.normalizar(`${p.nombre} ${p.categoria} ${p.descripcion}`).includes(texto);
        const coincideCategoria = !this.categoriaSeleccionada || p.categoria === this.categoriaSeleccionada;
        const coincideOferta    = !this.soloOfertas || (p.oferta && p.descuento > 0);
        const coincidePromo     = !this.soloPromos || this.enPromo(p);
        return coincideTexto && coincideCategoria && coincideOferta && coincidePromo;
      })
      .sort((a, b) => {
        const stock = Number(b.stock > 0) - Number(a.stock > 0);
        if (stock) return stock;
        switch (this.orden) {
          case 'precio-asc':  return this.tienda.precioOferta(a) - this.tienda.precioOferta(b);
          case 'precio-desc': return this.tienda.precioOferta(b) - this.tienda.precioOferta(a);
          case 'descuento':   return (b.oferta ? b.descuento : 0) - (a.oferta ? a.descuento : 0);
          default:            return a.nombre.localeCompare(b.nombre, 'es');
        }
      });

    this.visibles = POR_PAGINA;
    this.cdr.detectChanges();
  }

  private enPromo(p: Producto): boolean {
    return !!this.config && !!this.tienda.promoDeHoy(this.config, p);
  }

  seleccionarCategoria(nombre: string): void {
    this.categoriaSeleccionada = this.categoriaSeleccionada === nombre ? '' : nombre;
    this.aplicarFiltros();
  }

  alternarOfertas(): void {
    this.soloOfertas = !this.soloOfertas;
    this.aplicarFiltros();
  }

  alternarPromos(): void {
    this.soloPromos = !this.soloPromos;
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.categoriaSeleccionada = '';
    this.soloOfertas = false;
    this.soloPromos = false;
    this.aplicarFiltros();
  }

  mostrarMas(): void {
    this.visibles += POR_PAGINA;
  }

  get hayFiltros(): boolean {
    return !!(this.textoBusqueda || this.categoriaSeleccionada || this.soloOfertas || this.soloPromos);
  }

  cantidadEnCategoria(nombre: string): number {
    return this.productos.filter(p => p.categoria === nombre).length;
  }

  get cantidadOfertas(): number {
    return this.productos.filter(p => p.oferta && p.descuento > 0).length;
  }

  get cantidadPromos(): number {
    return this.productos.filter(p => this.enPromo(p)).length;
  }

  // Búsqueda sin tildes ni mayúsculas: "lacteos" encuentra "Lácteos"
  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
