// ── IMPORTS ──────────────────────────────────
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

// ── SERVICIOS ─────────────────────────────────
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle';
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';

// ── DECORADOR ────────────────────────────────
// Página de login de Premium Market: clientes de la tienda y personal.
// Verifica credenciales contra la API y guarda sesión en LocalStorage.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ProductoImagenComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ThemeToggleComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

// ── CLASE ────────────────────────────────────
export class LoginComponent {

  // ── SERVICIOS INYECTADOS ──────────────────
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // ?volver= para regresar al carrito
  private snackBar = inject(MatSnackBar);

  // ── ESTADO ────────────────────────────────
  cargando: boolean = false;
  mostrarPassword: boolean = false;

  // Productos del panel de marca (fotos de góndola)
  productosGondola = [
    'Coca-Cola Original 2.25L',
    'Leche La Serenísima Entera 1L',
    'Yerba Mate Taragüí 500g',
    'Fideos Tallarín Matarazzo 500g',
    'Dulce de Leche La Serenísima 400g',
    'Café Molido La Virginia 500g',
  ];

  // ── FORMULARIO REACTIVO ───────────────────
  formulario = new FormGroup({
    usuario: new FormControl('', [
      Validators.required,
      Validators.minLength(3),
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(4),
    ]),
  });

  // El registro conserva a dónde volver (ej: el carrito)
  get volverParams() {
    const volver = this.route.snapshot.queryParamMap.get('volver');
    return volver ? { volver } : {};
  }

  // ── GETTERS ───────────────────────────────
  get usuario() { return this.formulario.get('usuario'); }
  get password() { return this.formulario.get('password'); }

  // ── MÉTODO: TOGGLE PASSWORD ───────────────
  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  // ── MÉTODO: SUBMIT ────────────────────────
  onSubmit(): void {

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando = true;

    const usuarioInput = this.formulario.value.usuario!;
    const passwordInput = this.formulario.value.password!;

    // Llamamos al servicio — el backend ya verificó las credenciales con bcrypt
    this.authService.login(usuarioInput, passwordInput)
      .subscribe({
        next: (usuarios) => {
          this.cargando = false;

          // El backend devuelve el usuario si las credenciales son correctas,
          // o array vacío si no coinciden — solo verificamos activo
          const usuarioEncontrado = usuarios.find(u => u.activo === true);

          if (usuarioEncontrado) {
            // Guardamos la sesión en LocalStorage
            this.authService.guardarSesion(usuarioEncontrado);

            // Notificación de bienvenida
            this.snackBar.open(
              `¡Bienvenido ${usuarioEncontrado.nombre}! (${usuarioEncontrado.rol})`,
              'Cerrar',
              { duration: 3000, panelClass: 'snackbar--success' }
            );

            // El personal va al portal interno; el cliente vuelve a donde estaba
            // (ej: el carrito) o a la tienda. "volver" solo acepta rutas internas.
            const volver = this.route.snapshot.queryParamMap.get('volver') ?? '';
            const destino = volver.startsWith('/') && !volver.startsWith('//')
              ? volver
              : this.authService.rutaInicio(usuarioEncontrado);
            this.router.navigateByUrl(destino);

          } else if (usuarios.length > 0) {
            // Credenciales correctas pero el usuario está desactivado
            this.snackBar.open(
              'Tu usuario está desactivado. Pedile a un administrador que lo active.',
              'Cerrar',
              { duration: 4000, panelClass: 'snackbar--warning' }
            );
          } else {
            // Credenciales incorrectas
            this.snackBar.open(
              'Usuario o contraseña incorrectos',
              'Cerrar',
              { duration: 3000, panelClass: 'snackbar--error' }
            );
          }
        },
        error: (err) => {
          this.cargando = false;
          this.snackBar.open(
            'Error al conectar con el servidor',
            'Cerrar',
            { duration: 3000, panelClass: 'snackbar--error' }
          );
          console.error('Error login:', err);
        }
      });
  }
}
