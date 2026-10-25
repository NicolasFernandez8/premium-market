// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

// ── SERVICIOS Y MODELOS ───────────────────────
import { AuthService, Usuario } from '../../../core/services/auth.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ROLES_CLIENTE } from '../../../core/models/usuario.model';
import { ESTADOS_PEDIDO, EstadoPedido, PedidoTienda, ResumenCliente } from '../../../core/models/pedido-tienda.model';
import { ConfirmacionDialogComponent } from '../../../shared/components/confirmacion-dialog/confirmacion-dialog';

type Vista = 'pedidos' | 'clientes';

// Fila de la lista de clientes: con cuenta o invitado (agrupado por email/teléfono)
interface FilaCliente {
  clave: string;
  nombre: string;
  contacto: string;
  tipo: 'cliente' | 'mayorista' | 'invitado';
  usuario: Usuario | null;
  cantidadPedidos: number;
  compras: number;
  gastado: number;
  ultimo: string | null;
}

// Siguiente paso de un pedido en la sucursal
const SIGUIENTE: Partial<Record<EstadoPedido, { estado: EstadoPedido; texto: string; icono: string }>> = {
  pagado:     { estado: 'preparando', texto: 'Preparar',     icono: 'inventory' },
  preparando: { estado: 'listo',      texto: 'Marcar listo', icono: 'shopping_bag' },
  listo:      { estado: 'entregado',  texto: 'Entregar',     icono: 'task_alt' },
};

const CANCELABLES: EstadoPedido[] = ['pendiente_pago', 'pagado', 'preparando'];

// ── DECORADOR ────────────────────────────────
// Clientes de la tienda online (admin, empleado y cajero).
// Pedidos: los que llegan desde la web, para prepararlos y entregarlos.
// Clientes: cuentas e invitados con su historial; el pase a mayorista se hace acá.
@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './clientes.html',
  styleUrls: ['../pedidos/pedidos.css', '../../tienda/pedido/pedido.css', './clientes.css']
})
export class ClientesComponent implements OnInit {

  private auth     = inject(AuthService);
  private tienda   = inject(TiendaService);
  private snackBar = inject(MatSnackBar);
  private dialog   = inject(MatDialog);
  private cdr      = inject(ChangeDetectorRef);

  vista: Vista = 'pedidos';
  cargando = true;
  error = false;
  estados = ESTADOS_PEDIDO;
  esAdmin = this.auth.esAdmin();

  pedidos: PedidoTienda[] = [];      // Abiertos + últimos cerrados
  clientes: FilaCliente[] = [];
  historiales = new Map<string, PedidoTienda[]>(); // Historial por cliente, se pide al desplegar

  // ── FILTROS ───────────────────────────────
  filtroEstado: EstadoPedido | '' = '';
  busqueda = '';
  expandido = '';

  filtros: { estado: EstadoPedido | ''; texto: string }[] = [
    { estado: '',               texto: 'Todos' },
    { estado: 'pendiente_pago', texto: 'Por cobrar' },
    { estado: 'pagado',         texto: 'Pagados' },
    { estado: 'preparando',     texto: 'En preparación' },
    { estado: 'listo',          texto: 'Listos' },
    { estado: 'entregado',      texto: 'Entregados' },
    { estado: 'cancelado',      texto: 'Cancelados' },
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.historiales.clear();
    forkJoin({ pedidos: this.tienda.todos(), resumen: this.tienda.resumenClientes(), usuarios: this.auth.getUsuarios() }).subscribe({
      next: ({ pedidos, resumen, usuarios }) => {
        this.pedidos = pedidos;
        this.clientes = this.armarClientes(resumen, usuarios.filter(u => ROLES_CLIENTE.includes(u.rol)));
        this.cargando = false;
        this.error = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando clientes:', err);
        this.cargando = false;
        this.error = true;
        this.cdr.detectChanges();
      }
    });
  }

  // ── PEDIDOS ───────────────────────────────
  get pedidosFiltrados(): PedidoTienda[] {
    const texto = this.normalizar(this.busqueda);
    return this.pedidos.filter(p =>
      (!this.filtroEstado || p.estado === this.filtroEstado) &&
      (!texto || this.normalizar(`${p.codigo} ${p.contacto.nombre} ${p.contacto.email} ${p.contacto.telefono}`).includes(texto)));
  }

  cantidadEn(estado: EstadoPedido | ''): number {
    return estado ? this.pedidos.filter(p => p.estado === estado).length : this.pedidos.length;
  }

  siguiente(p: PedidoTienda) {
    return SIGUIENTE[p.estado] ?? null;
  }

