// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core'; // Component, lifecycle e inject
import { CommonModule } from '@angular/common';             // Directivas ngIf, ngFor
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms'; // Reactive Forms

// ── ANGULAR MATERIAL ──────────────────────────
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';

// ── SERVICIOS ─────────────────────────────────
import { AuthService, Usuario } from '../../../core/services/auth.service';
import { ROLES_PERSONAL } from '../../../core/models/usuario.model';
import { formAnimation } from '../../../form-animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmacionDialogComponent } from '../../../shared/components/confirmacion-dialog/confirmacion-dialog';

// ── DECORADOR ────────────────────────────────
// Página de gestión de usuarios (solo administrador).
// Implementa CRUD completo contra la API REST usando AuthService.
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
  animations: [formAnimation]
})

// ── CLASE ────────────────────────────────────
export class UsuariosComponent implements OnInit {

  // ── SERVICIOS INYECTADOS ──────────────────
  private authService = inject(AuthService);       // CRUD de usuarios y sesión
  private snackBar    = inject(MatSnackBar);       // Notificaciones
  private dialog      = inject(MatDialog);
  private cdr         = inject(ChangeDetectorRef); // Detección de cambios

  // ── ESTADO ────────────────────────────────
  usuarios: Usuario[]            = [];    // Lista de usuarios de la API
  usuarioLogueado: Usuario | null = null; // Quién está usando el panel
  cargando: boolean              = false; // Spinner de carga
  modoEdicion: boolean           = false; // true = editando | false = creando
  usuarioEditandoId: string      = '';    // ID del usuario que se está editando
  mostrarFormulario: boolean     = false; // Muestra u oculta el formulario
  mostrarPassword: boolean       = false; // Muestra u oculta la contraseña

  // ── COLUMNAS DE LA TABLA ──────────────────
  columnasTabla: string[] = ['nombre', 'usuario', 'rol', 'activo', 'acciones'];

  // ── ROLES DISPONIBLES ─────────────────────
  // Roles que el admin puede asignar al crear/editar un usuario
  roles: string[] = ['admin', 'empleado', 'cajero', 'repositor'];

