// ── IMPORTS ──────────────────────────────────
import { Component, inject } from '@angular/core'; // Component e inject para DI
import { Router, RouterLink, RouterLinkActive } from '@angular/router'; // Navegación entre rutas
import { CommonModule } from '@angular/common'; // Pipes async, date, titlecase
import { FormsModule } from '@angular/forms';   // ngModel del buscador

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';   // Botones Material
import { MatIconModule } from '@angular/material/icon';       // Íconos Material
import { MatBadgeModule } from '@angular/material/badge';     // Badge del pedido

// ── SERVICIOS ─────────────────────────────────
import { AuthService } from '../../../core/services/auth.service';
import { PedidoService } from '../../../core/services/pedido.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';

// Un módulo del sistema y los roles que lo ven
interface Modulo {
  label: string;
  icono: string;
  ruta: string;
  roles: string[];
}

const TODOS = ['admin', 'empleado', 'cajero', 'repositor'];

// ── DECORADOR ────────────────────────────────
// Header interno de Premium Market, presente en todas las
// pantallas con sesión. Fila 1: logo, buscador de productos,
// pedido en curso y usuario. Fila 2: módulos según el rol.
@Component({
  selector: 'app-navbar',        // Se usa una sola vez en app.html
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    ThemeToggleComponent,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {

  // ── SERVICIOS INYECTADOS ──────────────────
  private authService   = inject(AuthService);   // Sesión y rol
  private pedidoService = inject(PedidoService); // Badge del pedido
  private router        = inject(Router);        // Navegación del buscador y logout

  // ── MÓDULOS DEL MENÚ ──────────────────────
  // Se muestran con @for, filtrados por el rol del usuario
  modulos: Modulo[] = [
    { label: 'Inicio',              icono: 'home',            ruta: '/inicio',             roles: TODOS },
    { label: 'Consulta de precios', icono: 'sell',            ruta: '/catalogo',           roles: TODOS },
    { label: 'Caja',                icono: 'point_of_sale',   ruta: '/admin/caja',         roles: ['admin', 'cajero'] },
    { label: 'Productos',           icono: 'inventory_2',     ruta: '/admin/productos',    roles: TODOS },
    { label: 'Recepciones',         icono: 'local_shipping',  ruta: '/admin/recepciones',  roles: ['admin', 'empleado', 'repositor'] },
    { label: 'Pedidos',             icono: 'assignment',      ruta: '/admin/pedidos',      roles: ['admin', 'empleado', 'repositor'] },
    { label: 'Clientes',            icono: 'groups',          ruta: '/admin/clientes',     roles: ['admin', 'empleado', 'cajero'] },
    { label: 'Panel',               icono: 'dashboard',       ruta: '/admin/dashboard',    roles: TODOS },
    { label: 'Estadísticas',        icono: 'query_stats',     ruta: '/admin/estadisticas', roles: ['admin'] },
    { label: 'Usuarios',            icono: 'manage_accounts', ruta: '/admin/usuarios',     roles: ['admin'] },
    { label: 'Movimientos',         icono: 'manage_search',   ruta: '/admin/movimientos',  roles: ['admin'] },
  ];

  // ── SESIÓN REACTIVA ────────────────────────
  usuarioActual$ = this.authService.usuarioActual$;

  // ── BADGE DEL PEDIDO ──────────────────────
  cantidadPedido$ = this.pedidoService.cantidadTotal$;

  // ── BUSCADOR ──────────────────────────────
  busqueda = '';
  hoy = new Date();

  modulosDe(rol: string): Modulo[] {
    return this.modulos.filter(m => m.roles.includes(rol));
  }

  puedePedir(rol: string): boolean {
    return ['admin', 'empleado', 'repositor'].includes(rol);
  }

  // Iniciales para el avatar: "Juan Pérez" → "JP"
  iniciales(nombre: string): string {
    return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  // Lleva la búsqueda a la consulta de precios
  buscar(): void {
    const q = this.busqueda.trim();
    this.router.navigate(['/catalogo'], { queryParams: q ? { q } : {} });
  }

  // ── MÉTODO: LOGOUT ─────────────────────────
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