  cancelable(p: PedidoTienda): boolean {
    return CANCELABLES.includes(p.estado);
  }

  avanzar(p: PedidoTienda): void {
    const paso = this.siguiente(p);
    if (paso) this.cambiarEstado(p, paso.estado);
  }

  cancelar(p: PedidoTienda): void {
    this.dialog.open(ConfirmacionDialogComponent, {
      data: {
        titulo: `Cancelar pedido ${p.codigo}`,
        mensaje: p.estado === 'pendiente_pago'
          ? 'El stock reservado vuelve a la tienda.'
          : 'El pedido ya está pagado: el stock vuelve a la tienda y hay que reintegrarle el dinero al cliente.',
        textoConfirmar: 'Cancelar pedido',
        textoCancelar: 'Volver',
      },
    }).afterClosed().subscribe(ok => { if (ok) this.cambiarEstado(p, 'cancelado'); });
  }

  private cambiarEstado(p: PedidoTienda, estado: EstadoPedido): void {
    this.tienda.cambiarEstado(p._id, estado).subscribe({
      next: (actualizado) => {
        this.pedidos = this.pedidos.map(x => x._id === actualizado._id ? actualizado : x);
        this.snackBar.open(`Pedido ${actualizado.codigo}: ${ESTADOS_PEDIDO[estado].texto.toLowerCase()}`, 'Cerrar',
          { duration: 2500, panelClass: 'snackbar--success' });
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.snackBar.open(err.error?.error ?? 'No se pudo actualizar el pedido', 'Cerrar', { duration: 3500, panelClass: 'snackbar--error' });
        this.cargar();
      }
    });
  }

  alternar(id: string): void {
    this.expandido = this.expandido === id ? '' : id;
  }

  // ── CLIENTES ──────────────────────────────
  get clientesFiltrados(): FilaCliente[] {
    const texto = this.normalizar(this.busqueda);
    return texto
      ? this.clientes.filter(c => this.normalizar(`${c.nombre} ${c.contacto}`).includes(texto))
      : this.clientes;
  }

  // Une las cuentas de clientes con el resumen de la API (que también trae a los invitados)
  private armarClientes(resumen: ResumenCliente[], cuentas: Usuario[]): FilaCliente[] {
    const filas = new Map<string, FilaCliente>();

    for (const u of cuentas) {
      const id = u._id ?? u.id ?? u.usuario;
      filas.set(id, {
        clave: id, nombre: u.nombre, contacto: [u.usuario, u.email].filter(Boolean).join(' · '),
        tipo: u.rol as 'cliente' | 'mayorista', usuario: u, cantidadPedidos: 0, compras: 0, gastado: 0, ultimo: null,
      });
    }

    for (const r of resumen) {
      const fila = filas.get(r.clave) ?? {
        clave: r.clave, nombre: r.nombre, contacto: r.email || r.telefono,
        tipo: r.usuarioId ? r.tipoCliente : 'invitado', usuario: null, cantidadPedidos: 0, compras: 0, gastado: 0, ultimo: null,
      };
      fila.cantidadPedidos = r.pedidos;
      fila.compras = r.compras;
      fila.gastado = r.gastado;
      fila.ultimo  = r.ultimo;
      filas.set(r.clave, fila);
    }

    return [...filas.values()].sort((a, b) => (b.ultimo ?? '').localeCompare(a.ultimo ?? '') || a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Despliega un cliente y trae su historial completo la primera vez
  alternarCliente(fila: FilaCliente): void {
    this.alternar(fila.clave);
    if (this.expandido !== fila.clave || this.historiales.has(fila.clave)) return;
    this.tienda.historialDe(fila.clave).subscribe({
      next: (pedidos) => { this.historiales.set(fila.clave, pedidos); this.cdr.detectChanges(); },
      error: () => this.snackBar.open('No se pudo cargar el historial', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' }),
    });
  }

  // Pasa una cuenta de cliente a mayorista o al revés (solo admin)
  cambiarTipo(fila: FilaCliente, tipo: 'cliente' | 'mayorista'): void {
    const id = fila.usuario?._id ?? fila.usuario?.id;
    if (!id || fila.tipo === tipo) return;
    this.auth.updateUsuario(id, { rol: tipo } as Usuario).subscribe({
      next: () => {
        fila.tipo = tipo;
        if (fila.usuario) fila.usuario.rol = tipo;
        this.snackBar.open(`${fila.nombre} ahora es ${tipo}`, 'Cerrar', { duration: 2500, panelClass: 'snackbar--success' });
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('No se pudo cambiar el tipo de cliente', 'Cerrar', { duration: 3000, panelClass: 'snackbar--error' }),
    });
  }

  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
