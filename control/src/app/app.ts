// ── IMPORTS ──────────────────────────────────
import { Component, computed, inject } from '@angular/core'; // Decorador principal e inyección
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router'; // Permite insertar páginas según la URL
import { filter, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { routeAnimations } from './route-animations'; // Animación de transición entre páginas
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { ROLES_PERSONAL } from './core/models/usuario.model';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { TiendaHeaderComponent } from './shared/components/tienda-header/tienda-header';

// ── DECORADOR ────────────────────────────────
// Componente RAÍZ de Premium Market.
// Personal logueado: header interno de gestión.
// Clientes e invitados: header de la tienda online.
// Login y registro van a pantalla completa, sin header.
@Component({
  selector: 'app-root',                     // Etiqueta usada en index.html
  imports: [RouterOutlet, RouterLink, MatIconModule, NavbarComponent, TiendaHeaderComponent],
  templateUrl: './app.html',                // Vista del componente
  styleUrl: './app.css',                    // Estilos del componente
  animations: [routeAnimations]             // Transición entre páginas al navegar
})
export class AppComponent {
  private router = inject(Router);

  private auth = inject(AuthService);

  constructor() {
    inject(ThemeService);
    this.auth.refrescarSesion(); // Rol y estado al día (ej: pase a mayorista)
  }

  // Sesión reactiva: el header cambia con el login/logout
  private usuario = toSignal(this.auth.usuarioActual$, { initialValue: null });

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  esPersonal       = computed(() => ROLES_PERSONAL.includes(this.usuario()?.rol ?? ''));
  pantallaCompleta = computed(() => /^\/(login|registro)(\?|$)/.test(this.url()));

  title = 'Premium Market'; // Nombre de la aplicación
}
