// ── IMPORTS ──────────────────────────────────
import { Component, inject } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';

// ── SERVICIOS ─────────────────────────────────
import { AuthService } from '../../../core/services/auth.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';

// ── DECORADOR ────────────────────────────────
// Header de la tienda online (invitados y clientes).
// Fila 1: logo, buscador, carrito e "Ingresar" arriba a la derecha.
// Fila 2: accesos a promos, ofertas y categorías.
// Mismo formato visual que el header interno (reusa navbar.css).
@Component({
  selector: 'app-tienda-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    ThemeToggleComponent,
  ],
  templateUrl: './tienda-header.html',
  styleUrls: ['../navbar/navbar.css', './tienda-header.css']
})
export class TiendaHeaderComponent {

  private authService = inject(AuthService);
  private carrito     = inject(CarritoService);
  private router      = inject(Router);

  usuarioActual$  = this.authService.usuarioActual$;
  cantidadCarrito$ = this.carrito.cantidadTotal$;
  config$         = inject(TiendaService).config$;

  busqueda = '';

  // Accesos de la segunda fila
  secciones = [
    { label: 'Inicio',      icono: 'home',          ruta: '/',          params: null },
    { label: 'Promos',      icono: 'campaign',      ruta: '/',          params: null, fragmento: 'promos' },
    { label: 'Ofertas',     icono: 'local_offer',   ruta: '/productos', params: { ofertas: 1 } },
    { label: 'Almacén',     icono: 'storefront',    ruta: '/productos', params: { categoria: 'Almacén' } },
    { label: 'Bebidas',     icono: 'local_drink',   ruta: '/productos', params: { categoria: 'Gaseosas' } },
    { label: 'Lácteos',     icono: 'egg',           ruta: '/productos', params: { categoria: 'Lácteos' } },
    { label: 'Limpieza',    icono: 'cleaning_services', ruta: '/productos', params: { categoria: 'Limpieza' } },
    { label: 'Todos los productos', icono: 'apps',  ruta: '/productos', params: null },
  ];

  // Inicio y Promos comparten la ruta "/": el #ancla y los filtros también
  // cuentan para marcar la sección activa (si no, se marcan las dos)
  activoExacto: IsActiveMatchOptions = { paths: 'exact', queryParams: 'exact', fragment: 'exact', matrixParams: 'ignored' };

  iniciales(nombre: string): string {
    return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  buscar(): void {
    const q = this.busqueda.trim();
    this.router.navigate(['/productos'], { queryParams: q ? { q } : {} });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