  // ── FORMULARIO REACTIVO ───────────────────
  formulario = new FormGroup({
    nombre:   new FormControl('', [Validators.required, Validators.minLength(3)]),
    usuario:  new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required, Validators.minLength(4)]),
    rol:      new FormControl('', [Validators.required]),
    activo:   new FormControl(true),
  });

  // ── GETTERS ───────────────────────────────
  get nombre()   { return this.formulario.get('nombre');   }
  get usuario()  { return this.formulario.get('usuario');  }
  get password() { return this.formulario.get('password'); }
  get rol()      { return this.formulario.get('rol');      }

  // ── LIFECYCLE HOOK ────────────────────────
  ngOnInit(): void {
    this.usuarioLogueado = this.authService.obtenerUsuario();
    this.cargarUsuarios();
  }

  // ── MÉTODO: CARGAR USUARIOS ───────────────
  // GET — Obtiene todos los usuarios de la API
  cargarUsuarios(): void {
    this.cargando = true;
    this.authService.getUsuarios().subscribe({
      next: (usuarios) => {
        // Solo el personal: los clientes de la tienda se gestionan en Clientes
        this.usuarios = usuarios.filter(u => ROLES_PERSONAL.includes(u.rol));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando usuarios:', err);
        this.cargando = false;
        this.snackBar.open('Error al cargar los usuarios', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' });
        this.cdr.detectChanges();
      }
    });
  }

  // ── MÉTODO: NUEVO USUARIO ─────────────────
  // Prepara el formulario en modo creación con password obligatorio
  nuevoUsuario(): void {
    this.modoEdicion       = false;
    this.usuarioEditandoId = '';
    this.mostrarPassword   = false;

    // Al crear, la contraseña es obligatoria
    this.formulario.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.formulario.get('password')?.updateValueAndValidity();

    this.formulario.reset({ activo: true });
    this.mostrarFormulario = true;
  }

  // ── MÉTODO: EDITAR USUARIO ────────────────
  // Prepara el formulario en modo edición con password opcional
  editarUsuario(usuario: Usuario): void {
    this.modoEdicion       = true;
    this.usuarioEditandoId = usuario._id || usuario.id!;
    this.mostrarPassword   = false;

    // En edición la contraseña es opcional — solo se cambia si se ingresa
    // En edición la contraseña es opcional, pero si se escribe debe tener 4+ caracteres
    this.formulario.get('password')?.setValidators([Validators.minLength(4)]);
    this.formulario.get('password')?.updateValueAndValidity();

    this.formulario.patchValue({ ...usuario, password: '' });
    this.mostrarFormulario = true;
  }

  // ── MÉTODO: GUARDAR USUARIO ───────────────
  // POST o PUT según el modo
  guardarUsuario(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const datos = this.formulario.getRawValue() as Usuario;
    datos.nombre  = datos.nombre.trim();
    datos.usuario = datos.usuario.trim().toLowerCase();

    // Un admin no puede quitarse su propio rol ni desactivarse (quedaría sin acceso)
    const editandoseASiMismo = this.modoEdicion && this.idDe(this.usuarioLogueado) === this.usuarioEditandoId;
    if (editandoseASiMismo && (datos.rol !== 'admin' || !datos.activo)) {
      this.snackBar.open('No podés quitarte el rol de administrador ni desactivar tu propio usuario', 'Cerrar', { duration: 4000, panelClass: 'snackbar--warning' });
      return;
    }

    // Evitamos dos usuarios con el mismo nombre de usuario
    const duplicado = this.usuarios.some(u =>
      u.usuario.toLowerCase() === datos.usuario &&
      this.idDe(u) !== this.usuarioEditandoId   // MongoDB usa _id: comparar el id real
    );
    if (duplicado) {
      this.snackBar.open('⚠️ Ese nombre de usuario ya existe', 'Cerrar', { duration: 3000, panelClass: 'snackbar--warning' });
      return;
    }

    if (this.modoEdicion) {
      // Si estamos editando y no se ingresó password, lo eliminamos
      // para que el backend no lo pise con un valor vacío
      if (!datos.password) {
        delete (datos as any).password;
      }

      // PUT — Actualizar usuario existente
      this.authService.updateUsuario(this.usuarioEditandoId, datos).subscribe({
        next: (actualizado) => {
          // Si me edité a mí mismo, actualizo la sesión guardada
          if (editandoseASiMismo) {
            this.authService.guardarSesion(actualizado);
            this.usuarioLogueado = actualizado;
          }
          this.snackBar.open('Usuario actualizado ✅', 'Cerrar', { duration: 3000, panelClass: 'snackbar--success' });
          this.mostrarFormulario = false;
          this.cargarUsuarios();
        },
        error: (err) => {
          console.error('Error actualizando:', err);
          this.snackBar.open('Error al actualizar el usuario', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' });
        }
      });
    } else {
      // POST — Crear nuevo usuario
      this.authService.createUsuario(datos).subscribe({
        next: () => {
          this.snackBar.open('Usuario creado ✅', 'Cerrar', { duration: 3000, panelClass: 'snackbar--success' });
          this.mostrarFormulario = false;
          this.cargarUsuarios();
        },
        error: (err) => {
          console.error('Error creando:', err);
          this.snackBar.open('Error al crear el usuario', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' });
        }
      });
    }
  }

  // ── MÉTODO: ELIMINAR USUARIO ──────────────
  // DELETE — Elimina un usuario de la API con confirmación
  eliminarUsuario(usuario: Usuario): void {
    if (this.esUsuarioActual(usuario)) {
      this.snackBar.open('⚠️ No podés eliminar tu propio usuario', 'Cerrar', { duration: 3000, panelClass: 'snackbar--warning' });
      return;
    }
    this.dialog.open(ConfirmacionDialogComponent, {
      width: 'min(420px, calc(100vw - 32px))',
      data: {
        titulo: 'Eliminar usuario',
        mensaje: `¿Querés eliminar al usuario "${usuario.usuario}"? Esta acción no se puede deshacer.`,
      },
    }).afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.authService.deleteUsuario(usuario._id || usuario.id!).subscribe({
        next: () => {
          this.snackBar.open('Usuario eliminado 🗑️', 'Cerrar', { duration: 3000, panelClass: 'snackbar--success' });
          this.cargarUsuarios();
        },
        error: (err) => {
          console.error('Error eliminando:', err);
          this.snackBar.open('Error al eliminar el usuario', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' });
        }
      });
    });
  }

  // ── MÉTODO: CANCELAR ──────────────────────
  // Cierra el formulario y resetea los campos
  cancelar(): void {
    this.mostrarFormulario = false;
    this.formulario.reset();
  }

  // ── MÉTODO: TOGGLE PASSWORD ───────────────
  // Alterna la visibilidad de la contraseña en el input
  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  // ── MÉTODO: ES EL USUARIO ACTUAL ──────────
  // Lo usa el template para deshabilitar el botón de eliminar
  esUsuarioActual(usuario: Usuario): boolean {
    return this.idDe(usuario) === this.idDe(this.usuarioLogueado);
  }

  // Identificador real del usuario (MongoDB usa _id)
  private idDe(usuario: Usuario | null): string | undefined {
    return usuario?._id || usuario?.id;
  }
}
