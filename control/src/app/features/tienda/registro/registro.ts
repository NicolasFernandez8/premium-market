// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../../core/services/auth.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle';
import { ProductoImagenComponent } from '../../../shared/components/producto-imagen/producto-imagen';

// Las dos contraseñas tienen que coincidir
function coincidenPasswords(grupo: AbstractControl): ValidationErrors | null {
  const { password, repetir } = grupo.value;
  return password && repetir && password !== repetir ? { distintas: true } : null;
}

// ── DECORADOR ────────────────────────────────
// Alta de clientes de la tienda. Mismo formato que el login.
// Al registrarse inicia sesión y vuelve a donde estaba (ej: el carrito).
@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    ThemeToggleComponent,
    ProductoImagenComponent,
  ],
  templateUrl: './registro.html',
  styleUrls: ['../../admin/login/login.css', './registro.css']
})
export class RegistroComponent {

  private auth     = inject(AuthService);
  private router   = inject(Router);
  private route    = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private cdr      = inject(ChangeDetectorRef);
  config$          = inject(TiendaService).config$;

  cargando = false;
  mostrarPassword = false;

  productosGondola = [
    'Coca-Cola Original 2.25L',
    'Leche La Serenísima Entera 1L',
    'Yerba Mate Taragüí 500g',
  ];

  formulario = new FormGroup({
    nombre:   new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    usuario:  new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,30}$/)] }),
    email:    new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9 +()-]{6,20}$/)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    repetir:  new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: coincidenPasswords });

  get f() { return this.formulario.controls; }

  registrar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { repetir: _, ...datos } = this.formulario.getRawValue();
    datos.usuario = datos.usuario.trim().toLowerCase();
    this.cargando = true;

    // Registro y login seguidos: la API devuelve el usuario sin contraseña
    this.auth.registrar(datos).pipe(
      switchMap(() => this.auth.login(datos.usuario, datos.password))
    ).subscribe({
      next: (usuarios) => {
        this.cargando = false;
        if (usuarios[0]) this.auth.guardarSesion(usuarios[0]);
        this.snackBar.open(`¡Bienvenido/a, ${datos.nombre.split(' ')[0]}! Ya tenés tu descuento de cliente.`, 'Cerrar',
          { duration: 3500, panelClass: 'snackbar--success' });
        const volver = this.route.snapshot.queryParamMap.get('volver') ?? '';
        this.router.navigateByUrl(volver.startsWith('/') && !volver.startsWith('//') ? volver : '/');
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.cdr.detectChanges();
        const mensaje = err.status === 0 ? 'No se pudo conectar con el servidor' : err.error?.error ?? 'No se pudo crear la cuenta';
        this.snackBar.open(mensaje, 'Cerrar', { duration: 4000, panelClass: 'snackbar--error' });
      }
    });
  }
}
